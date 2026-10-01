let report=null;
const output=document.querySelector('#result'),exportButton=document.querySelector('#export');
async function read(){
  report=null;exportButton.disabled=true;
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    const response=await chrome.tabs.sendMessage(tab.id,{type:'LAB_REPORT'});
    if(!response?.report){output.textContent='Waiting for first scan. Try again in five seconds.';return;}
    report=response.report;
    output.textContent=JSON.stringify(report,null,2);
    exportButton.disabled=false;
  }catch(error){output.textContent='Open a TradingView chart and reload it after installing this extension. '+String(error.message||error);}
}
document.querySelector('#read').addEventListener('click',read);
exportButton.addEventListener('click',()=>{
  if(!report)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='tradingview-broker-lab-'+Date.now()+'.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
read();
const testButton=document.createElement('button');testButton.textContent='Open demo execution test';
document.body.append(testButton);
testButton.addEventListener('click',async()=>{
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 await chrome.tabs.create({url:chrome.runtime.getURL('test.html')+'?tab='+tab.id});
});
