'use strict';
let themeRevision = 0;
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'ivory' ? 'ivory' : 'charcoal';
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.appTheme) {
    themeRevision++;
    applyTheme(changes.appTheme.newValue);
  }
});
chrome.storage.local.get('appTheme').then(saved => {
  if (!themeRevision) applyTheme(saved.appTheme);
}).catch(() => applyTheme('charcoal'));
const el={appDot:document.querySelector('#appDot'),appValue:document.querySelector('#appValue'),refresh:document.querySelector('#refresh'),version:document.querySelector('#version'),tvCount:document.querySelector('#tvCount'),tvTabs:document.querySelector('#tvTabs'),ibCount:document.querySelector('#ibCount'),ibTabs:document.querySelector('#ibTabs'),error:document.querySelector('#error')};
const dot=status=>`dot ${status}`;
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const plural=(count,label)=>`${count} ${label}${count===1?'':'s'}`;
function row({status='red',title,detail,badge,ready=false}){return `<div class="row"><i class="${dot(status)}"></i><div><div class="primary">${escapeHtml(title)}</div><div class="secondary">${escapeHtml(detail)}</div></div><span class="badge${ready?' ready':''}">${escapeHtml(badge)}</span></div>`;}
function renderTradingView(status){const tabs=Array.isArray(status?.readiness?.tabs)?status.readiness.tabs:[];el.tvCount.textContent=plural(tabs.length,'tab');el.tvTabs.innerHTML=tabs.length?tabs.map(tab=>{const compatible=tab.protocolVersion===status.readiness?.requiredProtocolVersion,ready=compatible&&Boolean(tab.ready),standby=!tab.active&&!ready;const detail=standby?['Background','No active order panel required',compatible?`Protocol ${tab.protocolVersion}`:'Refresh before use'].join(' · '):[tab.active?'Active':'Background',tab.orderPanelDetected?'Order panel ready':'Order panel unavailable',compatible?`Protocol ${tab.protocolVersion}`:'Incompatible script'].join(' · ');return row({status:ready?'green':standby?'':tab.responded?'yellow':'red',title:tab.displayedSymbol||tab.symbol||`TradingView tab ${tab.tabId}`,detail,badge:ready?'Ready':standby?'Standby':'Not ready',ready});}).join(''):'<div class="empty">No TradingView chart tabs detected.</div>';}
function latchError(error,ignored=[]){if(error&&!ignored.includes(error)&&!el.error.textContent)el.error.textContent=error;}
function render(status){el.appDot.className=dot(status.appConnected?'green':status.execution==='Connecting'?'yellow':'red');el.appValue.textContent=status.appConnected?'App connected':status.execution==='Connecting'?'Connecting to app':'App disconnected';el.version.textContent=status.extensionVersion?`v${status.extensionVersion}`:'—';renderTradingView(status);latchError(status.error,['READY','IRONBEAM_BINDING_REQUIRED']);}
function renderBoundIronbeam(status){const tabs=Array.isArray(status?.boundTabs)?status.boundTabs:[];el.ibCount.textContent=plural(tabs.length,'tab');el.ibTabs.innerHTML=tabs.length?tabs.map(tab=>{const ready=Boolean(tab.detected&&tab.socketReady&&tab.outboundTopic&&tab.contractMatches);const symbol=`${tab.rootSymbol||tab.symbol||'Ironbeam'} → ${String(tab.currentContract||'?').replace(/^XCME:/,'')}`;const detail=[tab.account?`Account ${tab.account}`:'Account unknown',tab.socketReady?'Socket connected':'Socket disconnected',tab.contractMatches?'Contract matched':'Contract mismatch'].join(' · ');return row({status:ready?'green':tab.detected?'yellow':'red',title:symbol,detail,badge:ready?'Ready':'Not ready',ready});}).join(''):'<div class="empty">No bound Ironbeam hedge tabs detected.</div>';latchError(status.error,['IRONBEAM_BINDING_REQUIRED']);}
function renderIronbeam(status){
  renderBoundIronbeam(status);
  const bound=status?.boundTabs||[],discovered=status?.discoveredTabs||[];
  const unbound=discovered.filter(tab=>!bound.some(item=>item.tabId===tab.tabId));
  if(!unbound.length)return;
  if(!bound.length)el.ibTabs.innerHTML='';
  el.ibCount.textContent=plural(new Set([...bound,...discovered].map(tab=>tab.tabId)).size,'tab');
  el.ibTabs.innerHTML+=unbound.map(tab=>row({status:tab.detected?'yellow':'red',title:tab.currentContract||'Ironbeam tab '+tab.tabId,badge:tab.detected?'Unbound':'No response',detail:tab.detected?'Tab detected; contract binding required.':'Tab is open but its bridge is not responding. Refresh this Ironbeam tab. '+(tab.error||'')})).join('');
}
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='BRIDGE_STATUS')render(message.status);if(message?.type==='IRONBEAM_STATUS')renderIronbeam(message);});
let refreshing=false;
function requestStatus(type){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(type+' timed out; refresh the broker tabs.')),6000);chrome.runtime.sendMessage({type}).then(resolve,reject).finally(()=>clearTimeout(timer));});}
async function refresh(){
  if(refreshing)return;refreshing=true;el.refresh.disabled=true;el.error.textContent='';
  try{
    await Promise.allSettled([
      requestStatus('GET_BRIDGE_STATUS').then(render).catch(error=>{el.error.textContent=String(error.message||error);}),
      requestStatus('GET_IRONBEAM_BRIDGE_STATUS').then(renderIronbeam).catch(error=>{el.ibCount.textContent='Unavailable';el.ibTabs.textContent=String(error.message||error);}),
    ]);
  }finally{refreshing=false;el.refresh.disabled=false;}
}
el.refresh.addEventListener('click',refresh);refresh();setInterval(refresh,1000);
