import test from 'node:test';
import assert from 'node:assert/strict';
import { CandleCache, candle, timestamp } from '../server/marketDataCore.mjs';
test('provider timestamp is UTC, including microseconds',()=>{
  assert.equal(timestamp('2026-10-01 17:49:00.000000'),1790876940);
  assert.equal(timestamp(1790876940000),1790876940);
});
test('invalid prices are not chart candles',()=>{
  assert.equal(candle({ts:1790876940,open:10,high:8,low:7,close:9}),null);
  const cache=new CandleCache();assert.equal(cache.tick(NaN,1790876940),null);
});
test('out of order replay preserves chronological open and close',()=>{
  const c=new CandleCache();c.tick(12,1790876950);c.tick(10,1790876941);c.tick(11,1790876948);
  assert.deepEqual(c.snapshot(),[{time:1790876940,open:10,high:12,low:10,close:12}]);
});
test('cache is bounded and does not fabricate missing minutes',()=>{
  const c=new CandleCache(2);c.tick(10,1790876940);c.tick(12,1790877060);c.tick(11,1790877120);
  assert.deepEqual(c.snapshot().map(b=>b.time),[1790877060,1790877120]);
});
