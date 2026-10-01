'use strict';

const LOG = '[TV Bridge]';
const SOCKET_URL = 'ws://127.0.0.1:8765';
const VERSION = '1.10.90';
const REQUIRED_TV_EXECUTION_PROTOCOL_VERSION = 2;
const HEARTBEAT_MS = 10000;
const CONNECTION_TIMEOUT_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 30000;
const DUPLICATE_TTL_MS = 10 * 60 * 1000;
// Both live legs are released only after an actual MNQ prop fill. The offset
// bounds slippage while keeping each limit immediately marketable.
// Ironbeam's market-data stream can legitimately publish in multi-second
// intervals, especially in quieter conditions. One second made healthy tabs
// fail arming between normal updates. Six seconds still rejects a disconnected
// or genuinely stale feed while keeping the marketable-limit guard in place.
// NNQ trades on a 0.5-point grid.  Keep the residual hedge marketable, but
// cap its worst entry at one index point beyond the fresh quote.
const NNQ_MARKETABLE_LIMIT = Object.freeze({ offsetPoints: 1, maxQuoteAgeMs: 6000, tickSize: 0.5 });
const HEDGE_TIMEOUT_RECONCILIATION = Object.freeze({ intervalMs: 500, maxAttempts: 12, maxPositionAgeMs: 5000 });
// TradingView can briefly render its account panel as empty while it is
// refreshing, switching tabs, or virtualizing the Positions rows.  That is
// not enough evidence to close a live hedge.  A sustained explicit empty
// Positions state is required before a prop-driven hedge exit is considered.
const PROP_FLAT_CONFIRMATION_MS = 30000;
const EXECUTION_AUDIT_STORAGE_KEY = 'hedgeOsExecutionAuditV1';
const EXECUTION_AUDIT_MAX_ENTRIES = 500;

let socket = null;
let reconnectTimer = null;
let connectTimer = null;
let heartbeatTimer = null;
let reconnectDelay = 1000;
let lastServerActivity = 0;
let executionQueue = Promise.resolve();
let ironbeamExecutionQueue = Promise.resolve();
let ironbeamAutoBindingQueue = Promise.resolve();
let quoteSourceTabId = null;
let quoteSourceLastSeen = 0;
const recentOrderIds = new Map();
const armedPropHedges = new Map();
let bridgeStatus = { appConnected: false, tradingViewDetected: false, orderPanelDetected: false, ready: false, execution: 'Connecting', error: null, bid: null, ask: null, last: null, accountBalance: null, unrealizedPnl: null, position: null, priceUpdatedAt: null, accountUpdatedAt: null };
let ironbeamStatus = { detected: false, ready: false, tabId: null, account: null, boundSymbol: null, socketReady: false, outboundTopic: null, currentSoeId: null, activeStrategyIds: [], execution: 'IDLE', error: null, extensionVersion: VERSION, lastCommand: null };
let lastIronbeamCommand = null;
let lastTradingViewReadinessFingerprint = '';
let lastTradingViewTargetDiagnostics = 'not inspected';
const reportedIronbeamContractDrifts = new Set();

const log = (...args) => console.log(LOG, ...args);
const warn = (...args) => console.warn(LOG, ...args);
const brokerId=(value)=>String(value??'').trim();
const sameBrokerId=(left,right)=>brokerId(left)!==''&&brokerId(left)===brokerId(right);

// Broker exports do not identify the local command that created an order.
// Keep a bounded, durable audit trail so every future order can be traced back
// to the app command, batch, strategy acknowledgement, and broker event.
function executionAudit(category, action, details = {}) {
  const event = {
    provider: 'ironbeam', type: 'execution_audit', category, action,
    observedAt: Date.now(), ...details,
  };
  chrome.storage.local.get(EXECUTION_AUDIT_STORAGE_KEY).then((stored) => {
    const prior = Array.isArray(stored[EXECUTION_AUDIT_STORAGE_KEY]) ? stored[EXECUTION_AUDIT_STORAGE_KEY] : [];
    return chrome.storage.local.set({ [EXECUTION_AUDIT_STORAGE_KEY]: [...prior, event].slice(-EXECUTION_AUDIT_MAX_ENTRIES) });
  }).catch((error) => warn('Execution audit persistence failed', error));
  console.info(LOG, 'Execution audit', event);
  send({ type: 'IRONBEAM_EVENT', event });
  return event;
}

function propExecutionAudit(action, details = {}) {
  const event={provider:'tradingview',type:'execution_audit',category:'prop_order',action,observedAt:Date.now(),...details};
  chrome.storage.local.get(EXECUTION_AUDIT_STORAGE_KEY).then((stored)=>{
    const prior=Array.isArray(stored[EXECUTION_AUDIT_STORAGE_KEY])?stored[EXECUTION_AUDIT_STORAGE_KEY]:[];
    return chrome.storage.local.set({[EXECUTION_AUDIT_STORAGE_KEY]:[...prior,event].slice(-EXECUTION_AUDIT_MAX_ENTRIES)});
  }).catch(error=>warn('Prop execution audit persistence failed',error));
  send({type:'IRONBEAM_EVENT',event});
  return event;
}

function broadcastStatus() {
  chrome.runtime.sendMessage({ type: 'BRIDGE_STATUS', status: bridgeStatus }).catch(() => {});
}

function updateStatus(patch) {
  bridgeStatus = { ...bridgeStatus, ...patch };
  broadcastStatus();
}

function send(payload) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(payload));
  return true;
}

function clearSocketTimers() {
  clearTimeout(connectTimer);
  clearInterval(heartbeatTimer);
  connectTimer = null;
  heartbeatTimer = null;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = reconnectDelay;
  reconnectDelay = Math.min(5000, Math.round(reconnectDelay * 1.7));
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connectWebSocket(); }, delay);
}

function disconnect(reason) {
  clearSocketTimers();
  const oldSocket = socket;
  socket = null;
  if (oldSocket && oldSocket.readyState < WebSocket.CLOSING) oldSocket.close();
  updateStatus({ appConnected: false, ready: false, execution: 'Not ready', error: reason });
  scheduleReconnect();
}

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  updateStatus({ appConnected: false, ready: false, execution: 'Connecting', error: null });
  log('Connecting to', SOCKET_URL);
  const ws = new WebSocket(SOCKET_URL);
  socket = ws;
  connectTimer = setTimeout(() => {
    if (socket === ws && ws.readyState !== WebSocket.OPEN) disconnect('APP_CONNECTION_TIMEOUT');
  }, CONNECTION_TIMEOUT_MS);

  ws.addEventListener('open', () => {
    if (socket !== ws) return;
    clearTimeout(connectTimer);
    connectTimer = null;
    reconnectDelay = 1000;
    lastServerActivity = Date.now();
    updateStatus({ appConnected: true, execution: bridgeStatus.ready ? 'Ready' : 'Not ready', error: null });
    log('WebSocket connected');
    send({ type: 'HELLO', source: 'tradingview-extension', version: VERSION });
    heartbeatTimer = setInterval(() => {
      if (Date.now() - lastServerActivity > HEARTBEAT_TIMEOUT_MS) return disconnect('APP_HEARTBEAT_TIMEOUT');
      send({ type: 'PING' });
    }, HEARTBEAT_MS);
    refreshTradingViewStatus();
  });

  ws.addEventListener('message', (event) => {
    if (socket !== ws) return;
    lastServerActivity = Date.now();
    let message;
    try { message = JSON.parse(event.data); }
    catch (_) { send({ type: 'PROTOCOL_ERROR', error: 'INVALID_JSON' }); return; }
    if (message.type === 'PING') return void send({ type: 'PONG' });
    if (message.type === 'APP_THEME') {
      if (message.theme === 'charcoal' || message.theme === 'ivory') {
        chrome.storage.local.set({ appTheme: message.theme }).catch(error => warn('Theme sync failed', error));
      }
      return;
    }
    if (message.type === 'PONG' || message.type === 'HELLO_ACK') return;
    if (message.type === 'PLACE_ORDER') receiveOrder(message);
    if (message.type === 'CANCEL_ALL') receiveCancelAll(message);
    if (message.provider === 'ironbeam') receiveIronbeamCommand(message);
  });
  ws.addEventListener('close', () => { if (socket === ws) disconnect('APP_DISCONNECTED'); });
  ws.addEventListener('error', () => { if (socket === ws) warn('WebSocket connection error'); });
}

async function findIronbeamTabs(){return chrome.tabs.query({url:['https://trade.ironbeam.com/*','https://trading.certigo.com/*','https://certigo.app/*']});}

async function inspectIronbeamTabs(){
  const tabs=await findIronbeamTabs();
  return Promise.all(tabs.map(async(tab)=>{
    let timer;
    try{
      const status=await Promise.race([
        chrome.tabs.sendMessage(tab.id,{action:'GET_IRONBEAM_STATUS'}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('IRONBEAM_TAB_STATUS_TIMEOUT')),3000);}),
      ]);
      return {tab,status};
    }
    catch(error){return {tab,status:null,error:String(error?.message||error)};}
    finally{clearTimeout(timer);}
  }));
}

const ironbeamRootSymbol=(symbol)=>String(symbol||'').trim().toUpperCase().replace(/^XCME:/,'').split('.')[0];
const ALLOWED_IRONBEAM_ROOTS=new Set(['MNQ','NNQ']);

async function getIronbeamBindings(){
  const stored=await chrome.storage.local.get(['ironbeamBindings','ironbeamBinding']);const bindings={...(stored.ironbeamBindings||{})};
  if(stored.ironbeamBinding?.tabId&&stored.ironbeamBinding?.symbol&&!bindings[String(stored.ironbeamBinding.symbol).toUpperCase()]){
    bindings[String(stored.ironbeamBinding.symbol).toUpperCase()]={...stored.ironbeamBinding,symbol:String(stored.ironbeamBinding.symbol).toUpperCase()};
    await chrome.storage.local.set({ironbeamBindings:bindings});await chrome.storage.local.remove('ironbeamBinding');
  }
  const byRoot={};for(const [key,binding] of Object.entries(bindings)){const root=ironbeamRootSymbol(binding.rootSymbol||binding.symbol||key);if(ALLOWED_IRONBEAM_ROOTS.has(root))byRoot[root]={...binding,rootSymbol:root,currentContract:binding.currentContract||binding.symbol||null,symbol:root};}
  if(JSON.stringify(bindings)!==JSON.stringify(byRoot))await chrome.storage.local.set({ironbeamBindings:byRoot});return byRoot;
}

// Keeping a tab non-discardable prevents Chrome's memory-saver from unloading
// its authenticated broker session. `system` keep-awake prevents an unattended
// desktop from sleeping mid-session, but deliberately does not steal focus or
// keep the display lit. Neither mechanism fakes page visibility.
async function protectIronbeamSessions(bindings){
  const entries=Object.values(bindings||{});
  if(entries.length){
    try{chrome.power?.requestKeepAwake('system');}catch(_){}
    await Promise.allSettled(entries.map(binding=>chrome.tabs.update(Number(binding.tabId),{autoDiscardable:false})));
  }else{
    try{chrome.power?.releaseKeepAwake();}catch(_){}
  }
}

async function bindIronbeamTab({tabId,symbol,account=null}){
  const currentContract=String(symbol||'').trim().toUpperCase(),normalizedSymbol=ironbeamRootSymbol(currentContract);if(!normalizedSymbol)throw new Error('IRONBEAM_BIND_SYMBOL_REQUIRED');
  if(!ALLOWED_IRONBEAM_ROOTS.has(normalizedSymbol))throw new Error('IRONBEAM_ONLY_MNQ_AND_NNQ_SUPPORTED');
  const bindings=await getIronbeamBindings(),numericTabId=Number(tabId);
  const conflicting=Object.values(bindings).find(binding=>binding.tabId===numericTabId&&binding.symbol!==normalizedSymbol);
  if(conflicting)throw new Error(`IRONBEAM_TAB_ALREADY_BOUND_TO_${conflicting.symbol}`);
  bindings[normalizedSymbol]={tabId:numericTabId,account:account||null,symbol:normalizedSymbol,rootSymbol:normalizedSymbol,currentContract};
  await chrome.storage.local.set({ironbeamBindings:bindings});
  await protectIronbeamSessions(bindings);
  await chrome.tabs.sendMessage(numericTabId,{action:'BIND_IRONBEAM_CONTEXT',symbol:currentContract,account:account||null});return bindings[normalizedSymbol];
}

async function refreshIronbeamStatus(){
  const inspected=await inspectIronbeamTabs();
  const bindings=await getIronbeamBindings(),entries=Object.values(bindings);
  const boundTabs=entries.map(binding=>{const item=inspected.find(candidate=>candidate.tab.id===binding.tabId),currentContract=item?.status?.detectedSymbol??null;return {...binding,account:item?.status?.account??binding.account??null,accountBalance:Number.isFinite(item?.status?.accountBalance)?item.status.accountBalance:null,accountBalanceUpdatedAt:item?.status?.accountBalanceUpdatedAt??null,currentContract,contractMatches:Boolean(currentContract&&ironbeamRootSymbol(currentContract)===binding.rootSymbol),detected:Boolean(item?.status),socketReady:Boolean(item?.status?.socketReady),outboundTopic:item?.status?.outboundTopic??null,execution:item?.status?.execution??'IDLE',executionUpdatedAt:item?.status?.executionUpdatedAt??null,lastBatchId:item?.status?.lastBatchId??null,activeStrategyIds:item?.status?.activeStrategyIds??[],error:item?.status?.error??null};});
  const balances=new Map();for(const item of boundTabs){if(Number.isFinite(item.accountBalance)){const key=item.account||`tab:${item.tabId}`;balances.set(key,item.accountBalance);}}
  const accountBalance=balances.size?[...balances.values()].reduce((sum,value)=>sum+value,0):null;
  const accountBalanceUpdatedAt=Math.max(0,...boundTabs.map(item=>Number(item.accountBalanceUpdatedAt)||0))||null;
  const selected=entries.length===1?inspected.find(item=>item.tab.id===entries[0].tabId):null;
  const status=selected?.status;
  ironbeamStatus={detected:inspected.some(item=>item.status),ready:boundTabs.length>0&&boundTabs.every(item=>item.socketReady&&item.outboundTopic&&item.contractMatches),tabId:selected?.tab.id??null,
    account:entries.length===1?(entries[0].account??status?.account??null):null,accountBalance,accountBalanceUpdatedAt,boundSymbol:entries.length===1?entries[0].symbol:null,boundTabs,
    discoveredTabs:inspected.map(item=>({tabId:item.tab.id,detected:Boolean(item.status),error:item.error??null,currentContract:item.status?.detectedSymbol??null})),
    socketReady:Boolean(status?.socketReady),outboundTopic:status?.outboundTopic??null,currentSoeId:status?.currentSoeId??null,
    activeStrategyIds:status?.activeStrategyIds??[],execution:status?.execution??'IDLE',lastObservedModify:status?.lastObservedModify??null,
    error:status?.error??(entries.length===0?'IRONBEAM_BINDING_REQUIRED':boundTabs.some(item=>!item.detected)?'IRONBEAM_BOUND_TAB_UNAVAILABLE':null),extensionVersion:VERSION,lastCommand:lastIronbeamCommand};
  send({type:'IRONBEAM_STATUS',...ironbeamStatus});broadcastStatus();return ironbeamStatus;
}

async function getBoundIronbeamTarget(symbol,tabId=null){
  const inspected=await inspectIronbeamTabs();
  const bindings=await getIronbeamBindings(),entries=Object.values(bindings);let binding=null;
  if(tabId!==null&&tabId!==undefined&&Number.isInteger(Number(tabId)))binding=entries.find(item=>item.tabId===Number(tabId))||null;
  else if(symbol)binding=bindings[ironbeamRootSymbol(symbol)]||null;
  else if(entries.length===1)binding=entries[0];
  else throw new Error(entries.length?'IRONBEAM_BINDING_AMBIGUOUS':'IRONBEAM_BINDING_REQUIRED');
  if(!binding)throw new Error(tabId?'IRONBEAM_TAB_NOT_BOUND':'IRONBEAM_SYMBOL_NOT_BOUND');
  const selected=inspected.find(item=>item.tab.id===binding.tabId);
  if(!selected?.status)throw new Error('IRONBEAM_TAB_UNAVAILABLE');
  if(!selected.status.account||String(selected.status.account)!==String(binding.account))throw new Error('IRONBEAM_ACCOUNT_REBIND_PENDING');
  const currentContract=selected.status.detectedSymbol;if(!currentContract)throw new Error('IRONBEAM_CURRENT_CONTRACT_NOT_DETECTED');
  if(ironbeamRootSymbol(currentContract)!==binding.rootSymbol)throw new Error('IRONBEAM_BOUND_ROOT_MISMATCH');
  if(symbol&&ironbeamRootSymbol(symbol)!==binding.rootSymbol)throw new Error('IRONBEAM_BOUND_SYMBOL_MISMATCH');
  if(!selected.status.socketReady||!selected.status.outboundTopic)throw new Error('IRONBEAM_SOCKET_OR_TOPIC_UNAVAILABLE');
  return {...selected,binding,currentContract};
}

function propRoot(symbol){return String(symbol||'').toUpperCase().replace(/^CME_MINI:/,'').match(/^(NQ|MNQ)/)?.[1]||null;}
function hedgePointValue(root){return root==='MNQ'?2:root==='NNQ'?.2:0;}
function validateArmedLegs(legs){
  if(!Array.isArray(legs)||!legs.length||legs.length>2)throw new Error('IRONBEAM_BATCH_REQUIRES_ONE_OR_TWO_LEGS');
  const roots=legs.map(leg=>ironbeamRootSymbol(leg?.symbol));
  if(new Set(roots).size!==roots.length||roots.some(root=>!ALLOWED_IRONBEAM_ROOTS.has(root)))throw new Error('IRONBEAM_BATCH_UNSUPPORTED_SYMBOL');
  for(const leg of legs){
    if(!['BUY','SELL'].includes(String(leg.side||'').toUpperCase()))throw new Error('IRONBEAM_BATCH_INVALID_SIDE');
    if(!Number.isInteger(Number(leg.quantity))||Number(leg.quantity)<=0)throw new Error('IRONBEAM_BATCH_INVALID_QUANTITY');
    for(const field of ['limitPrice','takeProfitOffset','stopLossOffset'])if(!Number.isFinite(Number(leg[field]))||Number(leg[field])<=0)throw new Error(`IRONBEAM_BATCH_INVALID_${field.toUpperCase()}`);
  }
  return roots;
}

async function armAfterPropFill(message){
  const prop=message.prop||{},roots=validateArmedLegs(message.legs);
  if(propRoot(prop.symbol)!=='MNQ'||!['BUY','SELL'].includes(String(prop.side||'').toUpperCase())||!Number.isInteger(Number(prop.quantity))||Number(prop.quantity)<=0)throw new Error('PROP_MNQ_ARMING_REQUIRED');
  // Do not guess which portion of an existing MNQ position belongs to this arm.
  if(bridgeStatus.position?.quantity>0)throw new Error('PROP_POSITION_MUST_BE_FLAT_BEFORE_ARMING');
  // The TradingView panel cannot cancel or flatten an individual historical
  // bracket.  A second arm must therefore retire every prior Hedge OS arm
  // before it may place anything new.  This makes the map a single-trade
  // ownership boundary: an old timer can never act on a later MNQ position.
  const previousArms=[...armedPropHedges.values()];
  if(previousArms.length)await Promise.allSettled(previousArms.map(armed=>retireArmedHedge(armed,'SUPERSEDED_BY_NEW_ARM')));
  // A small hedge can legitimately round to NNQ-only (for example, 5% of one
  // MNQ). Stage MNQ whenever it exists; otherwise stage that NNQ bracket as
  // the complete hedge instead of rejecting a valid executable mix.
  const stagedLeg=message.legs.find(leg=>ironbeamRootSymbol(leg.symbol)==='MNQ');
  // Refuse a new arm if the broker still reports exposure on either hedge
  // root. A replacement bracket must never be allowed to turn a prior fill
  // into a second, naked order merely because the UI appears flat.
  const boundTargets=await Promise.all(roots.map(root=>getBoundIronbeamTarget(root)));
  for(const target of boundTargets){
    const root=ironbeamRootSymbol(target.currentContract);
    if(target.status?.positionsFreshAfterReset!==true){
      executionAudit('position_guard','ARM_BLOCKED_POSITION_SNAPSHOT_REQUIRED',{root,requestedBatchId:message.id});
      throw new Error(`IRONBEAM_POSITION_SNAPSHOT_REQUIRED_${root}`);
    }
    const positions=Array.isArray(target.status?.positions)?target.status.positions:[];
    const live=positions.filter(position=>ironbeamRootSymbol(position?.symbol)===root).reduce((sum,position)=>sum+Math.abs(Number(position?.quantity)||0),0);
    if(live>0){
      executionAudit('position_guard','ARM_REJECTED_NONFLAT_BROKER_POSITION',{root,reportedQuantity:live,requestedBatchId:message.id});
      throw new Error(`IRONBEAM_POSITION_GUARD_NONFLAT_${root}:${live}`);
    }
  }
  const batchId=String(message.id);
  const hedgeEntryOffsetTicks=Math.max(1,Math.min(4,Math.round(Number(message.hedgeEntryOffsetTicks)||1)));
  const armed={batchId,prop:{symbol:'MNQ',side:String(prop.side).toUpperCase(),quantity:Number(prop.quantity)},legs:message.legs,timeoutMs:Math.max(500,Math.min(10000,Number(message.timeoutMs)||5000)),completionPercent:Math.max(1,Math.min(100,Number(message.completionPercent)||98)),hedgeEntryOffsetTicks,roots,stagedRoot:stagedLeg?ironbeamRootSymbol(stagedLeg.symbol):null,createdAt:Date.now(),triggered:false,nnqTriggered:false,propOpenSeen:false,actualPropQuantity:0,exitStarted:false,propFlatFirstSeenAt:null,propFlatLastSeenAt:null,propFlatTimer:null,timer:null,exitTimer:null,prePropFillTimer:null,filledByRoot:{},liveByRoot:{},strategyIds:[],strategyByRoot:{},executionTrace:{batchId,prop:{},legs:{}}};
  armedPropHedges.set(batchId,armed);
  try{
    // NNQ-only hedges have no staged broker order. The TradingView prop fill
    // is the trigger for their fresh-BBO marketable-limit release.
    if(!stagedLeg){
      emitHedgeLifecycle(armed,'NNQ_ONLY_WAITING_FOR_PROP_FILL');
      return {success:true,provider:'ironbeam',batchId,status:'NNQ_ONLY_WAITING_FOR_PROP_FILL',strategyId:null};
    }
    const stagedRoot=ironbeamRootSymbol(stagedLeg.symbol);
    const stagedTarget=await getBoundIronbeamTarget(stagedLeg.symbol);
    // Place the MNQ bracket alongside the prop bracket. A prop stop already
    // supplies the trigger, so its inverse hedge can rest as a price-capped
    // limit. A passive prop limit needs an inverse Stop Limit: its Aux/stop
    // price triggers the hedge, and its Price field caps the fill one tick
    // beyond that trigger. NNQ remains separately priced.
    const entryPrice=Number(stagedLeg.limitPrice);
    // Price-protect the matched MNQ hedge with a fixed, ticket-derived
    // offset.  Do not read or chase BBO here: the prop simulator is the
    // trigger, while this real order must have a known worst entry price.
    const fixedOffset=hedgeEntryOffsetTicks*0.25;
    const rawTrigger=String(stagedLeg.side).toUpperCase()==='BUY'?entryPrice+fixedOffset:entryPrice-fixedOffset;
    const stopPrice=(String(stagedLeg.side).toUpperCase()==='BUY'?Math.ceil(rawTrigger/0.25):Math.floor(rawTrigger/0.25))*0.25;
    const propOrderType=String(prop.orderType||'').toUpperCase();
    const orderType=propOrderType==='STOP'?'LIMIT':'STOP_LIMIT';
    const limitPrice=orderType==='STOP_LIMIT'
      ? (String(stagedLeg.side).toUpperCase()==='BUY'?stopPrice+0.25:stopPrice-0.25)
      : stopPrice;
    const triggerAdjustment=Math.abs(limitPrice-entryPrice);
    const matchedBracket={...stagedLeg,limitPrice,stopPrice:orderType==='STOP_LIMIT'?stopPrice:undefined,orderType,takeProfitOffset:Math.max(0.25,Number(stagedLeg.takeProfitOffset)-triggerAdjustment),stopLossOffset:Number(stagedLeg.stopLossOffset)+triggerAdjustment};
    armed.executionTrace.legs[stagedRoot]={side:stagedLeg.side,quantity:Number(stagedLeg.quantity),entryPrice,limitPrice,stopPrice:orderType==='STOP_LIMIT'?stopPrice:null,orderType,propOrderType,fixedOffsetTicks:hedgeEntryOffsetTicks,fixedOffsetPoints:fixedOffset,staged:true,t2:{at:Date.now(),source:`Extension staged ${stagedRoot} inverse ${orderType.toLowerCase()} at fixed ${hedgeEntryOffsetTicks}-tick ticket offset`}};
    emitExecutionTrace(armed,`T2_${stagedRoot}_MATCHED_BRACKET_STAGED`);
    const response=await chrome.tabs.sendMessage(stagedTarget.tab.id,{action:'PLACE_IRONBEAM_BRACKET',order:{...matchedBracket,symbol:stagedTarget.currentContract,batchId,legRole:`matched_${stagedRoot.toLowerCase()}_entry_bracket`}});
    if(!response?.success)throw new Error(`IRONBEAM_STAGED_HEDGE_REJECTED_PAIR_CANCELED:${String(response?.error||`IRONBEAM_${stagedRoot}_STAGED_BRACKET_SUBMISSION_FAILED`)}`);
    const strategyId=brokerId(response.strategyId);if(!strategyId)throw new Error(`IRONBEAM_${stagedRoot}_STAGED_STRATEGY_ID_MISSING`);
    armed.strategyIds.push(strategyId);armed.strategyByRoot[stagedRoot]=strategyId;
    armed.executionTrace.legs[stagedRoot].t3={at:Date.now(),source:`Ironbeam matched ${stagedRoot} bracket acknowledged`,strategyId};
    if(armed.executionTrace.legs[stagedRoot].pendingFillEvent){const pending=armed.executionTrace.legs[stagedRoot].pendingFillEvent;delete armed.executionTrace.legs[stagedRoot].pendingFillEvent;recordHedgeFillTrace(armed,pending);recordHedgeReceiptCompletion(armed,pending);}
    emitExecutionTrace(armed,`T3_${stagedRoot}_MATCHED_BRACKET_ACKNOWLEDGED`);
    emitHedgeLifecycle(armed,`${stagedRoot}_STAGED_WAITING_FOR_PROP_FILL`,{strategyId,orderType,propOrderType,entryPrice,limitPrice,stopPrice:orderType==='STOP_LIMIT'?stopPrice:null,fixedOffsetTicks:hedgeEntryOffsetTicks,fixedOffsetPoints:fixedOffset});
    return {success:true,provider:'ironbeam',batchId,status:`${stagedRoot}_STAGED_WAITING_FOR_PROP_FILL`,strategyId};
  }catch(error){
    armedPropHedges.delete(batchId);
    throw error;
  }
}

async function retireArmedHedge(armed,status,extra={}){
  if(!armed)return {success:true,skipped:true};
  // Retain ownership for cancellation retries, but stop releasing new legs.
  armed.exitStarted=true;
  if(armed.timer)clearTimeout(armed.timer);
  if(armed.exitTimer)clearTimeout(armed.exitTimer);
  if(armed.prePropFillTimer)clearTimeout(armed.prePropFillTimer);
  if(armed.propFlatTimer)clearTimeout(armed.propFlatTimer);
  // Only strategies acknowledged for this batch are ours to stop.  Never use
  // the account-wide Cancel All command here: it can stop manual work or a
  // subsequent trade that happens to use the same Ironbeam tab.
  const cancellations=await Promise.allSettled(Object.entries(armed.strategyByRoot||{}).map(async([root,strategyId])=>{
    const target=await getBoundIronbeamTarget(root);
    const response=await chrome.tabs.sendMessage(target.tab.id,{action:'CANCEL_IRONBEAM_STRATEGY',strategyId});
    if(!response?.success)throw new Error(`${root}:${response?.error||'IRONBEAM_CANCEL_UNCONFIRMED'}`);
    delete armed.strategyByRoot[root];
    return response;
  }));
  const failures=cancellations.filter(result=>result.status==='rejected');
  if(failures.length){
    const error=failures.map(result=>String(result.reason?.message||result.reason)).join('; ');
    emitHedgeLifecycle(armed,'CANCEL_INCOMPLETE',{...extra,error});
    throw new Error(`IRONBEAM_CANCEL_INCOMPLETE:${error}`);
  }
  armedPropHedges.delete(armed.batchId);
  emitHedgeLifecycle(armed,status,{...extra,cancelledOwnedStrategies:cancellations.map(result=>result.status==='fulfilled'?'ok':String(result.reason?.message||result.reason))});
  return {success:true,cancellations};
}

async function disarmAfterPropFill(message){
  const batchId=message.batchId?String(message.batchId):null;
  const entries=batchId?[armedPropHedges.get(batchId)].filter(Boolean):[...armedPropHedges.values()];
  for(const armed of entries)await retireArmedHedge(armed,'DISARMED');
  return {success:true,provider:'ironbeam',disarmed:entries.length};
}

function emitHedgeLifecycle(armed,status,extra={}){
  const event={provider:'ironbeam',type:'prop_hedge',status,batchId:armed.batchId,observedAt:Date.now(),...extra};
  armed.lifecycle=[...(armed.lifecycle||[]),event].slice(-30);
  console.warn(LOG,'Prop hedge lifecycle',event);
  executionAudit('lifecycle',status,{batchId:armed.batchId,...extra});
  send({type:'IRONBEAM_EVENT',event});
  return event;
}

function emitExecutionTrace(armed,phase){
  const event={provider:'ironbeam',type:'execution_trace',batchId:armed.batchId,phase,trace:structuredClone(armed.executionTrace||{}),observedAt:Date.now()};
  console.info(LOG,'Execution trace',event);
  executionAudit('trace',phase,{batchId:armed.batchId});
  send({type:'IRONBEAM_EVENT',event});
}

function recordHedgeFillTrace(armed,event){
  const root=ironbeamRootSymbol(event?.symbol),leg=armed.executionTrace?.legs?.[root];
  if(!leg||leg.t4)return;
  // An account can contain historical/manual fills for the same root.  Match
  // the strategy acknowledgement before attributing a fill to this batch.
  if(!leg.t3){leg.pendingFillEvent=structuredClone(event);return;}
  if(!sameBrokerId(event.strategyId,leg.t3.strategyId))return;
  const eventFillPrice=Number(event.averageFillPrice);
  const positionFillPrice=Number(leg.latestPositionAveragePrice);
  leg.t4={at:Number(event.observedAt)||Date.now(),source:Number.isFinite(eventFillPrice)?'Ironbeam fill event first observed':'Ironbeam fill event with position-derived average price',fillQuantity:Number(event.filledQuantity)||null,averageFillPrice:Number.isFinite(eventFillPrice)?eventFillPrice:(Number.isFinite(positionFillPrice)?positionFillPrice:null)};
  emitExecutionTrace(armed,`T4_${root}_FILL`);
}

function recordHedgeReceiptCompletion(armed,event){
  const root=ironbeamRootSymbol(event?.symbol),leg=armed.executionTrace?.legs?.[root];
  if(!leg?.t3||!sameBrokerId(event?.strategyId,leg.t3.strategyId))return false;
  const configured=armed.legs.find(item=>ironbeamRootSymbol(item.symbol)===root);
  if(!configured)return false;
  const reported=Number(event?.filledQuantity);
  // A strategy lifecycle event alone is not proof of an execution. Ironbeam
  // can report a terminal-looking event after a client stop, with quantity 0.
  // Count this leg only from a positive broker fill quantity; a missing
  // quantity must be confirmed by the current nonzero position snapshot.
  const quantity=Number.isFinite(reported)&&reported>0 ? reported : 0;
  if(!Number.isFinite(quantity)||quantity<=0)return false;
  armed.filledByRoot[root]=Math.max(Number(armed.filledByRoot[root]||0),quantity);
  // The broker-confirmed MNQ fill is the reliable trigger for releasing the
  // small NNQ residual.  It is not proof that the prop leg exists; prop
  // verification remains an independent safety signal.
  if(root==='MNQ') releaseNnqAfterMnqFill(armed).catch(error=>handleResidualHedgeReleaseFailure(armed,error));
  checkHedgeCompletion(armed);
  return true;
}

function recordHedgePositionPriceTrace(armed,event){
  const root=ironbeamRootSymbol(event?.symbol),leg=armed.executionTrace?.legs?.[root];
  const averagePrice=Number(event?.averagePrice);
  if(!leg||!Number.isFinite(averagePrice)||averagePrice<=0)return;
  leg.latestPositionAveragePrice=averagePrice;
  if(leg.t4&&!Number.isFinite(Number(leg.t4.averageFillPrice))){
    leg.t4.averageFillPrice=averagePrice;
    leg.t4.source='Ironbeam position snapshot supplied average price after fill event';
    emitExecutionTrace(armed,`T4_${root}_POSITION_PRICE`);
  }
}

async function emergencyFlatten(armed,reason,details={}){
  if(!armedPropHedges.has(armed.batchId))return;
  emitHedgeLifecycle(armed,'EMERGENCY_FLATTEN_STARTED',{reason,details});
  // Do not use TradingView's global CXL All / Flatten or Ironbeam's account-
  // wide exit here.  Those commands cannot be tied to a batch and were able
  // to flatten a later 30-MNQ prop position from an expired arm.  Stop only
  // the acknowledged strategies owned by this batch; if a filled leg needs
  // intervention, leave an explicit hold for the operator rather than
  // guessing which account position belongs to this batch.
  await retireArmedHedge(armed,'EMERGENCY_HOLDING_POSITION',{reason,details,action:'OWNED_STRATEGIES_STOPPED_NO_GLOBAL_FLATTEN'});
}

function checkHedgeCompletion(armed){
  const target=armed.legs.reduce((sum,leg)=>sum+Number(leg.quantity)*hedgePointValue(ironbeamRootSymbol(leg.symbol)),0);
  const actual=armed.legs.reduce((sum,leg)=>sum+Math.min(Number(leg.quantity),Number(armed.filledByRoot[ironbeamRootSymbol(leg.symbol)]||0))*hedgePointValue(ironbeamRootSymbol(leg.symbol)),0);
  if(target>0&&actual/target>=armed.completionPercent/100){if(armed.timer)clearTimeout(armed.timer);armed.timer=null;emitHedgeLifecycle(armed,'SYNCED',{completion:actual/target,source:'order_fill_event'});}
}

async function reconcileLiveHedgePositions(armed){
  const snapshots=await Promise.all(armed.roots.map(async root=>{
    try{
      const target=await getBoundIronbeamTarget(root);
      const status=await chrome.tabs.sendMessage(target.tab.id,{action:'GET_IRONBEAM_STATUS'});
      const positions=Array.isArray(status?.positions)?status.positions:[];
      const matching=positions.filter(position=>ironbeamRootSymbol(position?.symbol)===root);
      const latest=matching.sort((a,b)=>Number(b?.observedAt||0)-Number(a?.observedAt||0))[0]||null;
      const age=latest?Date.now()-Number(latest.observedAt||0):Infinity;
      const reliable=Boolean(status?.socketReady&&status?.outboundTopic&&latest&&Number.isFinite(Number(latest.quantity))&&age<=HEDGE_TIMEOUT_RECONCILIATION.maxPositionAgeMs);
      return {root,reliable,quantity:reliable?Math.abs(Number(latest.quantity)):null,averagePrice:reliable?Number(latest.averagePrice):null,observedAt:latest?.observedAt??null,age,statusError:status?.error??null};
    }catch(error){return {root,reliable:false,quantity:null,averagePrice:null,observedAt:null,age:null,statusError:String(error?.message||error)};}
  }));
  for(const snapshot of snapshots){
    if(!snapshot.reliable||snapshot.quantity===null)continue;
    const leg=armed.legs.find(item=>ironbeamRootSymbol(item.symbol)===snapshot.root);
    armed.liveByRoot[snapshot.root]=snapshot.quantity*(leg?.side==='BUY'?1:-1);
    armed.filledByRoot[snapshot.root]=Math.max(Number(armed.filledByRoot[snapshot.root]||0),snapshot.quantity);
  }
  const target=armed.legs.reduce((sum,leg)=>sum+Number(leg.quantity)*hedgePointValue(ironbeamRootSymbol(leg.symbol)),0);
  const actual=armed.legs.reduce((sum,leg)=>sum+Math.min(Number(leg.quantity),Number(armed.filledByRoot[ironbeamRootSymbol(leg.symbol)]||0))*hedgePointValue(ironbeamRootSymbol(leg.symbol)),0);
  return {reliable:snapshots.every(snapshot=>snapshot.reliable),completion:target>0?actual/target:0,target,actual,snapshots};
}

async function resolveHedgeCompletionTimeout(armed){
  if(!armedPropHedges.has(armed.batchId))return;
  const reconciliation=await reconcileLiveHedgePositions(armed);
  if(reconciliation.reliable&&reconciliation.completion>=armed.completionPercent/100){
    if(armed.timer)clearTimeout(armed.timer);armed.timer=null;
    emitHedgeLifecycle(armed,'SYNCED_AFTER_TIMEOUT_RECONCILIATION',{completion:reconciliation.completion,reconciliation});
    return;
  }
  if(reconciliation.reliable){
    await emergencyFlatten(armed,'HEDGE_INCOMPLETE_AFTER_CONFIRMED_POSITION_SNAPSHOT',reconciliation);
    return;
  }
  armed.timeoutAttempts=Number(armed.timeoutAttempts||0)+1;
  emitHedgeLifecycle(armed,'HEDGE_FILL_STATUS_UNCONFIRMED_RETRYING',{attempt:armed.timeoutAttempts,maxAttempts:HEDGE_TIMEOUT_RECONCILIATION.maxAttempts,reconciliation});
  if(armed.timeoutAttempts>=HEDGE_TIMEOUT_RECONCILIATION.maxAttempts){
    // Do not flatten a live pair just because a status snapshot is missing or
    // stale. A safety flatten is authorized only after both bound Ironbeam
    // tabs provide a current, reliable snapshot proving the hedge incomplete.
    // Keep reconciling and leave an explicit audit trail for the operator.
    emitHedgeLifecycle(armed,'HEDGE_STATUS_UNCONFIRMED_HOLDING_POSITION',{reconciliation});
    armed.timer=setTimeout(()=>{resolveHedgeCompletionTimeout(armed).catch(error=>warn('Hedge reconciliation retry failed',error));},2000);
    return;
  }
  armed.timer=setTimeout(()=>{resolveHedgeCompletionTimeout(armed).catch(error=>emergencyFlatten(armed,'HEDGE_RECONCILIATION_FAILURE',{error:String(error?.message||error)}).catch(()=>{}));},HEDGE_TIMEOUT_RECONCILIATION.intervalMs);
}

async function observePropFill(armed,actualQuantity,propObservation={}){
  if(armed.propOpenSeen)return;armed.propOpenSeen=true;armed.actualPropQuantity=actualQuantity;
  if(armed.prePropFillTimer){clearTimeout(armed.prePropFillTimer);armed.prePropFillTimer=null;}
  const receivedAt=Date.now();
  armed.executionTrace.prop={
    t0:{at:Number(propObservation.positionObservedAt)||receivedAt,source:'TradingView position first observed (broker-native fill timestamp unavailable)',quantity:actualQuantity,averageFillPrice:Number(propObservation.avgPrice)||null},
    t1:{at:receivedAt,source:'Extension received TradingView MNQ position'}
  };
  emitExecutionTrace(armed,'T0_T1_PROP_FILL_OBSERVED');
  emitHedgeLifecycle(armed,'PROP_FILLED_OBSERVED',{actualQuantity});
  if(!armed.legs.some(leg=>ironbeamRootSymbol(leg.symbol)==='MNQ')){
    releaseNnqAfterMnqFill(armed).catch(error=>handleResidualHedgeReleaseFailure(armed,error));
  }
}

async function releaseNnqAfterMnqFill(armed){
  if(armed.nnqTriggered||armed.exitStarted)return;
  const nnqLeg=armed.legs.find(leg=>ironbeamRootSymbol(leg.symbol)==='NNQ');
  const mnqLeg=armed.legs.find(leg=>ironbeamRootSymbol(leg.symbol)==='MNQ');
  const mnqFilled=Number(armed.filledByRoot.MNQ||0);
  // Do not compound a partial MNQ fill with the full NNQ remainder.  Wait
  // until the staged MNQ hedge is fully filled, then release NNQ once.
  if(mnqLeg && mnqFilled < Number(mnqLeg.quantity)) return;
  if(Number(armed.filledByRoot.NNQ||0)>0){armed.nnqTriggered=true;checkHedgeCompletion(armed);return;}
  armed.nnqTriggered=true;
  if(!nnqLeg){armed.timer=setTimeout(()=>resolveHedgeCompletionTimeout(armed).catch(error=>warn('Hedge completion reconciliation failed',error)),armed.timeoutMs);checkHedgeCompletion(armed);return;}
  const scale=mnqLeg ? Math.min(1,mnqFilled/Number(mnqLeg.quantity)) : 1;
  const quantity=Math.max(1,Math.round(Number(nnqLeg.quantity)*scale));
  const target=await getBoundIronbeamTarget(nnqLeg.symbol),quote=target.status?.marketQuote,age=Date.now()-Number(quote?.updatedAt||0);
  if(!quote||!Number.isFinite(quote.bid)||!Number.isFinite(quote.ask)||age>NNQ_MARKETABLE_LIMIT.maxQuoteAgeMs)throw new Error(`IRONBEAM_NNQ_QUOTE_STALE:${age||'unknown'}ms`);
  const limitPrice=marketableLimitPrice(String(nnqLeg.side).toUpperCase(),quote),transmittedAt=Date.now();
  armed.executionTrace.legs.NNQ={side:nnqLeg.side,quantity,quoteUsed:{bid:quote.bid,ask:quote.ask,updatedAt:quote.updatedAt,ageMs:age},limitPrice,t2:{at:transmittedAt,source:'Extension released NNQ marketable-limit after verified prop fill'}};
  emitExecutionTrace(armed,'T2_NNQ_RELEASED_AFTER_PROP_FILL');
  const response=await chrome.tabs.sendMessage(target.tab.id,{action:'PLACE_IRONBEAM_BRACKET',order:{...nnqLeg,symbol:target.currentContract,quantity,orderType:'LIMIT',limitPrice,batchId:armed.batchId,legRole:'nnq_after_verified_prop_fill',marketableLimit:true,marketableLimitTimeoutMs:armed.timeoutMs,quoteUsed:quote}});
  if(!response?.success)throw new Error(response?.error||'IRONBEAM_NNQ_MARKETABLE_LIMIT_SUBMISSION_FAILED');
  const strategyId=brokerId(response.strategyId);if(!strategyId)throw new Error('IRONBEAM_NNQ_STRATEGY_ID_MISSING');
  armed.strategyIds.push(strategyId);armed.strategyByRoot.NNQ=strategyId;
  armed.executionTrace.legs.NNQ.t3={at:Date.now(),source:'Ironbeam NNQ strategy submission acknowledged',strategyId};
  emitExecutionTrace(armed,'T3_NNQ_ACKNOWLEDGED');
  armed.timer=setTimeout(()=>resolveHedgeCompletionTimeout(armed).catch(error=>warn('Hedge completion reconciliation failed',error)),armed.timeoutMs);
  emitHedgeLifecycle(armed,'NNQ_RELEASED_AFTER_MNQ_FILL',{strategyId,quantity,limitPrice});
  checkHedgeCompletion(armed);
}

async function handleResidualHedgeReleaseFailure(armed,error){
  const reason=String(error?.message||error);
  if(!/IRONBEAM_NNQ_QUOTE_STALE/.test(reason)){
    warn('Residual hedge release failed',error);
    await emergencyFlatten(armed,reason);
    return;
  }
  // A stale quote is a data-health issue, not evidence of an incomplete hedge.
  // Never flatten a position for it. Retry briefly, then keep reconciliation
  // active and make the unresolved state explicit for the operator.
  armed.nnqTriggered=false;
  armed.nnqQuoteAttempts=Number(armed.nnqQuoteAttempts||0)+1;
  emitHedgeLifecycle(armed,'NNQ_QUOTE_STALE_RETRYING',{reason,attempt:armed.nnqQuoteAttempts,maxAttempts:12});
  if(armed.nnqQuoteAttempts>=12){
    emitHedgeLifecycle(armed,'NNQ_QUOTE_STALE_HOLDING_POSITION',{reason});
    return;
  }
  setTimeout(()=>{if(!armedPropHedges.has(armed.batchId)||armed.exitStarted)return;ironbeamExecutionQueue=ironbeamExecutionQueue.then(()=>releaseNnqAfterMnqFill(armed)).catch(nextError=>handleResidualHedgeReleaseFailure(armed,nextError));},500);
}

async function flattenLiveAfterPropExit(armed){
  if(armed.exitStarted)return;armed.exitStarted=true;if(armed.timer)clearTimeout(armed.timer);
  // Resolve every bound contract, quote, and broker position before stopping
  // even one strategy.  The old sequence stopped MNQ first, then discovered
  // that NNQ's contract was unavailable, leaving a one-sided partial exit.
  let prepared;
  try{
    prepared=await Promise.all(armed.roots.map(async root=>{
      const template=armed.legs.find(leg=>ironbeamRootSymbol(leg.symbol)===root);
      const target=await getBoundIronbeamTarget(root);
      const quote=target.status?.marketQuote,age=Date.now()-Number(quote?.updatedAt||0);
      if(!quote||!Number.isFinite(quote.bid)||!Number.isFinite(quote.ask)||age>NNQ_MARKETABLE_LIMIT.maxQuoteAgeMs)throw new Error(`IRONBEAM_${root}_QUOTE_STALE:${age||'unknown'}ms`);
      return {root,template,target,quote};
    }));
  }catch(error){
    const reason=String(error?.message||error);
    executionAudit('position_guard','PROP_EXIT_PREFLIGHT_BLOCKED',{batchId:armed.batchId,reason});
    emitHedgeLifecycle(armed,'PROP_EXIT_HOLDING_POSITION',{reason:`PREFLIGHT_BLOCKED:${reason}`});
    return;
  }
  const preparedByRoot=new Map(prepared.map(item=>[item.root,item]));
  const verified=prepared.map(({root,template,target,quote})=>{
    if(!template)return null;
    const positions=Array.isArray(target.status?.positions)?target.status.positions:[];
    const position=positions.filter(item=>ironbeamRootSymbol(item?.symbol)===root).sort((a,b)=>Number(b?.observedAt||0)-Number(a?.observedAt||0))[0]||null;
    const quantity=Number(position?.quantity);
    const expectedSign=template.side==='BUY'?1:-1;
    const expectedMax=Number(template.quantity);
    if(!Number.isFinite(quantity)||quantity===0||Math.sign(quantity)!==expectedSign||Math.abs(quantity)>expectedMax){
      executionAudit('position_guard','EXIT_BLOCKED_POSITION_MISMATCH',{batchId:armed.batchId,root,expectedSide:template.side,expectedMax,reportedQuantity:Number.isFinite(quantity)?quantity:null});
      return null;
    }
    executionAudit('position_guard','EXIT_POSITION_VERIFIED',{batchId:armed.batchId,root,reportedQuantity:quantity});
    return {...template,symbol:root,side:quantity>0?'SELL':'BUY',quantity:Math.abs(quantity),quote};
  });
  const legs=verified.filter(Boolean);
  if(!legs.length){
    emitHedgeLifecycle(armed,'PROP_EXIT_HOLDING_POSITION',{reason:'BROKER_POSITION_GUARD_BLOCKED_OR_UNCONFIRMED'});
    return;
  }
  const cancellations=await Promise.allSettled(Object.entries(armed.strategyByRoot||{}).map(async([root,strategyId])=>{
    const target=preparedByRoot.get(root)?.target;
    if(!target)throw new Error(`IRONBEAM_${root}_EXIT_PREFLIGHT_MISSING`);
    const response=await chrome.tabs.sendMessage(target.tab.id,{action:'CANCEL_IRONBEAM_STRATEGY',strategyId});
    if(!response?.success)throw new Error(response?.error||`IRONBEAM_${root}_STRATEGY_STOP_FAILED`);
    return response;
  }));
  if(cancellations.some(result=>result.status==='rejected')){
    const reason=cancellations.filter(result=>result.status==='rejected').map(result=>String(result.reason?.message||result.reason)).join(';');
    executionAudit('position_guard','PROP_EXIT_STRATEGY_STOP_BLOCKED',{batchId:armed.batchId,reason});
    emitHedgeLifecycle(armed,'PROP_EXIT_HOLDING_POSITION',{reason:`STRATEGY_STOP_BLOCKED:${reason}`});
    return;
  }
  send({type:'IRONBEAM_EVENT',event:{provider:'ironbeam',type:'prop_hedge',status:'PROP_EXIT_HEDGES_FLATTENING',batchId:armed.batchId,observedAt:Date.now()}});
  const results=await Promise.allSettled(legs.map(async leg=>{const target=preparedByRoot.get(ironbeamRootSymbol(leg.symbol))?.target;if(!target)throw new Error(`IRONBEAM_${ironbeamRootSymbol(leg.symbol)}_EXIT_PREFLIGHT_MISSING`);const response=await chrome.tabs.sendMessage(target.tab.id,{action:'PLACE_IRONBEAM_MARKETABLE_LIMIT',order:{...leg,symbol:target.currentContract,limitPrice:marketableLimitPrice(leg.side,leg.quote),batchId:armed.batchId,legRole:'prop_exit_marketable_limit',marketableLimitTimeoutMs:armed.timeoutMs}});if(!response?.success)throw new Error(response?.error||'IRONBEAM_EXIT_MARKETABLE_LIMIT_FAILED');return response;}));
  if(results.some(result=>result.status==='rejected'))send({type:'IRONBEAM_EVENT',event:{provider:'ironbeam',type:'prop_hedge',status:'PROP_EXIT_HEDGE_SUBMISSION_PARTIAL',batchId:armed.batchId,observedAt:Date.now()}});
  armed.exitTimer=setTimeout(()=>{if(!armedPropHedges.has(armed.batchId))return;emergencyFlatten(armed,'PROP_EXIT_HEDGE_TIMEOUT').catch(error=>warn('Exit emergency flatten failed',error));},armed.timeoutMs);
}

function observePropPosition(position,propObservation={}){
  const isMnq=propRoot(position?.symbol)==='MNQ'&&Number.isFinite(position?.quantity)&&position.quantity>0;
  for(const armed of armedPropHedges.values()){
    // A position on the same contract and side is not enough evidence: it
    // could belong to a previous/manual order.  This arm only owns the exact
    // quantity it submitted.
    if(isMnq){
      if(armed.propFlatTimer)clearTimeout(armed.propFlatTimer);
      armed.propFlatTimer=null;armed.propFlatFirstSeenAt=null;armed.propFlatLastSeenAt=null;
      // TradingView may publish a partial/normalized quantity while the
      // position row is already visibly open.  Requiring exact equality here
      // can strand an NNQ-only hedge forever.  The arm starts flat, so any
      // positive MNQ position on the armed side is sufficient evidence to
      // trigger the residual NNQ release; the release scales to the observed
      // quantity when applicable.
      const reportedQuantity=Number(position.quantity);
      const sideMatches=(position.side==='LONG')===(armed.prop.side==='BUY');
      if(!armed.propOpenSeen&&reportedQuantity>0&&sideMatches)ironbeamExecutionQueue=ironbeamExecutionQueue.then(()=>observePropFill(armed,reportedQuantity,{...propObservation,avgPrice:position.avgPrice})).catch(error=>{warn('Prop-fill hedge release failed',error);emergencyFlatten(armed,String(error?.message||error)).catch(()=>{});});
      continue;
    }
    if(!armed.propOpenSeen||armed.exitStarted)continue;
    // No parsed position is UNKNOWN, not flat. An automatic exit is allowed
    // only after TradingView explicitly reports an empty Positions view for a
    // sustained, fresh confirmation window.
    if(propObservation.positionEvidence!=='FLAT'){
      if(armed.propFlatTimer)clearTimeout(armed.propFlatTimer);
      armed.propFlatTimer=null;armed.propFlatFirstSeenAt=null;armed.propFlatLastSeenAt=null;
      continue;
    }
    const now=Date.now();armed.propFlatLastSeenAt=now;
    if(!armed.propFlatFirstSeenAt){
      armed.propFlatFirstSeenAt=now;
      emitHedgeLifecycle(armed,'PROP_FLAT_CANDIDATE',{source:propObservation.source||'unknown',confirmationWindowMs:PROP_FLAT_CONFIRMATION_MS});
      armed.propFlatTimer=setTimeout(()=>{
        const fresh=Number(armed.propFlatLastSeenAt||0)>=Date.now()-2000;
        if(!armedPropHedges.has(armed.batchId)||armed.exitStarted||!fresh)return;
        emitHedgeLifecycle(armed,'PROP_EXIT_CONFIRMED_AFTER_STABLE_FLAT',{flatObservedForMs:Date.now()-Number(armed.propFlatFirstSeenAt)});
        ironbeamExecutionQueue=ironbeamExecutionQueue.then(()=>flattenLiveAfterPropExit(armed)).catch(error=>{warn('Confirmed prop-exit hedge flatten failed',error);emergencyFlatten(armed,String(error?.message||error)).catch(()=>{});});
      },PROP_FLAT_CONFIRMATION_MS);
    }
  }
}

async function executeIronbeamCommand(message){
  if(message.action==='get_execution_audit'){
    const stored=await chrome.storage.local.get(EXECUTION_AUDIT_STORAGE_KEY);
    return {success:true,entries:Array.isArray(stored[EXECUTION_AUDIT_STORAGE_KEY])?stored[EXECUTION_AUDIT_STORAGE_KEY]:[]};
  }
  if(message.action==='arm_after_prop_fill')return armAfterPropFill(message);
  if(message.action==='disarm_after_prop_fill')return disarmAfterPropFill(message);
  if(message.action==='place_bracket_batch')return executeIronbeamBracketBatch(message);
  const symbol=String(message.symbol||'').toUpperCase();
  const target=await getBoundIronbeamTarget(symbol,message.tabId);
  if(message.account&&target.binding.account&&String(message.account)!==String(target.binding.account))throw new Error('IRONBEAM_BOUND_ACCOUNT_MISMATCH');
  const action=message.action==='place_bracket'?'PLACE_IRONBEAM_BRACKET':message.action==='cancel_strategy'?'CANCEL_IRONBEAM_STRATEGY':message.action==='cancel_all'?'CANCEL_ALL_IRONBEAM_STRATEGIES':message.action==='exit_cancel'?'EXIT_CANCEL_IRONBEAM':message.action;
  const routedMessage=message.action==='place_bracket'?{...message,symbol:target.currentContract}:message;
  const response=await chrome.tabs.sendMessage(target.tab.id,{action,order:routedMessage,strategyId:message.strategyId});
  if(!response?.success)throw new Error(response?.error||'IRONBEAM_COMMAND_FAILED');
  return response;
}

async function executeIronbeamBracketBatch(message){
  const legs=Array.isArray(message.legs)?message.legs:[];
  if(!legs.length||legs.length>2)throw new Error('IRONBEAM_BATCH_REQUIRES_ONE_OR_TWO_LEGS');
  const roots=legs.map(leg=>ironbeamRootSymbol(leg?.symbol));
  if(new Set(roots).size!==roots.length)throw new Error('IRONBEAM_BATCH_DUPLICATE_ROOT');
  if(roots.some(root=>!ALLOWED_IRONBEAM_ROOTS.has(root)))throw new Error('IRONBEAM_BATCH_UNSUPPORTED_SYMBOL');
  for(const leg of legs){
    if(!['BUY','SELL'].includes(String(leg.side||'').toUpperCase()))throw new Error('IRONBEAM_BATCH_INVALID_SIDE');
    if(!Number.isInteger(Number(leg.quantity))||Number(leg.quantity)<=0)throw new Error('IRONBEAM_BATCH_INVALID_QUANTITY');
    for(const field of ['limitPrice','takeProfitOffset','stopLossOffset'])if(!Number.isFinite(Number(leg[field]))||Number(leg[field])<=0)throw new Error(`IRONBEAM_BATCH_INVALID_${field.toUpperCase()}`);
    if(!['LIMIT','STOP','STOP_LIMIT'].includes(String(leg.orderType||'').toUpperCase()))throw new Error('IRONBEAM_BATCH_INVALID_ORDER_TYPE');
    if(String(leg.orderType||'').toUpperCase()==='STOP_LIMIT'&&(!Number.isFinite(Number(leg.stopPrice))||Number(leg.stopPrice)<=0))throw new Error('IRONBEAM_BATCH_INVALID_STOP_PRICE');
  }
  const targets=await Promise.all(legs.map(leg=>getBoundIronbeamTarget(leg.symbol)));
  if(new Set(targets.map(target=>target.tab.id)).size!==targets.length)throw new Error('IRONBEAM_BATCH_TAB_COLLISION');
  const immediateIndexes=legs.map((_,index)=>index);
  const submissions=await Promise.allSettled(immediateIndexes.map(index=>chrome.tabs.sendMessage(targets[index].tab.id,{
    action:'PLACE_IRONBEAM_BRACKET',order:{...legs[index],symbol:targets[index].currentContract,batchId:message.id,legRole:'hedge'}
  })));
  const results=submissions.map((settled,submissionIndex)=>{
    const index=immediateIndexes[submissionIndex];
    if(settled.status==='rejected')return {rootSymbol:roots[index],tabId:targets[index].tab.id,ok:false,error:String(settled.reason?.message||settled.reason)};
    if(!settled.value?.success)return {rootSymbol:roots[index],tabId:targets[index].tab.id,ok:false,error:settled.value?.error||'IRONBEAM_COMMAND_FAILED'};
    const strategyId=brokerId(settled.value.strategyId);
    if(!strategyId)return {rootSymbol:roots[index],tabId:targets[index].tab.id,ok:false,error:'IRONBEAM_STRATEGY_ID_MISSING'};
    return {rootSymbol:roots[index],tabId:targets[index].tab.id,ok:true,strategyId,symbol:targets[index].currentContract};
  });
  if(results.some(result=>!result.ok)){
    const rollback=await Promise.allSettled(results.filter(result=>result.ok&&result.strategyId).map(result=>chrome.tabs.sendMessage(result.tabId,{action:'CANCEL_IRONBEAM_STRATEGY',strategyId:result.strategyId})));
    const rollbackFailed=rollback.some(item=>item.status==='rejected'||!item.value?.success);
    const failures=results.filter(result=>!result.ok).map(result=>`${result.rootSymbol}:${result.error||'UNKNOWN'}`).join(',');
    throw new Error(`${rollbackFailed?'IRONBEAM_BATCH_PARTIAL_SUBMISSION_ROLLBACK_FAILED':'IRONBEAM_BATCH_PARTIAL_SUBMISSION_ROLLED_BACK'}:${failures}`);
  }
  return {success:true,provider:'ironbeam',role:'hedge',batchId:message.id,requested:legs.length,submitted:results.length,deferred:0,results};
}

function marketableLimitPrice(side,quote){
  const raw=side==='BUY'?quote.ask+NNQ_MARKETABLE_LIMIT.offsetPoints:quote.bid-NNQ_MARKETABLE_LIMIT.offsetPoints;
  const ticks=raw/NNQ_MARKETABLE_LIMIT.tickSize;
  return (side==='BUY'?Math.ceil(ticks):Math.floor(ticks))*NNQ_MARKETABLE_LIMIT.tickSize;
}

async function submitDeferredNnq(event){
  if(event?.type!=='order_fill'||event?.status!=='FILLED')return;
  const deferred=deferredNnqByMnqStrategy.get(String(event.strategyId));
  if(!deferred||Number(event.tabId)!==Number(deferred.mnqTabId))return;
  deferredNnqByMnqStrategy.delete(String(event.strategyId));
  const target=await getBoundIronbeamTarget('NNQ');
  const quote=target.status?.marketQuote,quoteAge=Date.now()-Number(quote?.updatedAt||0);
  if(!quote||!Number.isFinite(quote.bid)||!Number.isFinite(quote.ask)||quoteAge>NNQ_MARKETABLE_LIMIT.maxQuoteAgeMs)throw new Error(`NNQ_MARKETABLE_LIMIT_QUOTE_STALE:${quoteAge||'unknown'}ms`);
  const side=String(deferred.order.side||'').toUpperCase();
  if(!['BUY','SELL'].includes(side))throw new Error('NNQ_MARKETABLE_LIMIT_INVALID_SIDE');
  const limitPrice=marketableLimitPrice(side,quote);
  const response=await chrome.tabs.sendMessage(target.tab.id,{action:'PLACE_IRONBEAM_BRACKET',order:{...deferred.order,symbol:target.currentContract,orderType:'LIMIT',limitPrice,batchId:deferred.batchId,legRole:'deferred_nnq_marketable_limit',marketableLimit:true,marketableLimitTimeoutMs:2000,quoteUsed:{bid:quote.bid,ask:quote.ask,updatedAt:quote.updatedAt}}});
  if(!response?.success)throw new Error(response?.error||'NNQ_MARKETABLE_LIMIT_SUBMISSION_FAILED');
  send({type:'IRONBEAM_EVENT',tabId:target.tab.id,event:{provider:'ironbeam',type:'deferred_hedge',status:'NNQ_SUBMITTED',strategyId:Number(response.strategyId)||null,symbol:target.currentContract,limitPrice,quoteUsed:{bid:quote.bid,ask:quote.ask,updatedAt:quote.updatedAt},observedAt:Date.now()}});
}

function receiveIronbeamCommand(message){
  if(!message.id||typeof message.id!=='string')return void send({id:message.id,type:'IRONBEAM_RESULT',ok:false,provider:'ironbeam',error:'INVALID_ORDER_ID'});
  pruneRecentIds();
  if(recentOrderIds.has(message.id))return void send({id:message.id,type:'IRONBEAM_RESULT',ok:false,provider:'ironbeam',error:'DUPLICATE_COMMAND_ID'});
  recentOrderIds.set(message.id,Date.now());
  lastIronbeamCommand={id:message.id,action:message.action,receivedAt:Date.now(),roots:Array.isArray(message.legs)?message.legs.map(leg=>leg?.symbol):[message.symbol].filter(Boolean)};
  executionAudit('command_received',String(message.action||'unknown'),{commandId:message.id,batchId:message.id,roots:lastIronbeamCommand.roots,quantity:message.quantity??null,strategyId:message.strategyId??null});
  send({id:message.id,type:'IRONBEAM_RECEIVED',provider:'ironbeam',action:message.action});
  ironbeamExecutionQueue=ironbeamExecutionQueue.then(async()=>{
    try{const response=await executeIronbeamCommand(message);executionAudit('command_result',String(message.action||'unknown'),{commandId:message.id,batchId:message.id,ok:true,strategyId:response?.strategyId??null});send({id:message.id,type:'IRONBEAM_RESULT',ok:true,provider:'ironbeam',...response});}
    catch(error){const errorText=String(error?.message||error);executionAudit('command_result',String(message.action||'unknown'),{commandId:message.id,batchId:message.id,ok:false,error:errorText});send({id:message.id,type:'IRONBEAM_RESULT',ok:false,provider:'ironbeam',error:errorText});}
    finally{await refreshIronbeamStatus();}
  }).catch(error=>warn('[Ironbeam] Queue error',error));
}

function pruneRecentIds() {
  const cutoff = Date.now() - DUPLICATE_TTL_MS;
  for (const [id, timestamp] of recentOrderIds) if (timestamp < cutoff) recentOrderIds.delete(id);
}

function validateOrder(message) {
  if (!message.id || typeof message.id !== 'string') return 'INVALID_ORDER_ID';
  // The prop leg is deliberately MNQ-only.  NQ/MBT remain valid concepts in
  // the research UI, but they must never reach the TradingView execution
  // bridge: a stale chart or legacy command must fail closed instead of
  // creating an oversized mini-NQ position.
  if (String(message.symbol || '').toUpperCase() !== 'MNQ') return 'PROP_MNQ_ONLY';
  if (!['BUY', 'SELL'].includes(String(message.side || '').toUpperCase())) return 'INVALID_SIDE';
  for (const field of ['quantity', 'entryPrice', 'takeProfit', 'stopLoss']) {
    if (!Number.isFinite(Number(message[field])) || Number(message[field]) <= 0) return `INVALID_${field.toUpperCase()}`;
  }
  const side = String(message.side).toUpperCase();
  const entry = Number(message.entryPrice);
  const tp = Number(message.takeProfit);
  const sl = Number(message.stopLoss);
  if ((side === 'BUY' && !(tp > entry && sl < entry)) ||
      (side === 'SELL' && !(tp < entry && sl > entry))) return 'INVALID_BRACKET_PRICES';
  return null;
}

function receiveOrder(message) {
  pruneRecentIds();
  const validationError = validateOrder(message);
  if (validationError) return void send({ id: message.id, type: 'ORDER_ERROR', error: validationError });
  if (recentOrderIds.has(message.id)) return void send({ id: message.id, type: 'ORDER_DUPLICATE' });
  recentOrderIds.set(message.id, Date.now());
  propExecutionAudit('ORDER_RECEIVED',{commandId:message.id,symbol:message.symbol,side:message.side,quantity:Number(message.quantity),entryPrice:Number(message.entryPrice),takeProfit:Number(message.takeProfit),stopLoss:Number(message.stopLoss)});
  send({ id: message.id, type: 'ORDER_RECEIVED' });
  log('Received order', message.id);
  executionQueue = executionQueue.then(() => executeQueuedOrder(message)).catch((error) => warn('Queue error', error));
}

function receiveCancelAll(message) {
  pruneRecentIds();
  if (!message.id || typeof message.id !== 'string') return void send({ type: 'CANCEL_ERROR', error: 'INVALID_ORDER_ID' });
  if (recentOrderIds.has(message.id)) return void send({ id: message.id, type: 'ORDER_DUPLICATE' });
  recentOrderIds.set(message.id, Date.now());
  propExecutionAudit('CANCEL_REQUESTED',{commandId:message.id,flatten:message.flatten===true});
  send({ id: message.id, type: 'CANCEL_RECEIVED' });
  executionQueue = executionQueue.then(() => executeQueuedCancel(message)).catch((error) => warn('Queue error', error));
}

async function findTradingViewTabs() {
  return chrome.tabs.query({ url: ['https://*.tradingview.com/chart/*'] });
}

async function getUsableTradingViewTarget(requestedSymbol) {
  const tabs = await findTradingViewTabs();
  if (!tabs.length) throw Object.assign(new Error('TRADINGVIEW_NOT_FOUND'), { code: 'TRADINGVIEW_NOT_FOUND' });
  const statuses = await Promise.all(tabs.map(async (tab) => {
    try { return { tab, status: await chrome.tabs.sendMessage(tab.id, { action: 'GET_EXECUTION_STATUS' }) }; }
    catch (_) { return { tab, status: null }; }
  }));
  const compatible = statuses.filter(({ status }) => status?.executionProtocolVersion === REQUIRED_TV_EXECUTION_PROTOCOL_VERSION);
  lastTradingViewTargetDiagnostics=statuses.length?statuses.map(({tab,status})=>`tab ${tab.id}: active=${Boolean(tab.active)}, response=${Boolean(status)}, protocol=${String(status?.executionProtocolVersion??'none')}, panel=${Boolean(status?.orderPanelDetected)}, ticket=${Boolean(status?.orderTicketDetected)}, DOM=${Boolean(status?.domDetected)}, broker=${Boolean(status?.brokerConnected)}, ready=${Boolean(status?.ready)}, symbol=${String(status?.displayedSymbol??status?.symbol??'unknown')}`).join('; '):'no TradingView chart tabs found';
  if (!requestedSymbol) {
    return compatible.find(({ tab, status }) => tab.active && status?.ready) ||
      compatible.find(({ status }) => status?.ready) || null;
  }
  const matching = compatible.filter(({ status }) => status?.symbol === requestedSymbol);
  return matching.find(({ tab, status }) => tab.active && status?.ready) ||
    matching.find(({ status }) => status?.ready) || null;
}

function classifyExecutionError(error) {
  if (error.code) return error.code;
  const message = String(error.message || error);
  if (/broker.*connected/i.test(message)) return 'BROKER_NOT_CONNECTED';
  if (/order ticket|order panel/i.test(message)) return 'ORDER_PANEL_NOT_FOUND';
  if (/selected side|side control/i.test(message)) return 'SIDE_SELECTION_FAILED';
  if (/quantity/i.test(message)) return 'QUANTITY_SET_FAILED';
  if (/entry price|price input read-back/i.test(message)) return 'ENTRY_PRICE_SET_FAILED';
  if (/take profit|\bTP\b/i.test(message)) return 'TP_SET_FAILED';
  if (/stop loss|\bSL\b/i.test(message)) return 'SL_SET_FAILED';
  if (/identify TradingView order submit button/i.test(message)) return 'SUBMIT_BUTTON_NOT_FOUND';
  if (/must be|only MNQ|unsupported|invalid|equals the current market/i.test(message)) return 'INVALID_ORDER';
  return 'SUBMIT_FAILED';
}

async function executeQueuedOrder(message) {
  updateStatus({ execution: 'Executing', error: null });
  try {
    const target = await getUsableTradingViewTarget(String(message.symbol).toUpperCase());
    if (!target) throw Object.assign(new Error(`ORDER_PANEL_NOT_FOUND (${lastTradingViewTargetDiagnostics})`), { code: 'ORDER_PANEL_NOT_FOUND' });
    log('Sent order to TradingView content script', message.id);
    const result = await chrome.tabs.sendMessage(target.tab.id, {
      action: 'PLACE_BRACKET_ORDER', id: message.id, symbol: String(message.symbol).toUpperCase(),
      side: String(message.side).toUpperCase(), quantity: Number(message.quantity),
      entryPrice: Number(message.entryPrice), takeProfit: Number(message.takeProfit), stopLoss: Number(message.stopLoss)
    });
    if (!result?.success) throw Object.assign(new Error(result?.message || 'SUBMIT_FAILED'), {
      code: result?.code, requested: result?.requested, current: result?.current
    });
    propExecutionAudit('ORDER_SUBMITTED',{commandId:message.id,symbol:message.symbol,side:result.side,quantity:result.quantity,entryPrice:result.entryPrice,orderType:result.orderType,takeProfit:result.takeProfit,stopLoss:result.stopLoss});
    send({ id: message.id, type: 'ORDER_SUBMITTED', side: result.side, quantity: result.quantity,
      entryPrice: result.entryPrice, orderType: result.orderType, takeProfit: result.takeProfit, stopLoss: result.stopLoss });
    log('Result sent to desktop app', message.id);
  } catch (error) {
    propExecutionAudit('ORDER_REJECTED',{commandId:message.id,error:String(error?.message||error)});
    const response = { id: message.id, type: 'ORDER_ERROR', error: classifyExecutionError(error), message: error.message };
    if (error.requested) response.requested = error.requested;
    if (error.current) response.current = error.current;
    send(response);
  } finally {
    await refreshTradingViewStatus();
  }
}

async function executeQueuedCancel(message) {
  updateStatus({ execution: 'Cancelling', error: null });
  try {
    const target = await getUsableTradingViewTarget('MNQ');
    if (!target) throw Object.assign(new Error(`ORDER_PANEL_NOT_FOUND (${lastTradingViewTargetDiagnostics})`), { code: 'ORDER_PANEL_NOT_FOUND' });
    const result = await chrome.tabs.sendMessage(target.tab.id, { action: 'CANCEL_ALL_ORDERS', flatten: message.flatten === true, expectedSymbol: 'MNQ' });
    if (!result?.success) throw Object.assign(new Error(result?.message || 'CANCEL_FAILED'), { code: result?.code });
    propExecutionAudit('CANCEL_CONFIRMED',{commandId:message.id,flatten:message.flatten===true,result:result.message});
    send({ id: message.id, type: 'ORDERS_CANCELLED', message: result.message });
  } catch (error) {
    propExecutionAudit('CANCEL_FAILED',{commandId:message.id,flatten:message.flatten===true,error:String(error?.message||error)});
    send({ id: message.id, type: 'CANCEL_ERROR', error: error.code || 'CANCEL_FAILED', message: error.message });
  } finally {
    await refreshTradingViewStatus();
  }
}

async function refreshTradingViewStatus() {
  try {
    const tabs = await findTradingViewTabs();
    const statuses = await Promise.all(tabs.map(async (tab) => {
      try { return { tab, reply: await chrome.tabs.sendMessage(tab.id, { action: 'GET_EXECUTION_STATUS' }) }; }
      catch (_) { return { tab, reply: null }; }
    }));
    const replies = statuses.map(({ reply }) => reply);
    const detected = replies.some((reply) => reply?.tradingViewDetected);
    const panel = replies.some((reply) => reply?.orderPanelDetected);
    const compatibleStatuses=statuses.filter(({reply})=>reply?.executionProtocolVersion===REQUIRED_TV_EXECUTION_PROTOCOL_VERSION);
    const readyReply = compatibleStatuses.find(({ tab, reply }) => tab.active && reply?.ready)?.reply ||
      compatibleStatuses.find(({reply}) => reply?.ready)?.reply || null;
    // Quote updates normally carry position transitions, but a broker-side
    // bracket exit can race that publisher. Poll the same position parser as
    // a fallback so a confirmed flat prop account always initiates the owned
    // live-hedge exit path.
    if(readyReply&&Object.prototype.hasOwnProperty.call(readyReply,'position')){
      const position=readyReply.position||null;
      bridgeStatus={...bridgeStatus,position,positionEvidence:readyReply.positionEvidence||'UNKNOWN'};
      observePropPosition(position,{positionObservedAt:readyReply.positionObservedAt,receivedAt:Date.now(),source:'status_poll',positionEvidence:readyReply.positionEvidence||'UNKNOWN'});
    }
    const ready = bridgeStatus.appConnected && Boolean(readyReply);
    const readiness={
      reason:ready?'READY':!bridgeStatus.appConnected?'APP_DISCONNECTED':!tabs.length?'TRADINGVIEW_TAB_NOT_FOUND':!detected?'CONTENT_SCRIPT_UNAVAILABLE':!compatibleStatuses.length?'STALE_CONTENT_SCRIPT':!panel?'ORDER_PANEL_NOT_DETECTED':'NO_COMPATIBLE_READY_TAB',
      requiredProtocolVersion:REQUIRED_TV_EXECUTION_PROTOCOL_VERSION,
      tabCount:tabs.length,
      compatibleTabCount:compatibleStatuses.length,
      tabs:statuses.map(({tab,reply})=>({tabId:tab.id,active:Boolean(tab.active),responded:Boolean(reply),protocolVersion:reply?.executionProtocolVersion??null,tradingViewDetected:Boolean(reply?.tradingViewDetected),orderPanelDetected:Boolean(reply?.orderPanelDetected),orderTicketDetected:Boolean(reply?.orderTicketDetected),domDetected:Boolean(reply?.domDetected),brokerConnected:Boolean(reply?.brokerConnected),ready:Boolean(reply?.ready),symbol:reply?.symbol??null,displayedSymbol:reply?.displayedSymbol??null}))
    };
    const readinessFingerprint=JSON.stringify(readiness);
    if(readinessFingerprint!==lastTradingViewReadinessFingerprint){lastTradingViewReadinessFingerprint=readinessFingerprint;log('Readiness',readiness);}
    updateStatus({ tradingViewDetected: detected, orderPanelDetected: panel, ready, readiness, extensionVersion:VERSION,
      execution: ready ? 'Ready' : (bridgeStatus.appConnected ? 'Not ready' : bridgeStatus.execution), error: ready ? null : readiness.reason });
    send({ type: 'STATUS', extensionVersion:VERSION, appConnected: bridgeStatus.appConnected, tradingViewDetected: detected, orderPanelDetected: panel, ready,
      readiness,
      symbol: readyReply?.symbol || null, displayedSymbol: readyReply?.displayedSymbol || null,
      symbolSource: readyReply?.symbolSource || null, bid: bridgeStatus.bid, ask: bridgeStatus.ask,
      last: bridgeStatus.last, timestamp: bridgeStatus.priceUpdatedAt, lastSource:bridgeStatus.lastSource,
      accountBalance:bridgeStatus.accountBalance,unrealizedPnl:bridgeStatus.unrealizedPnl,position:bridgeStatus.position,
      accountUpdatedAt:bridgeStatus.accountUpdatedAt });
  } catch (error) {
    updateStatus({ tradingViewDetected: false, orderPanelDetected: false, ready: false, execution: 'Not ready', error: error.message });
  }
  return bridgeStatus;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if(message?.type==='IRONBEAM_EVENT'&&_sender.tab?.id){
    const event={...(message.event||{}),tabId:_sender.tab.id};
    if(event.type==='execution_audit'){
      // Content scripts observe the actual MQTT command leaving the browser.
      // Persist it before forwarding so a reload or extension worker restart
      // cannot erase the evidence.
      const storedEvent={...event,type:'execution_audit'};
      chrome.storage.local.get(EXECUTION_AUDIT_STORAGE_KEY).then((stored)=>{
        const prior=Array.isArray(stored[EXECUTION_AUDIT_STORAGE_KEY])?stored[EXECUTION_AUDIT_STORAGE_KEY]:[];
        return chrome.storage.local.set({[EXECUTION_AUDIT_STORAGE_KEY]:[...prior,storedEvent].slice(-EXECUTION_AUDIT_MAX_ENTRIES)});
      }).catch(error=>warn('Broker request audit persistence failed',error));
    }
    if(['order_fill','order_state'].includes(String(event.type))){
      executionAudit('broker_event',String(event.status||event.type),{
        tabId:_sender.tab.id,strategyId:event.strategyId??null,orderRecordId:event.orderRecordId??null,
        symbol:event.symbol??null,side:event.orderSide??null,orderType:event.orderType??null,
        quantity:event.orderQuantity??null,filledQuantity:event.filledQuantity??null,
        averageFillPrice:event.averageFillPrice??null,limitPrice:event.limitPrice??null,stopPrice:event.stopPrice??null,
        brokerError:event.brokerError??null,
      });
    }
    send({type:'IRONBEAM_EVENT',tabId:_sender.tab.id,event});
    if(event.type==='order_fill')for(const armed of armedPropHedges.values()){
      const root=ironbeamRootSymbol(event.symbol);
      if(!armed.roots.includes(root))continue;
      recordHedgeFillTrace(armed,event);
      recordHedgeReceiptCompletion(armed,event);
    }
    if(event.type==='order_state'&&String(event.status||'').toUpperCase()==='REJECTED')for(const armed of [...armedPropHedges.values()]){
      const strategyId=brokerId(event.strategyId),owned=armed.strategyIds.some(id=>sameBrokerId(id,strategyId));
      if(!owned)continue;
      executionAudit('pair_safety','HEDGE_ENTRY_REJECTED',{batchId:armed.batchId,strategyId,root:ironbeamRootSymbol(event.symbol),symbol:event.symbol??null,side:event.orderSide??null,orderType:event.orderType??null,limitPrice:event.limitPrice??null,stopPrice:event.stopPrice??null,brokerError:event.brokerError??null});
      retireArmedHedge(armed,'HEDGE_ENTRY_REJECTED',{strategyId}).catch(()=>{});
      send({type:'IRONBEAM_EVENT',event:{provider:'ironbeam',type:'prop_hedge',status:'HEDGE_ENTRY_REJECTED',batchId:armed.batchId,strategyId,observedAt:Date.now()}});
    }
    if(event.type==='position_state')for(const armed of armedPropHedges.values()){
      const root=ironbeamRootSymbol(event.symbol);if(!armed.roots.includes(root))continue;
      const quantity=Number(event.quantity);if(!Number.isFinite(quantity))continue;
      // Ironbeam position feeds may publish an absolute quantity. The original
      // hedge side is authoritative for this one-direction pair lifecycle.
      const entryLeg=armed.legs.find(leg=>ironbeamRootSymbol(leg.symbol)===root);
      armed.liveByRoot[root]=Math.abs(quantity)*(entryLeg?.side==='BUY'?1:-1);
      recordHedgePositionPriceTrace(armed,event);
      if(armed.exitStarted&&armed.roots.every(item=>Math.abs(Number(armed.liveByRoot[item]||0))<1e-9)){
        if(armed.exitTimer)clearTimeout(armed.exitTimer);armedPropHedges.delete(armed.batchId);
        send({type:'IRONBEAM_EVENT',event:{provider:'ironbeam',type:'prop_hedge',status:'BOTH_SIDES_FLAT',batchId:armed.batchId,observedAt:Date.now()}});
      }
    }
    sendResponse({ok:true});return false;
  }
  if(message?.type==='IRONBEAM_AUTO_DETECTED'&&_sender.tab?.id){
    ironbeamAutoBindingQueue=ironbeamAutoBindingQueue.catch(()=>{}).then(async()=>{
      const tabId=_sender.tab.id;
      const symbol=String(message.symbol||'').toUpperCase();
      const root=ironbeamRootSymbol(symbol);
      if(!['MNQ','NNQ'].includes(root))throw new Error('IRONBEAM_UNSUPPORTED_SYMBOL');
      const bindings=await getIronbeamBindings();
      const existingTabBinding=Object.values(bindings).find(binding=>Number(binding.tabId)===Number(tabId))||null;
      // Ironbeam workspaces can synchronize their selected instrument across
      // same-origin tabs. A changed UI symbol is never permission to silently
      // retarget a live hedge binding. Preserve the configured tab/root pair
      // and make the drift explicit so no order can be routed to the wrong leg.
      if(existingTabBinding&&existingTabBinding.rootSymbol!==root){
        const expected=String(existingTabBinding.rootSymbol),driftKey=`${tabId}:${expected}:${root}`;
        const error=`IRONBEAM_BOUND_CONTRACT_CHANGED:expected_${expected}_got_${root}`;
        if(!reportedIronbeamContractDrifts.has(driftKey)){
          reportedIronbeamContractDrifts.add(driftKey);
          warn('Ironbeam bound contract drift', {tabId,expected,actual:root,symbol});
          send({type:'IRONBEAM_EVENT',tabId,event:{provider:'ironbeam',type:'contract_drift',status:'BOUND_CONTRACT_CHANGED',expectedRoot:expected,actualRoot:root,actualSymbol:symbol,observedAt:Date.now()}});
        }
        await refreshIronbeamStatus();
        return {ok:false,error,expectedRoot:expected,actualRoot:root,currentContract:symbol};
      }
      const existing=bindings[root];
      if(existing&&existing.tabId!==tabId){
        let existingStatus=null;
        try{existingStatus=await chrome.tabs.sendMessage(existing.tabId,{action:'GET_IRONBEAM_STATUS'});}catch(_){}
        const existingRoot=ironbeamRootSymbol(existingStatus?.detectedSymbol);
        if(existingStatus?.success&&existingRoot===root)throw new Error(`IRONBEAM_${root}_ALREADY_BOUND_TO_ANOTHER_LIVE_TAB`);
        delete bindings[root];
      }
      await chrome.storage.local.set({ironbeamBindings:bindings});
      await bindIronbeamTab({tabId,symbol,account:message.account||(existing?.tabId===tabId?existing.account:null)||null});
      return {ok:true,rootSymbol:root,currentContract:symbol};
    });
    ironbeamAutoBindingQueue.then(sendResponse).catch(error=>sendResponse({ok:false,error:error?.message||String(error)}));
    return true;
  }
  if(message?.type==='IRONBEAM_TEST_ORDER'){
    const command={id:crypto.randomUUID(),provider:'ironbeam',action:'place_bracket',...(message.order||{})};
    ironbeamExecutionQueue=ironbeamExecutionQueue.then(async()=>{
      const tabId=Number(message.tabId);if(!Number.isInteger(tabId))throw new Error('IRONBEAM_ACTIVE_TAB_MISSING');
      let status;try{status=await chrome.tabs.sendMessage(tabId,{action:'GET_IRONBEAM_STATUS'});}catch(_){throw new Error('IRONBEAM_ADAPTER_NOT_INJECTED_RELOAD_TAB');}
      if(!status?.success)throw new Error('IRONBEAM_TAB_UNAVAILABLE');
      await bindIronbeamTab({tabId,account:status.account||null,symbol:String(command.symbol||'').toUpperCase()});command.tabId=tabId;
      return executeIronbeamCommand(command);
    }).then(response=>sendResponse({success:true,...response})).catch(error=>sendResponse({success:false,error:String(error?.message||error)}));return true;
  }
  if(message?.type==='IRONBEAM_CANCEL_ALL'){
    ironbeamExecutionQueue=ironbeamExecutionQueue.then(()=>executeIronbeamCommand({id:crypto.randomUUID(),provider:'ironbeam',action:'cancel_all',tabId:Number(message.tabId)})).then(response=>sendResponse({success:true,...response})).catch(error=>sendResponse({success:false,error:String(error?.message||error)}));return true;
  }
  if(message?.type==='IRONBEAM_EXIT_CANCEL'){
    ironbeamExecutionQueue=ironbeamExecutionQueue.then(()=>executeIronbeamCommand({id:crypto.randomUUID(),provider:'ironbeam',action:'exit_cancel',tabId:Number(message.tabId)})).then(response=>sendResponse({success:true,...response})).catch(error=>sendResponse({success:false,error:String(error?.message||error)}));return true;
  }
  if(message?.type==='IRONBEAM_GET_CAPTURE'||message?.type==='IRONBEAM_CLEAR_CAPTURE'){
    getBoundIronbeamTarget('',Number(message.tabId)).then(target=>chrome.tabs.sendMessage(target.tab.id,{action:message.type==='IRONBEAM_GET_CAPTURE'?'GET_IRONBEAM_OUTBOUND_CAPTURE':'CLEAR_IRONBEAM_OUTBOUND_CAPTURE'})).then(sendResponse).catch(error=>sendResponse({success:false,error:String(error?.message||error)}));return true;
  }
  if(message?.type==='IRONBEAM_BIND_TAB'){
    (async()=>{
      const tabId=Number(message.tabId);let status;
      try{status=await chrome.tabs.sendMessage(tabId,{action:'GET_IRONBEAM_STATUS'});}catch(_){throw new Error('IRONBEAM_ADAPTER_NOT_INJECTED_RELOAD_TAB');}
      if(!status?.success)throw new Error('IRONBEAM_TAB_UNAVAILABLE');
      const symbol=message.symbol||status.detectedSymbol;if(!symbol)throw new Error('IRONBEAM_SYMBOL_NOT_UNIQUE_OR_NOT_VISIBLE');
      await bindIronbeamTab({tabId,account:message.account||status.account||null,symbol});return refreshIronbeamStatus();
    })().then(sendResponse).catch(error=>sendResponse({success:false,error:String(error?.message||error)}));return true;
  }
  if(message?.type==='IRONBEAM_UNBIND'){
    getIronbeamBindings().then(async bindings=>{
      if(message.symbol)delete bindings[ironbeamRootSymbol(message.symbol)];
      else if(message.tabId){for(const [symbol,binding] of Object.entries(bindings)){if(binding.tabId===Number(message.tabId))delete bindings[symbol];}}
      await chrome.storage.local.set({ironbeamBindings:bindings});await protectIronbeamSessions(bindings);return refreshIronbeamStatus();
    }).then(sendResponse);return true;
  }
  if(message?.type==='GET_IRONBEAM_BRIDGE_STATUS'){refreshIronbeamStatus().then(sendResponse).catch(error=>sendResponse({error:String(error?.message||error)}));return true;}
  if (message?.type === 'QUOTE_UPDATE' && _sender.tab?.id) {
    const now = Date.now();
    const sourceIsStale = now - quoteSourceLastSeen > 3500;
    // Prefer the visible TradingView tab, and automatically abandon a tab
    // whose timers were frozen/discarded. The old permanent first-tab lock
    // could leave prices on Waiting forever while execution stayed Ready.
    if (quoteSourceTabId === null || sourceIsStale || _sender.tab.active) {
      quoteSourceTabId = _sender.tab.id;
    }
    if (_sender.tab.id !== quoteSourceTabId) return false;
    quoteSourceLastSeen = now;
    const accountPatch={};
    if(Number.isFinite(message.accountBalance))accountPatch.accountBalance=message.accountBalance;
    if(Number.isFinite(message.unrealizedPnl))accountPatch.unrealizedPnl=message.unrealizedPnl;
    if(Object.keys(accountPatch).length)accountPatch.accountUpdatedAt=message.timestamp;
    updateStatus({ bid: Number.isFinite(message.bid)?message.bid:null, ask: Number.isFinite(message.ask)?message.ask:null,
      last: Number.isFinite(message.last)?message.last:null, lastSource:message.lastSource, priceUpdatedAt: message.timestamp,
      ...accountPatch, position:message.position || null, positionEvidence:message.positionEvidence||'UNKNOWN',
      symbol: message.symbol, displayedSymbol: message.displayedSymbol });
    observePropPosition(message.position,{positionObservedAt:message.positionObservedAt,receivedAt:now,source:'quote_update',positionEvidence:message.positionEvidence||'UNKNOWN'});
    send({ type: 'QUOTE', bid: Number.isFinite(message.bid)?message.bid:null,
      ask: Number.isFinite(message.ask)?message.ask:null, last: Number.isFinite(message.last)?message.last:null,
      accountBalance:Number.isFinite(message.accountBalance)?message.accountBalance:null,
      unrealizedPnl:Number.isFinite(message.unrealizedPnl)?message.unrealizedPnl:null, position:message.position || null,
      timestamp: message.timestamp, lastSource:message.lastSource, symbol: message.symbol, displayedSymbol: message.displayedSymbol });
    sendResponse?.({ received: true });
    return false;
  }
  if (message?.type === 'GET_BRIDGE_STATUS') { refreshTradingViewStatus().then(sendResponse); return true; }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId)=>{
  if(tabId===quoteSourceTabId){quoteSourceTabId=null;quoteSourceLastSeen=0;}
});
chrome.tabs.onUpdated.addListener((tabId,changeInfo)=>{
  if(tabId===quoteSourceTabId&&changeInfo.url&&!/^https:\/\/[^/]*tradingview\.com\/chart\//i.test(changeInfo.url)){
    quoteSourceTabId=null;quoteSourceLastSeen=0;
  }
});
chrome.tabs.onActivated.addListener(async ({tabId})=>{
  try {
    const tab=await chrome.tabs.get(tabId);
    if(/^https:\/\/[^/]*tradingview\.com\/chart\//i.test(tab.url||'')) {
      quoteSourceTabId=tabId;
      quoteSourceLastSeen=0;
      chrome.tabs.sendMessage(tabId,{action:'PUBLISH_QUOTES'}).catch(()=>{});
    }
  } catch (_) {}
});

connectWebSocket();
getIronbeamBindings().then(protectIronbeamSessions).catch(error=>warn('Unable to protect Ironbeam sessions',error));
setInterval(refreshTradingViewStatus, 3000);
setInterval(()=>refreshIronbeamStatus().catch(error=>warn('[Ironbeam] Status refresh failed',error)),3000);
