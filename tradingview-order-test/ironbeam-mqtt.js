(function (root, factory) {
  const api=factory();
  if (typeof module!=='undefined'&&module.exports) module.exports=api;
  root.IronbeamMqtt=api;
})(typeof globalThis!=='undefined'?globalThis:this,function () {
  'use strict';
  const encoder=new TextEncoder(),decoder=new TextDecoder();

  function encodeRemainingLength(length) {
    if(!Number.isInteger(length)||length<0||length>268435455) throw new Error('Invalid MQTT remaining length');
    const bytes=[];
    do {let digit=length%128;length=Math.floor(length/128);if(length>0)digit|=128;bytes.push(digit);} while(length>0);
    return Uint8Array.from(bytes);
  }

  function buildMqttPublish(topic,payloadObject) {
    if(typeof topic!=='string'||!topic.length) throw new Error('MQTT topic is required');
    // Preserve broker identifiers as JSON numbers, not rounded JavaScript
    // Numbers and not quoted strings.  Ironbeam issues IDs above 2^53.
    const rawIntegerPrefix='__HEDGE_OS_RAW_INTEGER__';
    const payloadText=JSON.stringify(payloadObject,(key,value)=>['SOE_ID','STRATEGY_ID'].includes(key)&&/^\d+$/.test(String(value))?`${rawIntegerPrefix}${value}`:value)
      .replace(new RegExp(`"${rawIntegerPrefix}(\\d+)"`,'g'),'$1');
    const topicBytes=encoder.encode(topic),payloadBytes=encoder.encode(payloadText);
    if(topicBytes.length>65535) throw new Error('MQTT topic is too long');
    const remaining=2+topicBytes.length+payloadBytes.length,encodedRemaining=encodeRemainingLength(remaining);
    const packet=new Uint8Array(1+encodedRemaining.length+remaining);
    let offset=0;packet[offset++]=0x30;packet.set(encodedRemaining,offset);offset+=encodedRemaining.length;
    packet[offset++]=topicBytes.length>>8;packet[offset++]=topicBytes.length&255;
    packet.set(topicBytes,offset);offset+=topicBytes.length;packet.set(payloadBytes,offset);
    return packet;
  }

  function toBytes(buffer) {
    if(buffer instanceof Uint8Array)return buffer;
    if(buffer instanceof ArrayBuffer)return new Uint8Array(buffer);
    if(ArrayBuffer.isView(buffer))return new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength);
    throw new Error('MQTT packet must be binary');
  }

  function decodeMqttPublish(buffer) {
    const bytes=toBytes(buffer);if(!bytes.length||(bytes[0]>>4)!==3) return null;
    if(bytes.length<2)throw new Error('Truncated MQTT packet');
    let multiplier=1,remaining=0,index=1,digit,count=0;
    do {if(index>=bytes.length||count++>=4)throw new Error('Malformed MQTT remaining length');digit=bytes[index++];remaining+=(digit&127)*multiplier;multiplier*=128;} while(digit&128);
    if(index+remaining>bytes.length)throw new Error('Truncated MQTT packet');
    const qos=(bytes[0]>>1)&3;if(index+2>bytes.length)throw new Error('Missing MQTT topic');
    const topicLength=(bytes[index++]<<8)|bytes[index++];if(index+topicLength>bytes.length)throw new Error('Truncated MQTT topic');
    const topic=decoder.decode(bytes.subarray(index,index+topicLength));index+=topicLength;
    if(qos>0){if(index+2>bytes.length)throw new Error('Missing MQTT packet ID');index+=2;}
    const payloadText=decoder.decode(bytes.subarray(index,index+remaining-(2+topicLength+(qos>0?2:0))));
    let payloadObject=null;try{
      payloadObject=JSON.parse(payloadText);
      // Ironbeam IDs are 15-digit integers. JSON.parse turns them into
      // imprecise Numbers, so retain their original decimal text for every
      // subsequent request/reply correlation.
      if(payloadObject&&typeof payloadObject==='object')for(const field of ['SOE_ID','STRATEGY_ID']){
        const match=payloadText.match(new RegExp(`"${field}"\\s*:\\s*(\\d+)`));
        if(match)Object.defineProperty(payloadObject,`__hedgeOsRaw${field}`,{value:match[1],enumerable:false});
      }
    }catch(_){}
    return {topic,payloadText,payloadObject,qos};
  }
  return {encodeRemainingLength,buildMqttPublish,decodeMqttPublish};
});
