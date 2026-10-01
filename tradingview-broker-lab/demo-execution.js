// Runs only through chrome.scripting in the explicitly selected chart tab.
async function demoExecution(action, input = {}) {
  try {
  const KEY='__hedgeBrokerLabDemoTestV1';
  const symbol='CME_MINI:MNQZ2026';
  const t=window.TradingView?.bottomWidgetBar?._widgetControllers?.get('paper_trading')?._trading;
  let b=t?.activeBroker?.();
  if(b && typeof b.value==='function')b=b.value();
  if(!b)throw Error('No broker');
  async function verify(){
    // Use whichever broker/account is currently active in the TradingView
    // tab. The lab is intentionally account-agnostic; the caller controls
    // whether that session is Paper Trading or a demo broker.
    let current=t.activeBroker();if(current && typeof current.value==='function')current=current.value();
    if(current!==b)throw Error('Broker changed');
  }
  await verify();
  const account=String(await b.currentAccount?.()||'unknown');
  function chartQuote(side){
    const read=(el)=>{const m=String(el?.textContent||'').replace(/,/g,'').match(/\b\d{4,6}(?:\.\d+)?\b/);return m?Number(m[0]):null;};
    const buy=document.querySelector('[data-name="side-control-buy"]'),sell=document.querySelector('[data-name="side-control-sell"]');
    const value=read(side===1?buy:sell); if(Number.isFinite(value))return value;
    const text=document.body.innerText.replace(/,/g,''); const values=[...text.matchAll(/\b3\d{4}(?:\.\d+)?\b/g)].map(m=>Number(m[0]));
    return values.length?values[0]:null;
  }
  let s=window[KEY];
  const clean=o=>o?Object.fromEntries(['id','symbol','side','qty','type','status','limitPrice','avgPrice'].map(k=>[k,o[k]??null])):null;
  const read=async()=>{const [orders,positions,history]=await Promise.all([b.orders(),b.positions(),typeof b.ordersHistory==='function'?b.ordersHistory():[]]);if(!Array.isArray(orders)||!Array.isArray(positions))throw Error('Invalid snapshot');return {orders,positions,history:Array.isArray(history)?history:[]};};
  if(action==='inspect'){
    const snap=await read();
    const quote=chartQuote(1);
    const positions=snap.positions.map(position=>{
      const row=clean(position); const side=Number(position?.side)===1?1:-1;
      const avg=Number(position?.avgPrice), qty=Number(position?.qty);
      const brokerPnl=Number(position?.unrealizedPnl??position?.pnl??position?.profit);
      const brokerLast=Number(position?.lastPrice??position?.currentPrice??position?.markPrice);
      return {...row,unrealizedPnl:Number.isFinite(brokerPnl)?brokerPnl:(Number.isFinite(quote)&&Number.isFinite(avg)&&Number.isFinite(qty)?(quote-avg)*qty*2*side:null),currentPrice:Number.isFinite(brokerLast)?brokerLast:(Number.isFinite(quote)?quote:null)};
    });
    const accountInfo={};
    for(const key of ['equity','balance','accountBalance','unrealizedPnl','realizedPnl']) if(typeof b[key]==='function'){try{accountInfo[key]=await b[key]();}catch(_) {}}
    return {at:Date.now(),account:String(await b.currentAccount?.()||'unknown'),accountType:String(await b.currentAccountType?.()||'unknown'),broker:String(b._brokerMetainfo?.id||'unknown'),quote,accountInfo,session:s?{...s}:null,positions,activeOrders:snap.orders.filter(o=>![1,2,5].includes(Number(o.status))).map(clean),recentHistory:snap.history.slice(-20).map(clean)};
  }
  if(s?.busy)throw Error('Test operation is already pending; inspect first');
  if(action==='place'){
    if(s)throw Error('A test session already exists. Inspect it; no automatic resubmission.');
    if(![1,-1].includes(input.side)||!['limit','market'].includes(input.kind))throw Error('Invalid test');
    if(input.kind==='limit'&&(!Number.isFinite(input.price)||input.price<=0||Math.abs(input.price*4-Math.round(input.price*4))>1e-8))throw Error('Limit price must be positive and on a 0.25 tick');
    const snap=await read();
    if(snap.positions.length||snap.orders.some(o=>![1,2,5].includes(Number(o.status))))throw Error('Demo account must have no positions or active orders');
    await verify();
    s=window[KEY]={busy:true,state:'submitting',account,symbol,side:input.side,qty:1,kind:input.kind,price:input.price??null,orderId:null,startedAt:Date.now()};
    const before=new Set(snap.orders.map(o=>String(o.id)));
    try{
      const response=await b.placeOrder({symbol,side:input.side,qty:1,type:input.kind==='limit'?1:2,...(input.kind==='limit'?{limitPrice:input.price}:{})});
      const responseId=response?.orderId??response?.id;
      if(responseId!=null)s.orderId=String(responseId);
      for(let i=0;i<16;i++){
        await verify();
        const next=await read();
        const matches=next.orders.filter(o=>!before.has(String(o.id))&&o.symbol===symbol&&Number(o.side)===input.side&&Number(o.qty)===1&&(s.orderId?String(o.id)===s.orderId:Number(o.type)===(input.kind==='limit'?1:2)&&(input.kind!=='limit'||Number(o.limitPrice)===input.price)));
        if(matches.length===1){s.orderId=String(matches[0].id);s.order=clean(matches[0]);s.state='broker_status_'+matches[0].status;return {...s,busy:false};}
        if(matches.length>1)throw Error('Ambiguous order matches');
        await new Promise(r=>setTimeout(r,500));
      }
      s.state='submission_unconfirmed';return {...s,busy:false};
    }catch(e){s.state='submission_uncertain';throw e;}finally{s.busy=false;}
  }
  if(action==='placeBracket'){
    if(s && !['cancel_confirmed','flat_confirmed'].includes(s.state))throw Error('A test session already exists. Inspect it; no automatic resubmission.');
    if(s && ['cancel_confirmed','flat_confirmed'].includes(s.state))s=window[KEY]=null;
    const tp=Number(input.takeProfit),sl=Number(input.stopLoss);
    if(!Number.isFinite(tp)||!Number.isFinite(sl)||tp<=0||sl<=0)throw Error('Take-profit and stop-loss prices are required');
    const snap=await read();
    if(snap.positions.length||snap.orders.some(o=>![1,2,5].includes(Number(o.status))))throw Error('Demo account must have no positions or active orders');
    const market=chartQuote(input.side);
    if(!Number.isFinite(market))throw Error('Could not read the live TradingView quote');
    const bracketType=Math.abs(Number(input.price)-market)<=0.125?1:(input.side===1?(Number(input.price)>market?3:1):(Number(input.price)<market?3:1));
    if(bracketType===1&&(!Number.isFinite(input.price)||input.price<=0))throw Error('A limit bracket requires an entry price');
    s=window[KEY]={busy:true,state:'submitting_bracket',account,symbol,side:input.side,qty:1,kind:bracketType===1?'limit_bracket':'market_bracket',price:input.price??null,takeProfit:tp,stopLoss:sl,orderId:null,startedAt:Date.now()};
    const before=new Set(snap.orders.map(o=>String(o.id)));
    try{
      const response=await b.placeOrder({symbol,side:input.side,qty:1,type:bracketType,...(bracketType===1?{limitPrice:input.price}:{stopPrice:input.price}),takeProfit:tp,stopLoss:sl});
      const responseId=response?.orderId??response?.id;if(responseId!=null)s.orderId=String(responseId);
      for(let i=0;i<16;i++){await verify();const next=await read();const matches=next.orders.filter(o=>!before.has(String(o.id))&&o.symbol===symbol&&Number(o.side)===input.side&&Number(o.qty)===1);if(matches.length){s.orderId=String(matches[0].id);s.orders=matches.map(clean);const position=next.positions.find(p=>p.symbol===symbol&&Number(p.side)===input.side&&Number(p.qty)===1);s.position=position?clean(position):null;s.state='bracket_entry_confirmed';return {...s,busy:false};}await new Promise(r=>setTimeout(r,500));}
      s.state='bracket_submission_unconfirmed';return {...s,busy:false};
    }catch(e){s.state='bracket_submission_uncertain';throw e;}finally{s.busy=false;}
  }
  if(!s?.orderId||s.account!==account)throw Error('No identified lab order');
  s.busy=true;
  try{
    const snap=await read(), owned=snap.orders.find(o=>String(o.id)===s.orderId);
    if(!owned||owned.symbol!==symbol||Number(owned.side)!==s.side||Number(owned.qty)!==1)throw Error('Owned order mismatch');
    await verify();
    if(action==='cancel'){
      if(Number(owned.status)!==6)throw Error('Order is not working; inspect status');
      await b.cancelOrder(s.orderId);
    }else if(action==='close'){
      if(Number(owned.status)!==2)throw Error('Lab order is not confirmed filled');
      const p=snap.positions;
      if(p.length!==1||p[0].symbol!==symbol||Number(p[0].qty)!==1||Number(p[0].side)!==s.side)throw Error('Position does not match the one-contract lab fill');
      const exits=snap.orders.filter(o=>String(o.id)!==s.orderId&&!([1,2,5].includes(Number(o.status))));
      for(const exit of exits){await b.cancelOrder(String(exit.id));}
      if(s.closeAttempted)throw Error('Close already attempted; inspect rather than retry');
      s.closeAttempted=true;
      await b.closePosition(p[0].id);
    }else throw Error('Unknown action');
    for(let i=0;i<16;i++){
      await verify();const after=await read();
      const order=after.orders.find(o=>String(o.id)===s.orderId);
      if(action==='cancel'&&Number(order?.status)===1||action==='close'&&after.positions.length===0){
        s.state=action==='cancel'?'cancel_confirmed':'flat_confirmed';return {...s,busy:false};
      }
      await new Promise(r=>setTimeout(r,500));
    }
    s.state=action+'_unconfirmed';return {...s,busy:false};
  }finally{s.busy=false;}
  } catch(error) {
    // Chrome may expose an uncaught page-world rejection as an empty result.
    // Return a plain serializable diagnostic from inside the injected call.
    return {ok:false,action,error:String(error?.message||error),session:window.__hedgeBrokerLabDemoTestV1?{...window.__hedgeBrokerLabDemoTestV1}:null};
  }
}
// Explicitly expose the injected function to the test page. Some Chrome
// extension-page reloads do not resolve a top-level function declaration when
// it is passed as chrome.scripting.executeScript({func}).
globalThis.demoExecution = demoExecution;
