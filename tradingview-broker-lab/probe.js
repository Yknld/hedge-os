(() => {
  'use strict';
  const EVENT = 'tv-broker-lab-report-v1';
  const methodPattern = /^(placeOrder|cancelOrder|modifyOrder|closePosition|reversePosition|orders|positions|executions|accountsMetainfo|currentAccount|subscribe.*|unsubscribe.*|orderUpdate|positionUpdate|executionUpdate|connectionStatus)$/i;
  const branchPattern = /broker|trad|widget|chart|account|terminal|host|api|service|model/i;
  let brokerLookupPending = false, brokerLookupResult = null, brokerLookupState = 'not_requested';
  function scan() {
    const seen = new WeakSet(), candidates = [], tradingSurface = [], discovery = [];
    let inspected = 0, truncated = false;
    const queue = [];
    // Prior reports exposed these panel holders. Inspect their stored values
    // directly rather than calling model factories or observable accessors.
    for (const panelParts of [['TradingView','bottomWidgetBar']]) {
      let panel=window;
      for (const key of panelParts) {
        try { panel=Object.getOwnPropertyDescriptor(panel,key)?.value; }
        catch (_) { panel=null; }
        if (!panel) break;
      }
      if (panel) queue.push({value:panel,path:'window.'+panelParts.join('.'),depth:0,targeted:true});
      discovery.push({action:'panel_model_discovery',result:panel?'panel_found':'panel_missing'});
    }
    // This path was observed in the first exported report. Resolve only
    // data descriptors, then prioritize its bounded service graph.
    const parts = ['_exposed_chartWidgetCollection','_widgetOptions','externalServices','trading'];
    let trading = window;
    for (const key of parts) {
      try { const d = Object.getOwnPropertyDescriptor(trading,key); trading = d && 'value' in d ? d.value : null; }
      catch (_) { trading = null; }
      if (!trading) break;
    }
    if (trading) queue.push({value:trading,path:'window.'+parts.join('.'),depth:0,targeted:true});
    // Explicit read-only service accessor; never invoke execution methods.
    // Resolve asynchronously so a pending lookup cannot stall discovery.
    try {
      const service = trading && Object.getOwnPropertyDescriptor(trading,'tradingBrokerService')?.value;
      const getter = service && Object.getOwnPropertyDescriptor(service,'getCurrentBroker')?.value;
      if (typeof getter==='function' && !brokerLookupPending) {
        brokerLookupPending = true;
        Promise.resolve(Reflect.apply(getter,service,[])).then(value=>{
          brokerLookupResult=value;brokerLookupState=value==null?'no_broker_returned':'returned_'+typeof value;
        },()=>{brokerLookupResult=null;brokerLookupState='lookup_rejected';}).finally(()=>{brokerLookupPending=false;});
      }
    } catch (_) { brokerLookupPending=false;brokerLookupResult=null;brokerLookupState='lookup_failed'; }
    discovery.push({action:'getCurrentBroker',result:brokerLookupState,pending:brokerLookupPending});
    if (brokerLookupResult && ['object','function'].includes(typeof brokerLookupResult)) {
      queue.unshift({value:brokerLookupResult,path:'tradingBrokerService.getCurrentBroker()',depth:0,targeted:true});
    }
    // Only invoke the observed zero-argument accessor returning its holder.
    try {
      const service = trading && Object.getOwnPropertyDescriptor(trading,'tradingBrokerService')?.value;
      const ready = service && Object.getOwnPropertyDescriptor(service,'ready')?.value;
      if (typeof ready==='function' && /^\(\)=>[a-zA-Z_$][\w$]*$/.test(Function.prototype.toString.call(ready).trim())) {
        const holder = Reflect.apply(ready,service,[]);
        discovery.push({action:'inspect_ready_holder',result:holder===null?'null':typeof holder});
        if (holder) queue.unshift({value:holder,path:'tradingBrokerService.ready()',depth:0,targeted:true});
      } else discovery.push({action:'inspect_ready_holder',result:'skipped_unrecognized_definition'});
    } catch (_) { discovery.push({action:'inspect_ready_holder',result:'inspection_failed'}); }
    // Read data descriptors only: never call getters, broker functions, or factories.
    for (const key of Object.getOwnPropertyNames(window)) {
      if (!branchPattern.test(key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(window, key);
      if (descriptor && 'value' in descriptor) queue.push({value:descriptor.value,path:'window.'+key,depth:0});
    }
    while (queue.length && inspected < 1500) {
      const {value,path,depth,targeted=false} = queue.shift();
      if (!value || !['object','function'].includes(typeof value) || seen.has(value)) continue;
      seen.add(value); inspected++;
      try {
        const own = Object.getOwnPropertyDescriptors(value);
        const methods = new Set();
        const surfaceMethods = new Set(), definitions = {};
        let proto = value;
        for (let level=0; proto && proto!==Object.prototype && proto!==Function.prototype && level<3; level++, proto=Object.getPrototypeOf(proto)) {
          for (const [name,d] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
            if ('value' in d && typeof d.value==='function' && methodPattern.test(name)) methods.add(name);
            if (targeted && 'value' in d && typeof d.value==='function' && name!=='constructor') surfaceMethods.add(name);
            if (targeted && 'value' in d && typeof d.value==='function' && /^(getCurrentBroker|ready|attach|placeOrder|cancelOrder|modifyOrder|closePosition|orders|positions|executions|accountsMetainfo|currentAccount|context|implOrNull|whenReady)$/.test(name) && !(name in definitions)) {
              definitions[name] = Function.prototype.toString.call(d.value).slice(0,6000);
            }
          }
        }
        if (methods.size) candidates.push({path,methods:[...methods].sort()});
        if (targeted) tradingSurface.push({path,methods:[...surfaceMethods].sort(),definitions,properties:Object.entries(own).filter(([key])=>! /token|auth|credential|secret|password/i.test(key)).map(([key,d])=>({name:key,type:'value' in d ? (d.value===null?'null':typeof d.value) : 'accessor'})),accessors:Object.entries(own).filter(([,d])=>!('value' in d)).map(([key])=>key)});
        if (depth<(targeted?7:4)) for (const [key,d] of Object.entries(own)) {
          // Skip data collections and sensitive branches; export names only.
          const allowed = targeted ? !/token|auth|credential|secret|password|cache|listener|preferences|element|document/i.test(key) && !/^_?(orders|positions|accounts|executions)$/i.test(key) && !Array.isArray(d.value) : branchPattern.test(key);
          if ('value' in d && allowed && ['object','function'].includes(typeof d.value)) queue.push({value:d.value,path:path+'.'+key,depth:depth+1,targeted});
        }
      } catch (_) { /* A proxy may reject descriptor inspection. */ }
    }
    truncated = queue.length > 0;
    // Resource timing reveals origins only; no URLs, tokens, account IDs, or bodies.
    const origins = [...new Set(performance.getEntriesByType('resource').map(entry=>{
      try { return new URL(entry.name).origin; } catch (_) { return null; }
    }).filter(Boolean))].sort();
    window.dispatchEvent(new CustomEvent(EVENT,{detail:JSON.stringify({
      version:1,labVersion:'0.6.0',at:new Date().toISOString(),inspected,truncated,candidates,tradingSurface,discovery,origins,
      limitations:'Calls getCurrentBroker() and a source-checked ready() accessor; inspects returned objects. No order/account/position methods or property getters are invoked. Method names do not prove working broker support.'
    })}));
  }
  scan();
  setInterval(scan,5000);
})();
