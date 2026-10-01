import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackDue } from '../src/lib/marketFallbackPolicy';
test('20-second continuous disconnect, not 19.999 seconds',()=>{
  assert.equal(fallbackDue(false,1000,20999),false);
  assert.equal(fallbackDue(false,1000,21000),true);
});
test('reconnected extension takes priority immediately',()=>{
  assert.equal(fallbackDue(true,1000,50000),false);
  assert.equal(fallbackDue(false,null,50000),false);
  assert.equal(fallbackDue(false,49999,50000),false);
});
