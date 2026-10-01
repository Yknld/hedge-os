// Discovery adapted from ezydubs/tradingview-mcp, MIT; see THIRD_PARTY_LICENSE.txt.
(() => {
  'use strict';
  let busy=false;
  const unwrap=x=>x && typeof x==='object' && typeof x.value==='function'?x.value():x;
  const fields=['id','symbol','side','qty','type','status','limitPrice','stopPrice','avgPrice'];
  const rows=value=>Array.isArray(value)?value.slice(0,100).map(row=>Object.fromEntries(fields.filter(k=>['string','number','boolean'].includes(typeof row?.[k])).map(k=>[k,row[k]]))):[];
  async function inspect(){
    if(busy)return;busy=true;
    const report={at:new Date().toISOString(),mode:'read_only',brokerId:null,methods:[],reads:{}};
    try{
      const controllers=window.TradingView?.bottomWidgetBar?._widgetControllers;
      const controller=controllers && Map.prototype.get.call(controllers,'paper_trading');
      const trading=controller?._trading;
      if(!trading){report.error='TRADING_CONTROLLER_NOT_FOUND';return;}
      const broker=typeof trading.activeBroker==='function'?unwrap(trading.activeBroker()):null;
      if(!broker){report.error='ACTIVE_BROKER_NOT_FOUND';return;}
      report.brokerId=typeof broker._brokerMetainfo?.id==='string'?broker._brokerMetainfo.id:null;
      for(const key of ['placeOrder','cancelOrder','modifyOrder','closePosition','orders','positions','executions','ordersHistory','currentAccount','currentAccountType','accountsMetainfo'])
        if(typeof broker[key]==='function')report.methods.push(key);
      // These are queries only. Never infer demo from the broker name.
      await Promise.all(['currentAccount','currentAccountType','positions','orders'].map(async key=>{
        if(typeof broker[key]!=='function'){report.reads[key]={status:'unsupported'};return;}
        let timer;
        try{
          const value=await Promise.race([Promise.resolve().then(()=>broker[key]()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('TIMEOUT')),3000);})]);
          report.reads[key]={status:'ok',value:['positions','orders'].includes(key)?rows(value):(['string','number'].includes(typeof value)?value:null)};
        }catch(_){report.reads[key]={status:'failed_or_timeout'};}
        finally{clearTimeout(timer);}
      }));
    }catch(_){report.error='BROKER_INSPECTION_FAILED';}
    finally{
      window.dispatchEvent(new CustomEvent('tv-broker-lab-direct-v1',{detail:JSON.stringify(report)}));
      busy=false;
    }
  }
  inspect();setInterval(inspect,5000);
})();

