const test=require('node:test');
const assert=require('node:assert/strict');
const mqtt=require('./ironbeam-mqtt.js');

test('encodes MQTT remaining lengths at boundary values',()=>{
  assert.deepEqual([...mqtt.encodeRemainingLength(0)],[0]);
  assert.deepEqual([...mqtt.encodeRemainingLength(127)],[127]);
  assert.deepEqual([...mqtt.encodeRemainingLength(128)],[128,1]);
  assert.deepEqual([...mqtt.encodeRemainingLength(16384)],[128,128,1]);
});

test('round trips a Unicode JSON QoS0 publish',()=>{
  const payload={MESSAGE:'STOP_STRATEGY',STRATEGY_ID:123,note:'MNQ ✓'};
  const decoded=mqtt.decodeMqttPublish(mqtt.buildMqttPublish('SERVER/session-1',payload));
  assert.equal(decoded.topic,'SERVER/session-1');assert.equal(decoded.qos,0);assert.deepEqual(decoded.payloadObject,payload);
});

test('rejects malformed and truncated packets',()=>{
  assert.throws(()=>mqtt.decodeMqttPublish(Uint8Array.from([0x30,0x80])),/Malformed|Truncated/);
  const packet=mqtt.buildMqttPublish('CLIENT/x',{ok:true});assert.throws(()=>mqtt.decodeMqttPublish(packet.subarray(0,-1)),/Truncated/);
});
