(() => {
  'use strict';
  let latest=null,directBroker=null;
  window.addEventListener('tv-broker-lab-direct-v1',event=>{
    if(typeof event.detail!=='string'||event.detail.length>200000)return;
    try{directBroker=JSON.parse(event.detail);}catch(_){}
  });
  window.addEventListener('tv-broker-lab-report-v1',event=>{
    // Reports are untrusted page data; never interpret them as commands.
    if(typeof event.detail!=='string')return;
    if(event.detail.length>2000000){latest={version:1,error:'REPORT_TOO_LARGE',candidates:[],origins:[]};return;}
    try {
      const value=JSON.parse(event.detail);
      if(value.version===1&&Array.isArray(value.candidates)&&Array.isArray(value.origins)) latest=value;
    } catch (_) {}
  });
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message?.type==='LAB_REPORT') reply({report:latest?{...latest,labVersion:'0.7.0',directBroker}:directBroker?{labVersion:'0.7.0',directBroker}:null});
  });
})();
