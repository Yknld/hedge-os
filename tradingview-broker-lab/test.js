const tabId=Number(new URLSearchParams(location.search).get('tab'));
const output=document.querySelector('#output');
function render(value){
 const positions=Array.isArray(value?.positions)?value.positions:[];
 const pnl=positions.reduce((sum,p)=>sum+(Number(p?.unrealizedPnl)||0),0);
 const quote=Number(value?.quote);
 const header=`UPDATED: ${value?.at?new Date(value.at).toLocaleTimeString():'—'}\nLIVE P&L: ${pnl>=0?'+':''}$${pnl.toFixed(2)}\nPOSITION: ${positions.length?positions.map(p=>`${p.side===1?'LONG':'SHORT'} ${p.qty||0} @ ${p.avgPrice||'?'}`).join(', '):'FLAT'}\nQUOTE: ${Number.isFinite(quote)?quote:'unavailable'}\n\n`;
 output.textContent=header+JSON.stringify(value,null,2);
}
let busy=false;
for(const button of document.querySelectorAll('button'))button.addEventListener('click',async()=>{
 if(busy)return;busy=true;for(const b of document.querySelectorAll('button'))b.disabled=true;
 output.textContent='Waiting for broker verification…';
 try{
 if(!Number.isInteger(tabId)||tabId<=0)throw Error('Missing TradingView tab. Open this test from the lab popup on the TradingView chart.');
 const execution=chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:globalThis.demoExecution,args:[button.dataset.action,{side:Number(document.querySelector('#side').value),kind:document.querySelector('#kind').value,price:Number(document.querySelector('#price').value),takeProfit:Number(document.querySelector('#tp').value),stopLoss:Number(document.querySelector('#sl').value)}]});
 const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('Broker verification timed out after 8 seconds. Reload the TradingView chart, confirm Ironbeam is connected, then reopen this test from the chart tab.')),8000));
 const results=await Promise.race([execution,timeout]);
 const entry=results?.find(item=>item.frameId===0)||results?.[0];
 if(entry?.result==null)throw Error('No result returned from the chart. Outcome is unknown. Use Inspect before any further order action.');
 render(entry.result);
 }catch(e){output.textContent=String(e.message||e)+'\nInspect the account before another action. An error is not proof an order failed.';}
 finally{busy=false;for(const b of document.querySelectorAll('button'))b.disabled=false;}
});
// Keep the lab page useful as a live monitor without requiring repeated
// clicks. This is read-only and never submits/cancels anything.
setInterval(async()=>{
 if(busy||!Number.isInteger(tabId)||tabId<=0)return;
 try{
  const results=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:globalThis.demoExecution,args:['inspect',{}]});
  const entry=results?.find(item=>item.frameId===0)||results?.[0];
  if(entry?.result?.ok!==false) render(entry?.result??entry);
 }catch(_){/* chart may be reloading; next poll retries */}
},1000);
