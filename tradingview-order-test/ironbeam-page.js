(() => {
  'use strict';
  if(window.__ironbeamSocketHookInstalled)return;
  window.__ironbeamSocketHookInstalled=true;
  const TARGET='wss://wss.certigo.com/mqtt',NativeWebSocket=window.WebSocket,mqtt=window.IronbeamMqtt;
  let activeSocket=null,outboundTopic=null,inboundTopic=null;
  const emit=(type,detail={})=>window.dispatchEvent(new CustomEvent(`hedge-os:ironbeam:${type}`,{detail}));
  const inspect=(data,direction)=>{
    try{
      const decoded=mqtt.decodeMqttPublish(data);if(!decoded)return;
      // Send exact raw IDs alongside the parsed broker payload. Their numeric
      // values exceed Number.MAX_SAFE_INTEGER and must never be used as a
      // round-trippable JavaScript number.
      if(decoded.payloadObject&&direction==='inbound')for(const field of ['SOE_ID','STRATEGY_ID']){
        const raw=decoded.payloadObject[`__hedgeOsRaw${field}`];
        if(raw)Object.defineProperty(decoded.payloadObject,`__hedgeOsRaw${field}`,{value:raw,enumerable:false});
      }
      if(direction==='outbound'&&decoded.topic.startsWith('SERVER/'))outboundTopic=decoded.topic;
      if(direction==='inbound'&&decoded.topic.startsWith('CLIENT/'))inboundTopic=decoded.topic;
      emit('mqtt',{direction,topic:decoded.topic,payload:decoded.payloadObject});
      emit('status',{socketReady:activeSocket?.readyState===NativeWebSocket.OPEN,outboundTopic,inboundTopic});
    }catch(error){emit('diagnostic',{code:'MQTT_DECODE_FAILED',message:String(error?.message||error)});}
  };
  const observeData=(data,direction,ws)=>{
    if(ws!==activeSocket)return;
    if(data instanceof Blob)data.arrayBuffer().then(value=>{if(ws===activeSocket)inspect(value,direction);}).catch(()=>{});
    else inspect(data,direction);
  };
  function WrappedWebSocket(...args){
    const ws=new NativeWebSocket(...args);
    if(String(ws.url)!==TARGET)return ws;
    activeSocket=ws;outboundTopic=null;inboundTopic=null;emit('status',{socketReady:ws.readyState===NativeWebSocket.OPEN,outboundTopic,inboundTopic});
    const nativeSend=ws.send.bind(ws);
    ws.send=(data)=>{const result=nativeSend(data);if(ws.readyState===NativeWebSocket.OPEN)observeData(data,'outbound',ws);return result;};
    ws.addEventListener('open',()=>{if(activeSocket===ws)emit('status',{socketReady:true,outboundTopic,inboundTopic});});
    ws.addEventListener('message',(event)=>observeData(event.data,'inbound',ws));
    ws.addEventListener('close',()=>{if(activeSocket!==ws)return;activeSocket=null;outboundTopic=null;inboundTopic=null;emit('status',{socketReady:false,outboundTopic:null,inboundTopic:null});});
    ws.addEventListener('error',()=>{if(activeSocket===ws)emit('status',{socketReady:false,outboundTopic,inboundTopic});});
    return ws;
  }
  Object.setPrototypeOf(WrappedWebSocket,NativeWebSocket);WrappedWebSocket.prototype=NativeWebSocket.prototype;
  for(const key of ['CONNECTING','OPEN','CLOSING','CLOSED'])Object.defineProperty(WrappedWebSocket,key,{value:NativeWebSocket[key]});
  window.WebSocket=WrappedWebSocket;
  window.addEventListener('hedge-os:ironbeam:send',(event)=>{
    const {requestId,bytes}=event.detail||{};
    if(!requestId)return;
    if(!activeSocket||activeSocket.url!==TARGET||activeSocket.readyState!==NativeWebSocket.OPEN)
      return emit('send-result',{requestId,ok:false,error:'IRONBEAM_SOCKET_UNAVAILABLE'});
    try{activeSocket.send(Uint8Array.from(bytes||[]));emit('send-result',{requestId,ok:true});}
    catch(error){emit('send-result',{requestId,ok:false,error:String(error?.message||error)});}
  });
  emit('status',{socketReady:false,outboundTopic:null,inboundTopic:null});
})();
