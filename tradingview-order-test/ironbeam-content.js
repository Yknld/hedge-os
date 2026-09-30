(() => {
  'use strict';
  if(window.__ironbeamContentLoaded)return;
  window.__ironbeamContentLoaded=true;
  const LOG='[Ironbeam]';
  const buildMqttPublish=globalThis.IronbeamMqtt?.buildMqttPublish||((topic,payload)=>{
    const encoder=new TextEncoder(),topicBytes=encoder.encode(topic),payloadBytes=encoder.encode(JSON.stringify(payload));
    const remaining=2+topicBytes.length+payloadBytes.length,remainingBytes=[];let value=remaining;
    do{let digit=value%128;value=Math.floor(value/128);if(value>0)digit|=128;remainingBytes.push(digit);}while(value>0);
    const packet=new Uint8Array(1+remainingBytes.length+remaining);let offset=0;packet[offset++]=0x30;packet.set(remainingBytes,offset);offset+=remainingBytes.length;
    packet[offset++]=topicBytes.length>>8;packet[offset++]=topicBytes.length&255;packet.set(topicBytes,offset);offset+=topicBytes.length;packet.set(payloadBytes,offset);return packet;
  });
  const STATES=['IDLE','OPENING_ORDER_PANEL','WAITING_FOR_SOE','CONFIGURING','SUBMITTING','WORKING','FILLED','CANCELING','CANCELED','ERROR'];
  const state={execution:'IDLE',executionUpdatedAt:Date.now(),socketReady:false,outboundTopic:null,inboundTopic:null,currentSoeId:null,currentStrategyId:null,activeStrategyIds:[],account:null,accountBalance:null,accountBalanceUpdatedAt:null,boundSymbol:null,detectedSymbol:null,marketQuote:null,error:null,lastServerMessage:null,lastObservedModify:null,lastBatchId:null};
  let lastMid=Date.now();
  let inboundSequence=0;
  const orderStrategies=new Map();
  const strategyStates=new Map();
  const outboundCapture=[];
  const livePositions=new Map();
  // A demo-account reset invalidates every cached position immediately. Do
  // not allow that old cache to authorize (or block) a new arm; wait for a
  // fresh broker Positions update instead.
  let positionsFreshAfterReset=false,positionsSnapshotSource=null,positionsSnapshotAt=null;
  let extensionContextValid=true,maintenanceInterval=null;
  function stopForInvalidContext(){extensionContextValid=false;if(maintenanceInterval!==null){clearInterval(maintenanceInterval);maintenanceInterval=null;}rejectWaiters('IRONBEAM_EXTENSION_CONTEXT_INVALIDATED');}
  function sendRuntimeMessage(message){
    if(!extensionContextValid)return Promise.resolve(null);
    try{
      if(!chrome.runtime?.id){stopForInvalidContext();return Promise.resolve(null);}
      const request=chrome.runtime.sendMessage(message);
      return Promise.resolve(request).catch(error=>{if(/extension context invalidated/i.test(String(error?.message||error))){stopForInvalidContext();return null;}throw error;});
    }catch(error){if(/extension context invalidated/i.test(String(error?.message||error))){stopForInvalidContext();return Promise.resolve(null);}return Promise.reject(error);}
  }
  const nextMid=()=>{lastMid=Math.max(Date.now(),lastMid+1);return lastMid;};
  const waiters=new Set();
  const update=(patch)=>Object.assign(state,patch,Object.prototype.hasOwnProperty.call(patch,'execution')?{executionUpdatedAt:Date.now()}:{});
  // Position snapshots are returned to the background worker on demand.  They
  // are deliberately timestamped so a timeout can distinguish a live broker
  // confirmation from an old event that happened to remain in memory.
  const normalized=()=>({...state,activeStrategyIds:[...state.activeStrategyIds],positions:[...livePositions.values()].map(position=>({...position})),positionsFreshAfterReset,positionsSnapshotSource,positionsSnapshotAt});
  const rawId=(payload,field)=>String(payload?.[`__hedgeOsRaw${field}`]??payload?.[field]??'').trim();
  const sameId=(left,right)=>String(left??'').trim()===String(right??'').trim();
  const positiveId=(value)=>/^\d+$/.test(String(value??'').trim())&&BigInt(String(value).trim())>0n;
  const validSoe=(payload)=>payload?.MESSAGE==='STRATEGY_ORDER_ENTRY_UPDATE'&&positiveId(payload.SOE_ID)&&payload.CLOSE_STATUS==='CLOSE_STATUS_OPEN'&&String(payload.ERROR??'')==='';
  const settleWaiters=(payload)=>{for(const waiter of [...waiters]){if(waiter.match(payload)){waiters.delete(waiter);clearTimeout(waiter.timer);waiter.resolve(payload);}}};
  const waitForMessage=(match,timeoutMs=6000,phase='MESSAGE')=>new Promise((resolve,reject)=>{const waiter={match,resolve,reject,timer:setTimeout(()=>{waiters.delete(waiter);reject(new Error(`IRONBEAM_${phase}_ACK_TIMEOUT:execution=${state.execution};socket=${state.socketReady?'ready':'disconnected'};inbound=${inboundSequence}`));},timeoutMs)};waiters.add(waiter);});
  const rejectWaiters=(code)=>{for(const waiter of [...waiters]){waiters.delete(waiter);clearTimeout(waiter.timer);waiter.reject(new Error(code));}};
  const waitForDom=(predicate,label,timeoutMs=3000)=>new Promise((resolve,reject)=>{const started=Date.now();const poll=()=>{let value=false;try{value=predicate();}catch(_){}if(value)return resolve(value);if(Date.now()-started>=timeoutMs)return reject(new Error(`IRONBEAM_DOM_TIMEOUT:${label}`));setTimeout(poll,50);};poll();});
  window.addEventListener('hedge-os:ironbeam:status',(event)=>{const detail=event.detail||{};update({socketReady:Boolean(detail.socketReady),outboundTopic:detail.outboundTopic||null,inboundTopic:detail.inboundTopic||null});if(!state.socketReady){rejectWaiters('IRONBEAM_SOCKET_DISCONNECTED');update({currentSoeId:null,execution:'IDLE'});}});
  window.addEventListener('hedge-os:ironbeam:mqtt',(event)=>{
    const {direction,topic,payload}=event.detail||{};if(!payload)return;
    if(direction==='outbound'&&topic?.startsWith('SERVER/')){
      if(!['HEARTBEAT','MARKET_DATA','MARKET_DATA_UPDATE'].includes(payload.MESSAGE)){
        outboundCapture.push({time:new Date().toISOString(),topic,payload:structuredClone(payload)});if(outboundCapture.length>500)outboundCapture.splice(0,outboundCapture.length-500);
        if(payload.MESSAGE==='RESET DEMO ACCOUNT')invalidateBrokerPositionCache('DEMO_ACCOUNT_RESET');
        if(payload.MESSAGE==='STRATEGY_ORDER_ENTRY_MODIFY')state.lastObservedModify=payload;
        sendRuntimeMessage({type:'IRONBEAM_EVENT',event:{provider:'ironbeam',type:'execution_audit',category:'broker_request',action:String(payload.MESSAGE||'UNKNOWN'),strategyId:firstFinite(payload.STRATEGY_ID,payload.SOE_ID),batchId:state.lastBatchId||null,observedAt:Date.now(),details:{message:payload.MESSAGE,mid:payload.MID??null,strategyId:payload.STRATEGY_ID??null,soeId:payload.SOE_ID??null,submitNow:Boolean(payload.SUBMIT_NOW),closeNow:Boolean(payload.CLOSE_NOW),paramUpdates:Array.isArray(payload.PARAM_UPDATES)?payload.PARAM_UPDATES.slice(0,30):null}}}).catch(()=>{});
      }
      return;
    }
    if(direction!=='inbound'||!topic?.startsWith('CLIENT/'))return;
    if(['MARKET_DATA','MARKET_DATA_UPDATE'].includes(payload.MESSAGE)){const quote=marketQuote(payload);if(quote)update({marketQuote:quote});return;}
    if(payload.MESSAGE==='HEARTBEAT')return;
    inboundSequence+=1;
    state.lastServerMessage=payload;
    if(typeof payload.ACCOUNT==='string'&&payload.ACCOUNT)state.account=payload.ACCOUNT;
    if(payload.MESSAGE==='STRATEGY_ORDER_ENTRY_UPDATE'){
      // Persist the broker's complete SOE acknowledgement (especially a
      // rejected submit).  The order-event feed can arrive later and only
      // contains a truncated status, which is not enough to diagnose a
      // stop-limit price rule failure.
      if(payload.SUBMIT_RESULT!==undefined||String(payload.ERROR??'')!==''){
        sendRuntimeMessage({type:'IRONBEAM_EVENT',event:{provider:'ironbeam',type:'execution_audit',category:'broker_response',action:String(payload.SUBMIT_RESULT===1?'SOE_SUBMIT_ACCEPTED':'SOE_SUBMIT_REJECTED'),strategyId:firstFinite(payload.STRATEGY_ID,payload.SOE_ID),batchId:state.lastBatchId||null,observedAt:Date.now(),details:{soeId:payload.SOE_ID??null,submitResult:payload.SUBMIT_RESULT??null,error:String(payload.ERROR??''),closeStatus:payload.CLOSE_STATUS??null,response:structuredClone(payload)}}}).catch(()=>{});
      }
      if(validSoe(payload)){const soe=rawId(payload,'SOE_ID');update({currentSoeId:soe,currentStrategyId:positiveId(rawId(payload,'STRATEGY_ID'))?rawId(payload,'STRATEGY_ID'):soe,error:null});}
      else if(positiveId(rawId(payload,'SOE_ID'))&&sameId(rawId(payload,'SOE_ID'),state.currentSoeId)&&payload.CLOSE_STATUS==='CLOSE_STATUS_CLOSED')update({currentSoeId:null});
    }
    trackPositions(payload);
    trackOrderEvent(payload);settleWaiters(payload);
  });
  const firstFinite=(...values)=>{for(const value of values){if(value===null||value===undefined||value==='')continue;const number=Number(value);if(Number.isFinite(number))return number;}return null;};
  const firstText=(...values)=>values.find(value=>typeof value==='string'&&value.trim())||null;
  function nestedValue(value,keys,depth=0){
    if(!value||typeof value!=='object'||depth>5)return null;
    for(const [key,item] of Object.entries(value)){if(keys.includes(String(key).toUpperCase())){const number=Number(item);if(Number.isFinite(number))return number;}}
    for(const item of Object.values(value)){const found=nestedValue(item,keys,depth+1);if(found!==null)return found;}
    return null;
  }
  function marketQuote(payload){
    const bid=nestedValue(payload,['BID','BEST_BID','BID_PRICE']),ask=nestedValue(payload,['ASK','BEST_ASK','ASK_PRICE']);
    if(!Number.isFinite(bid)||!Number.isFinite(ask)||bid<=0||ask<=0||ask<bid)return null;
    return {bid,ask,last:nestedValue(payload,['LAST','LAST_PRICE','TRADE_PRICE']),updatedAt:Date.now()};
  }
  function netPositionUpdates(payload){
    if(payload?.MESSAGE!=='SUBSCRIBE_POSITIONS_UPDATE'||!Array.isArray(payload.POSITION_SET_UPDATES))return [];
    return payload.POSITION_SET_UPDATES.filter(set=>set?.POSITION_SET_TYPE==='AVG_NET_SINCE_FLAT').flatMap(set=>(set.EDITS||[]).map(edit=>({account:String(set.ACCOUNT||edit?.POS?.ACCOUNT_NUMBER||''),symbol:String(set.EXCH_SYM||edit?.POS?.EXCH_SYM||''),quantity:Number(edit?.POS?.QUANTITY),averagePrice:Number(edit?.POS?.PRICE)}))).filter(item=>item.account&&item.symbol&&Number.isFinite(item.quantity));
  }
  function invalidateBrokerPositionCache(reason){
    livePositions.clear();orderStrategies.clear();strategyStates.clear();
    positionsFreshAfterReset=false;positionsSnapshotSource=null;positionsSnapshotAt=null;
    update({activeStrategyIds:[],currentSoeId:null,currentStrategyId:null,execution:'IDLE',error:null});
    sendRuntimeMessage({type:'IRONBEAM_EVENT',event:{provider:'ironbeam',type:'broker_snapshot_reset',status:'POSITION_CACHE_INVALIDATED',reason,observedAt:Date.now()}}).catch(()=>{});
  }
  function trackPositions(payload){const positions=netPositionUpdates(payload);if(!positions.length)return;positionsFreshAfterReset=true;positionsSnapshotSource='broker_positions_stream';positionsSnapshotAt=Date.now();for(const position of positions){const observedAt=Date.now(),next={...position,observedAt},key=`${position.account}|${position.symbol}`;livePositions.set(key,next);sendRuntimeMessage({type:'IRONBEAM_EVENT',event:{provider:'ironbeam',type:'position_state',...next}}).catch(()=>{});}}
  function trackOrderEvent(payload){
    if(!['SUBSCRIBE_ORDER_EVENT_UPDATE','SUBSCRIBE_STRATEGY_NEVENTS_UPDATE','SUBSCRIBE_POSITIONS_UPDATE','STOP_STRATEGY_REPLY'].includes(payload.MESSAGE))return;
    const sources=Array.isArray(payload.ORDER_EVENTS)?payload.ORDER_EVENTS:Array.isArray(payload.POSITIONS)?payload.POSITIONS:[payload.ORDER_EVENT||payload.ORDER||payload.POSITION||payload];
    for(const source of sources)trackOneOrderEvent(payload,source);
  }
  function trackOneOrderEvent(payload,source){
    // Ironbeam broadcasts account events to every open workspace.  A MNQ
    // strategy event seen by the NNQ tab is not an NNQ fill; accepting it
    // was what allowed the UI to show a false “hedge filled” state.
    const eventSymbol=firstText(source.symbol,source.SYMBOL,payload.SYMBOL);
    const expectedRoot=String(state.boundSymbol||state.detectedSymbol||'').toUpperCase().replace(/^XCME:/,'').split('.')[0];
    const eventRoot=String(eventSymbol||'').toUpperCase().replace(/^XCME:/,'').split('.')[0];
    if(expectedRoot&&eventRoot&&expectedRoot!==eventRoot)return;
    const orderRecordId=firstText(source.orderRecordID,source.orderRecordId,source.ORDER_RECORD_ID);
    const directStrategyId=rawId(source,'STRATEGY_ID')||rawId(payload,'STRATEGY_ID')||firstText(source.strategyId,source.STRATEGY_ID,payload.STRATEGY_ID);
    if(orderRecordId&&directStrategyId!==null)orderStrategies.set(orderRecordId,directStrategyId);
    const strategyId=directStrategyId||orderStrategies.get(orderRecordId)||state.currentStrategyId;if(!strategyId)return;
    const raw=String(firstText(source.orderStatus,source.ORDER_STATUS,source.orderState,source.ORDER_STATE,source.ORDER_EVENT_TYPE,source.STATUS,payload.STRATEGY_STATUS)||'').toUpperCase();let status=null;
    const filled=firstFinite(source.fillTotalQuantity,source.FILL_TOTAL_QUANTITY,source.fillQuantity,source.FILL_QUANTITY)||0,total=firstFinite(source.orderQuantity,source.ORDER_QUANTITY,source.quantity,source.QUANTITY);
    if((total!==null&&filled>=total&&filled>0)||source.orderUpdateType==='F'||source.ORDER_UPDATE_TYPE==='F'||source.orderStatus==='2'||source.ORDER_STATUS==='2'||source.orderState==='3'||source.ORDER_STATE==='3')status='FILLED';
    else if(filled>0||/PARTIAL/.test(raw))status='PARTIALLY_FILLED';else if(/CANCEL|STOPPED/.test(raw))status='CANCELED';else if(/REJECT|ERROR/.test(raw))status='REJECTED';else if(source.orderStatus==='0'||source.orderState==='2'||/WORK|OPEN|ACCEPT|SUBMIT|ORDER_REQUEST/.test(raw))status='WORKING';
    if(payload.MESSAGE==='STOP_STRATEGY_REPLY'&&Number(payload.STRATEGY_RESULT)===1)status='CANCELED';if(!status)return;
    strategyStates.set(strategyId,status);
    const active=new Set(state.activeStrategyIds);if(['WORKING','PARTIALLY_FILLED'].includes(status))active.add(strategyId);else active.delete(strategyId);
    update({activeStrategyIds:[...active],execution:status==='PARTIALLY_FILLED'?'WORKING':status});
    // A strategy can be accepted at the SOE layer and rejected later by the
    // broker/exchange. Preserve the broker diagnostic in the durable audit.
    const brokerError=firstText(source.error,source.ERROR,source.errorMessage,source.ERROR_MESSAGE,source.rejectReason,source.REJECT_REASON,payload.ERROR,payload.ERROR_MESSAGE,payload.REJECT_REASON);
    sendRuntimeMessage({type:'IRONBEAM_EVENT',event:{provider:'ironbeam',type:status==='FILLED'||status==='PARTIALLY_FILLED'?'order_fill':'order_state',strategyId,status,
      symbol:firstText(source.symbol,source.SYMBOL,payload.SYMBOL,state.boundSymbol),filledQuantity:firstFinite(source.fillTotalQuantity,source.FILL_TOTAL_QUANTITY,source.fillQuantity,source.FILL_QUANTITY),
      averageFillPrice:firstFinite(source.fillAveragePrice,source.FILL_AVERAGE_PRICE,source.fillPrice,source.FILL_PRICE),orderRecordId,
      orderSide:firstText(source.side,source.SIDE,source.orderSide,source.ORDER_SIDE),orderType:firstText(source.orderType,source.ORDER_TYPE),orderQuantity:total,
      limitPrice:firstFinite(source.limitPrice,source.LIMIT_PRICE,source.price,source.PRICE),stopPrice:firstFinite(source.stopPrice,source.STOP_PRICE,source.auxPrice,source.AUX_PRICE),
      brokerError:brokerError||null,observedAt:Date.now()}}).catch(()=>{});
  }
  const visible=(element)=>{if(!(element instanceof Element))return false;const rect=element.getBoundingClientRect(),style=getComputedStyle(element);return rect.width>0&&rect.height>0&&style.display!=='none'&&style.visibility!=='hidden';};
  const text=(element)=>(element?.textContent||'').replace(/\s+/g,' ').trim();
  function detectDomAccountBalance(){
    const candidates=[...document.querySelectorAll('span,div')].filter(visible).flatMap(element=>{
      if(element.children.length)return [];
      const raw=text(element),match=raw.match(/^\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{2}))$/);
      if(!match)return [];
      const rect=element.getBoundingClientRect(),value=Number(match[1].replace(/,/g,''));
      if(!Number.isFinite(value)||value<0||rect.top>Math.min(260,innerHeight*.25)||rect.left<innerWidth*.5)return [];
      return [{value,score:rect.top+(innerWidth-rect.right)*.1}];
    }).sort((a,b)=>a.score-b.score);
    if(!candidates.length)return null;
    update({accountBalance:candidates[0].value,accountBalanceUpdatedAt:Date.now()});
    return candidates[0].value;
  }
  function confirmVisibleFlatPosition(){
    if(positionsFreshAfterReset)return false;
    // Ironbeam can omit a zero-row in its Positions stream after a demo reset.
    // Accept only the live ticket's explicit, visible Position +0 indicator;
    // a missing or hidden control is still unknown and remains fail-closed.
    const values=[...document.querySelectorAll('div,span,td,[role="cell"],[role="gridcell"]')].filter(visible).map(text);
    const isFlat=values.some(value=>/\bPosition\s*\+?0(?:\.0+)?(?:\s+\$?0(?:\.0+)?)?\b/i.test(value));
    if(!isFlat)return false;
    positionsFreshAfterReset=true;positionsSnapshotSource='ironbeam_visible_position_zero';positionsSnapshotAt=Date.now();
    sendRuntimeMessage({type:'IRONBEAM_EVENT',event:{provider:'ironbeam',type:'position_snapshot',status:'FLAT_CONFIRMED_VISIBLE',source:positionsSnapshotSource,observedAt:positionsSnapshotAt}}).catch(()=>{});
    return true;
  }
  function detectDomSymbol(){
    const contract=/^[A-Z]{1,6}\.[FGHJKMNQUVXZ]\d{2}$/;
    const values=[...document.querySelectorAll('input')].filter(visible).map(input=>String(input.value||'').trim().toUpperCase()).filter(value=>contract.test(value));
    const unique=[...new Set(values)];const detected=unique.length===1?`XCME:${unique[0]}`:null;state.detectedSymbol=detected;return detected;
  }
  function findOrderPanelRoot(){
    const headings=[...document.querySelectorAll('*')].filter(element=>visible(element)&&/^Order Entry$/i.test(text(element)));
    for(const heading of headings){
      let node=heading.parentElement;
      for(let depth=0;node&&depth<10;depth+=1,node=node.parentElement){
        const value=text(node);
        if(/Simple Order/i.test(value)&&/Quantity/i.test(value)&&/Symbol/i.test(value)&&/SUBMIT/i.test(value))return node;
      }
    }
    return null;
  }
  const orderPanelVisible=()=>Boolean(findOrderPanelRoot());
  async function closeStaleOrderPanel(){
    const panel=findOrderPanelRoot();if(!panel)return;
    const buttons=[...panel.querySelectorAll('button,[role="button"]')].filter(visible);
    const close=buttons.find(button=>/close/i.test(`${button.getAttribute('aria-label')||''} ${button.getAttribute('title')||''}`))||buttons.find(button=>/^[×✕✖x]$/i.test(text(button)));
    if(!close)throw new Error('IRONBEAM_STALE_ORDER_PANEL_CLOSE_NOT_FOUND');
    close.click();await waitForDom(()=>!findOrderPanelRoot(),'stale Ironbeam Order Entry panel to close',3000);
    update({currentSoeId:null});
  }
  let panelOpenAttemptAt=0;
  let announcedContract='';
  let announcementPending=false;

  function announceDetectedContract(){
    const symbol=String(state.detectedSymbol||'').trim().toUpperCase();
    if(!symbol||symbol===announcedContract||announcementPending)return;
    announcementPending=true;
    sendRuntimeMessage({type:'IRONBEAM_AUTO_DETECTED',symbol,account:state.account||null})
      .then(result=>{if(result?.ok||String(result?.error||'').startsWith('IRONBEAM_BOUND_CONTRACT_CHANGED'))announcedContract=symbol;})
      .catch(()=>{})
      .finally(()=>{announcementPending=false;});
  }
  function findOrderPanelTrigger(){
    const explicit=[...document.querySelectorAll('button,[role="button"],[role="menuitem"],a')].filter(visible).filter(element=>/^(new order|order entry|place order)$/i.test(text(element)));
    if(explicit.length===1)return explicit[0];
    const quoteButtons=[...document.querySelectorAll('button,[role="button"]')].filter(visible).filter(element=>/^(bid|ask)$/i.test(text(element)));
    if(!quoteButtons.length)return null;
    const displaySymbol=String(state.boundSymbol||'').split(':').pop();
    if(displaySymbol){const matching=quoteButtons.find(button=>{let node=button;for(let depth=0;node&&depth<8;depth+=1,node=node.parentElement){if(text(node).includes(displaySymbol))return true;}return false;});if(matching)return matching;}
    return quoteButtons[0];
  }
  function maintainOrderPanel(){
    if(!extensionContextValid)return;
    detectDomSymbol();
    announceDetectedContract();
    if(!state.socketReady||orderPanelVisible()||['OPENING_ORDER_PANEL','WAITING_FOR_SOE','CONFIGURING','SUBMITTING','CANCELING'].includes(state.execution))return;
    if(Date.now()-panelOpenAttemptAt<5000)return;const trigger=findOrderPanelTrigger();if(!trigger)return;
    panelOpenAttemptAt=Date.now();trigger.click();console.log(LOG,'Reopened Order Entry panel');
  }
  async function openFreshOrderPanel(timeoutMs=15000){
    if(!state.socketReady)throw new Error('IRONBEAM_SOCKET_UNAVAILABLE');
    const openPanel=orderPanelVisible();
    if(openPanel&&positiveId(state.currentSoeId)){update({execution:'WAITING_FOR_SOE',error:null});return state.currentSoeId;}
    if(openPanel)await closeStaleOrderPanel();
    const previous=state.currentSoeId;
    update({execution:'OPENING_ORDER_PANEL',currentSoeId:null,error:null});
    const trigger=findOrderPanelTrigger();if(!trigger)throw new Error('IRONBEAM_ORDER_ENTRY_CONTROL_NOT_FOUND');
    // Ironbeam can emit the new SOE record in the same turn as this click.
    // Register first so a fast response cannot be missed and misreported as
    // an SOE-open timeout while the socket itself remains healthy.
    const responsePromise=waitForMessage(value=>validSoe(value)&&!sameId(rawId(value,'SOE_ID'),previous),timeoutMs,'SOE_OPEN');
    trigger.click();update({execution:'WAITING_FOR_SOE'});
    const payload=await responsePromise;
    const soeId=rawId(payload,'SOE_ID');update({currentSoeId:soeId,currentStrategyId:rawId(payload,'STRATEGY_ID')||soeId});
    return soeId;
  }
  function sendPacket(payload){
    if(!state.socketReady||!state.outboundTopic) return Promise.reject(new Error('IRONBEAM_SOCKET_OR_TOPIC_UNAVAILABLE'));
    const requestId=crypto.randomUUID(),packet=buildMqttPublish(state.outboundTopic,payload);
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{window.removeEventListener('hedge-os:ironbeam:send-result',listener);reject(new Error('IRONBEAM_PAGE_SEND_TIMEOUT'));},2000);const listener=(event)=>{if(event.detail?.requestId!==requestId)return;clearTimeout(timer);window.removeEventListener('hedge-os:ironbeam:send-result',listener);event.detail.ok?resolve():reject(new Error(event.detail.error||'IRONBEAM_PAGE_SEND_FAILED'));};window.addEventListener('hedge-os:ironbeam:send-result',listener);window.dispatchEvent(new CustomEvent('hedge-os:ironbeam:send',{detail:{requestId,bytes:[...packet]}}));});
  }
  const finitePositive=(value,name)=>{const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new Error(`INVALID_IRONBEAM_${name}`);return number;};
  const formulaNumber=(value)=>`=${Number(value)}`;
  async function sendSoeMutation(soeId,paramUpdates,timeoutMs=15000){
    if(!positiveId(soeId))throw new Error('IRONBEAM_INVALID_SOE_ID');
    const baseline=inboundSequence,mid=nextMid();
    // Ironbeam rewrites MID_REF to its own small sequence number, so it
    // cannot be used as a request correlation key. Exact SOE ID is stable
    // now that we preserve it as decimal text.
    const responsePromise=waitForMessage(payload=>inboundSequence>baseline&&payload?.MESSAGE==='STRATEGY_ORDER_ENTRY_UPDATE'&&sameId(rawId(payload,'SOE_ID'),soeId),timeoutMs,'SOE_CONFIGURATION');
    await sendPacket({SOE_ID:soeId,PARAM_UPDATES:paramUpdates,MESSAGE:'STRATEGY_ORDER_ENTRY_MODIFY',MID:mid});
    const response=await responsePromise;
    if(String(response.ERROR??'')!=='')throw new Error(`IRONBEAM_CONFIGURATION_REJECTED:${response.ERROR}`);
    if(response.CLOSE_STATUS==='CLOSE_STATUS_CLOSED')throw new Error('IRONBEAM_SOE_CLOSED_DURING_CONFIGURATION');
    return response;
  }
  async function submitSoe(soeId,timeoutMs=45000){
    if(!positiveId(soeId))throw new Error('IRONBEAM_INVALID_SOE_ID');
    const baseline=inboundSequence,mid=nextMid();
    const responsePromise=waitForMessage(payload=>inboundSequence>baseline&&payload?.MESSAGE==='STRATEGY_ORDER_ENTRY_UPDATE'&&sameId(rawId(payload,'SOE_ID'),soeId)&&(payload.SUBMIT_RESULT!==undefined||String(payload.ERROR??'')!==''),timeoutMs,'SOE_SUBMIT');
    await sendPacket({PARAM_UPDATES:[],MESSAGE:'STRATEGY_ORDER_ENTRY_MODIFY',SOE_ID:soeId,CLOSE_NOW:true,SUBMIT_NOW:true,MID:mid});
    const response=await responsePromise;
    if(String(response.ERROR??'')!==''||Number(response.SUBMIT_RESULT)!==1)throw new Error(`IRONBEAM_SUBMIT_REJECTED:${response.ERROR||response.SUBMIT_RESULT}:${JSON.stringify(response)}`);
    return response;
  }
  async function submitMarketFlatten(soeId,{account,symbol,quantity,side},timeoutMs=10000){
    if(!positiveId(soeId))throw new Error('IRONBEAM_INVALID_SOE_ID');
    const baseline=inboundSequence,mid=nextMid();
    const responsePromise=waitForMessage(payload=>inboundSequence>baseline&&payload?.MESSAGE==='STRATEGY_ORDER_ENTRY_UPDATE'&&sameId(rawId(payload,'SOE_ID'),soeId)&&(payload.SUBMIT_RESULT!==undefined||String(payload.ERROR??'')!==''),timeoutMs,'SOE_FLATTEN');
    await sendPacket({PARAM_UPDATES:['StratId',"='0'",'Top',"='SingleOrder'",'Top:AllowPotential','=true','Top:Account','=DefaultAccount','Top:OrderSide','=DefaultSide','Top:Quantity','=DefaultQuantity','Top:Symbol','=DefaultSymbol','Top:OrderType','=DefaultOrderType','Top:Price','=DefaultPrice','Top:AuxPrice','=Price','Top:OrderDuration','=DefaultDuration','Top:MinTimeBetweeenUpdates','=250','Top:OrderLike','=true','DefaultAccount',`='${account}'`,'DefaultSymbol',`='${symbol}'`,'DefaultSide',side,'DefaultQuantity',formulaNumber(quantity),'DefaultOrderType','Market','DefaultPrice','=RecentPrice(SYM) ifInvalid 0.0','DefaultDuration','=OrderDuration.DAY'],MESSAGE:'STRATEGY_ORDER_ENTRY_MODIFY',SOE_ID:soeId,CLOSE_NOW:true,SUBMIT_NOW:true,MID:mid});
    const response=await responsePromise;if(String(response.ERROR??'')!==''||Number(response.SUBMIT_RESULT)!==1)throw new Error(`IRONBEAM_FLATTEN_REJECTED:${response.ERROR||response.SUBMIT_RESULT}`);return response;
  }
  async function placeIronbeamBracket(order){
    update({execution:'WAITING_FOR_SOE',error:null,lastBatchId:order?.batchId||null});
    try{
      const symbol=String(order?.symbol||'').trim(),side=String(order?.side||'').toUpperCase();
      const quantity=finitePositive(order?.quantity,'QUANTITY'),limitPrice=finitePositive(order?.limitPrice,'LIMIT_PRICE');
      const takeProfitOffset=finitePositive(order?.takeProfitOffset,'TAKE_PROFIT_OFFSET'),stopLossOffset=finitePositive(order?.stopLossOffset,'STOP_LOSS_OFFSET');
      const orderType=String(order?.orderType||'LIMIT').toUpperCase();
      const stopPrice=orderType==='STOP_LIMIT'?finitePositive(order?.stopPrice,'STOP_PRICE'):null;
      if(!symbol)throw new Error('INVALID_IRONBEAM_SYMBOL');if(!['BUY','SELL'].includes(side))throw new Error('INVALID_IRONBEAM_SIDE');
      if(!['LIMIT','STOP','STOP_LIMIT'].includes(orderType))throw new Error('INVALID_IRONBEAM_ORDER_TYPE');
      const soeId=await openFreshOrderPanel();
      const account=String(order?.account||state.account||(state.outboundTopic||'').slice(7).split('_')[0]||'').trim();
      if(!account)throw new Error('IRONBEAM_ACCOUNT_UNKNOWN');
      update({execution:'CONFIGURING',account,boundSymbol:symbol});
      await sendSoeMutation(soeId,['StratId',"='0'",'Top',"='SingleOrder'",'Top:AllowPotential','=true','Top:Account','=DefaultAccount','Top:OrderSide','=DefaultSide','Top:Quantity','=DefaultQuantity','Top:Symbol','=DefaultSymbol','Top:OrderType','=DefaultOrderType','Top:Price','=DefaultPrice','Top:AuxPrice','=Price','Top:OrderDuration','=DefaultDuration','Top:MinTimeBetweeenUpdates','=250','Top:OrderLike','=true','DefaultAccount',`='${account}'`,'DefaultSymbol',`='${symbol}'`,'DefaultSide',`=OrderSide.${side}`,'DefaultQuantity',formulaNumber(quantity),'DefaultOrderType',orderType==='STOP_LIMIT'?'StopLimit':orderType==='STOP'?'Stop':'Limit','DefaultPrice',formulaNumber(limitPrice),'DefaultDuration','=OrderDuration.DAY']);
      // Configure the bracket atomically.  The Ironbeam ticket recomputes
      // Aux Price from Price after every individual mutation; doing this in
      // several messages could overwrite the explicit Stop Limit trigger
      // just before submit.
      // Ironbeam's Stop Limit ticket labels the trigger as Price and the
      // executable price cap as Aux Price.  This is the opposite of our
      // neutral `stopPrice` / `limitPrice` command names.  A sell must have
      // cap <= trigger (and a buy cap >= trigger); reversing these fields
      // causes the broker's "Limit Price Must..." rejection.
      const bracketUpdates=['Top',"='OrderTriggersBracketAtOffset'",'Top:OpenOrder:Price',formulaNumber(orderType==='STOP_LIMIT'?stopPrice:limitPrice)];
      if(orderType==='STOP_LIMIT')bracketUpdates.push('Top:OpenOrder:AuxPrice',formulaNumber(limitPrice));
      bracketUpdates.push('Top:TakeProfitOffset',String(takeProfitOffset),'Top:StopLossOffset',String(stopLossOffset));
      await sendSoeMutation(soeId,bracketUpdates);
      update({execution:'SUBMITTING'});const response=await submitSoe(soeId);const strategyId=rawId(response,'STRATEGY_ID')||soeId;
      const active=new Set(state.activeStrategyIds);active.add(strategyId);update({execution:'WORKING',currentSoeId:null,currentStrategyId:strategyId,activeStrategyIds:[...active],error:null,lastServerMessage:response});
      strategyStates.set(strategyId,'WORKING');
      // Never put a blind cancel timer on a bracket strategy. Once its entry
      // fills, Ironbeam continues publishing WORKING updates for its attached
      // TP/SL child orders. Treating that as an unfilled entry sent a later
      // STOP_STRATEGY against an already-live hedge. The background worker
      // owns completion reconciliation from broker position snapshots instead.
      return {success:true,strategyId,serverResponse:response};
    }
    catch(error){update({execution:'ERROR',error:String(error?.message||error)});throw error;}
  }
  // A single marketable limit has no attached TP/SL. Hedge OS uses this for
  // normal prop-driven reconciliation; server-side brackets remain reserved
  // for independently configured catastrophic protection.
  async function placeIronbeamMarketableLimit(order){
    update({execution:'WAITING_FOR_SOE',error:null,lastBatchId:order?.batchId||null});
    try{
      const symbol=String(order?.symbol||'').trim(),side=String(order?.side||'').toUpperCase();
      const quantity=finitePositive(order?.quantity,'QUANTITY'),limitPrice=finitePositive(order?.limitPrice,'LIMIT_PRICE');
      if(!symbol)throw new Error('INVALID_IRONBEAM_SYMBOL');if(!['BUY','SELL'].includes(side))throw new Error('INVALID_IRONBEAM_SIDE');
      const soeId=await openFreshOrderPanel(),account=String(order?.account||state.account||(state.outboundTopic||'').slice(7).split('_')[0]||'').trim();
      if(!account)throw new Error('IRONBEAM_ACCOUNT_UNKNOWN');update({execution:'CONFIGURING',account,boundSymbol:symbol});
      await sendSoeMutation(soeId,['StratId',"='0'",'Top',"='SingleOrder'",'Top:AllowPotential','=true','Top:Account','=DefaultAccount','Top:OrderSide','=DefaultSide','Top:Quantity','=DefaultQuantity','Top:Symbol','=DefaultSymbol','Top:OrderType','=DefaultOrderType','Top:Price','=DefaultPrice','Top:AuxPrice','=Price','Top:OrderDuration','=DefaultDuration','Top:OrderLike','=true','DefaultAccount',`='${account}'`,'DefaultSymbol',`='${symbol}'`,'DefaultSide',`=OrderSide.${side}`,'DefaultQuantity',formulaNumber(quantity),'DefaultOrderType','Limit','DefaultPrice',formulaNumber(limitPrice),'DefaultDuration','=OrderDuration.DAY']);
      update({execution:'SUBMITTING'});const response=await submitSoe(soeId),strategyId=rawId(response,'STRATEGY_ID')||soeId;const active=new Set(state.activeStrategyIds);active.add(strategyId);update({execution:'WORKING',currentSoeId:null,currentStrategyId:strategyId,activeStrategyIds:[...active],error:null,lastServerMessage:response});strategyStates.set(strategyId,'WORKING');
      const timeoutMs=Number(order?.marketableLimitTimeoutMs);if(Number.isFinite(timeoutMs)&&timeoutMs>0)setTimeout(()=>{if(strategyStates.get(strategyId)!=='WORKING')return;cancelIronbeamStrategy(strategyId).catch(()=>{});},timeoutMs);
      return {success:true,strategyId,serverResponse:response};
    }catch(error){update({execution:'ERROR',error:String(error?.message||error)});throw error;}
  }
  async function cancelIronbeamStrategy(strategyId){
    if(!positiveId(strategyId))throw new Error('INVALID_IRONBEAM_STRATEGY_ID');
    update({execution:'CANCELING',error:null});
    try{const mid=nextMid();const replyPromise=waitForMessage(payload=>payload?.MESSAGE==='STOP_STRATEGY_REPLY'&&Number(payload.MID_REF)===mid&&sameId(rawId(payload,'STRATEGY_ID'),strategyId),15000,'STRATEGY_CANCEL');
      await sendPacket({STRATEGY_ID:String(strategyId),MESSAGE:'STOP_STRATEGY',STRATEGY_STATUS:12,MID:mid});
      const reply=await replyPromise;
      if(Number(reply.STRATEGY_RESULT)!==1)throw new Error(`IRONBEAM_CANCEL_REJECTED:${JSON.stringify(reply)}`);
      const active=new Set(state.activeStrategyIds);active.delete(String(strategyId));update({execution:'CANCELED',activeStrategyIds:[...active],error:null,lastServerMessage:reply});
      strategyStates.set(Number(strategyId),'CANCELED');
      return {success:true,strategyId:Number(strategyId),serverResponse:reply};}
    catch(error){update({execution:'ERROR',error:String(error?.message||error)});throw error;}
  }
  const TERMINAL_STRATEGY_STATES=new Set(['FILLED','CANCELED','REJECTED','COMPLETE']);
  async function cancelAllIronbeamStrategies(){
    if(!state.socketReady||!state.outboundTopic)throw new Error('IRONBEAM_SOCKET_OR_TOPIC_UNAVAILABLE');
    const ids=[...new Set(state.activeStrategyIds.map(Number).filter(Number.isFinite))].filter(id=>!TERMINAL_STRATEGY_STATES.has(strategyStates.get(id)));
    console.log(LOG,`Cancel All targeting ${ids.length} unique active strateg${ids.length===1?'y':'ies'}`);
    const results=await Promise.all(ids.map(async strategyId=>{
      const before=strategyStates.get(strategyId);if(TERMINAL_STRATEGY_STATES.has(before))return {strategyId,ok:true,skipped:true,terminalState:before};
      try{await cancelIronbeamStrategy(strategyId);return {strategyId,ok:true};}
      catch(error){const terminalState=strategyStates.get(strategyId);if(TERMINAL_STRATEGY_STATES.has(terminalState))return {strategyId,ok:true,terminalState,skipped:terminalState!=='CANCELED'};return {strategyId,ok:false,error:String(error?.message||error).replace('IRONBEAM_ACK_TIMEOUT','STOP_STRATEGY timeout')};}
    }));
    const failed=results.filter(result=>!result.ok).length,canceled=results.filter(result=>result.ok&&(result.terminalState===undefined||result.terminalState==='CANCELED')).length;
    const result={ok:failed===0,provider:'ironbeam',requested:ids.length,canceled,failed,results};
    console.log(LOG,'Cancel All result',result);return result;
  }
  async function exitCancelIronbeam(){
    const cancelResult=await cancelAllIronbeamStrategies();if(!cancelResult.ok)throw new Error('IRONBEAM_EXIT_ABORTED_CANCEL_FAILURE');
    const positions=[...livePositions.values()].filter(position=>position.quantity!==0);
    const results=[];
    for(const position of positions){
      const latest=livePositions.get(`${position.account}|${position.symbol}`);if(!latest||latest.quantity===0){results.push({symbol:position.symbol,ok:true,skipped:true});continue;}
      const quantity=Math.abs(latest.quantity),side=latest.quantity>0?'Sell':'Buy',soeId=await openFreshOrderPanel();update({execution:'SUBMITTING'});
      const flatPromise=waitForMessage(payload=>netPositionUpdates(payload).some(next=>next.account===latest.account&&next.symbol===latest.symbol&&next.quantity===0),12000,'POSITION_FLAT_CONFIRMATION');
      const response=await submitMarketFlatten(soeId,{account:latest.account,symbol:latest.symbol,quantity,side});
      try{await flatPromise;results.push({symbol:latest.symbol,quantity,side,ok:true,strategyId:Number(response.STRATEGY_ID)||soeId});}
      catch(error){results.push({symbol:latest.symbol,quantity,side,ok:false,error:'POSITION_FLAT_CONFIRMATION_TIMEOUT'});}
    }
    const failed=results.filter(result=>!result.ok).length;update({execution:failed?'ERROR':'IDLE',error:failed?'IRONBEAM_EXIT_PARTIAL_FAILURE':null});
    return {ok:failed===0,provider:'ironbeam',cancellations:cancelResult,requested:positions.length,flattened:results.filter(result=>result.ok&&!result.skipped).length,failed,results};
  }
  chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
    if(message?.action==='GET_IRONBEAM_STATUS'){detectDomSymbol();detectDomAccountBalance();confirmVisibleFlatPosition();sendResponse({success:true,...normalized()});return false;}
    if(message?.action==='BIND_IRONBEAM_CONTEXT'){update({boundSymbol:String(message.symbol||'').toUpperCase()||null,account:message.account||state.account});sendResponse({success:true,...normalized()});return false;}
    if(message?.action==='GET_IRONBEAM_OUTBOUND_CAPTURE'){sendResponse({success:true,packets:structuredClone(outboundCapture)});return false;}
    if(message?.action==='CLEAR_IRONBEAM_OUTBOUND_CAPTURE'){outboundCapture.length=0;sendResponse({success:true,cleared:true});return false;}
    let operation;
    if(message?.action==='OPEN_IRONBEAM_ORDER_PANEL')operation=openFreshOrderPanel().then(soeId=>({success:true,soeId}));
    else if(message?.action==='PLACE_IRONBEAM_BRACKET')operation=placeIronbeamBracket(message.order||message);
    else if(message?.action==='PLACE_IRONBEAM_MARKETABLE_LIMIT')operation=placeIronbeamMarketableLimit(message.order||message);
    else if(message?.action==='CANCEL_IRONBEAM_STRATEGY')operation=cancelIronbeamStrategy(String(message.strategyId));
    else if(message?.action==='CANCEL_ALL_IRONBEAM_STRATEGIES')operation=cancelAllIronbeamStrategies().then(result=>({success:true,...result}));
    else if(message?.action==='EXIT_CANCEL_IRONBEAM')operation=exitCancelIronbeam().then(result=>({success:true,...result}));
    else return false;
    operation.then(sendResponse).catch(error=>sendResponse({success:false,error:String(error?.message||error),state:normalized()}));return true;
  });
  globalThis.placeIronbeamBracket=placeIronbeamBracket;globalThis.cancelIronbeamStrategy=cancelIronbeamStrategy;
  globalThis.ironbeamDebug={clearOutbound:()=>{outboundCapture.length=0;return true;},getOutbound:()=>structuredClone(outboundCapture)};
  globalThis.ironbeamAdapter={placeIronbeamBracket,placeIronbeamMarketableLimit,cancelIronbeamStrategy,cancelAllIronbeamStrategies,exitCancelIronbeam,getState:normalized};
  maintenanceInterval=setInterval(maintainOrderPanel,1500);setTimeout(maintainOrderPanel,500);
  console.log(LOG,'Content adapter loaded',STATES.join(' → '));
})();
