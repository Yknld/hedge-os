import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignJournalMetrics, useAppStore } from '../src/store/useAppStore';

test('journal rolls balances forward and recalculates backdated edits without duplicating days', () => {
  Object.assign(globalThis, { window: {}, localStorage: { setItem() {} } });
  const campaign={...useAppStore.getState().campaigns[0],accountSize:50000,estimatedHedgeBalance:500,journal:[]};
  useAppStore.setState({campaigns:[campaign]});
  const record=useAppStore.getState().recordCampaignJournalEntry;
  record(campaign.id,{date:'2026-09-18',balance:1,realizedPnl:-100,liveRealizedPnl:20,fees:2,propFees:5});
  record(campaign.id,{date:'2026-09-17',balance:999999,realizedPnl:300,liveRealizedPnl:-10,fees:3,propFees:10,purchaseCost:85});
  let current=useAppStore.getState().campaigns[0];
  assert.equal(campaignJournalMetrics(current).currentBalance,50185);
  assert.equal(campaignJournalMetrics(current).currentHedgeBalance,505);
  record(campaign.id,{date:'2026-09-17',balance:0,realizedPnl:200,liveRealizedPnl:-10,fees:3,propFees:10});
  current=useAppStore.getState().campaigns[0];
  assert.equal(current.journal?.length,2);
  assert.equal(current.journal?.[0].purchaseCost,85);
  assert.equal(current.journal?.[1].balance,50085);
  assert.equal(current.currentBalance,50085);
  assert.equal(campaignJournalMetrics(current).currentHedgeBalance,505);
});

test('legacy entries without prop fees retain their recorded P&L', () => {
  const campaign={...useAppStore.getState().campaigns[0],journal:[{id:'legacy',date:'2026-09-17',recordedAt:'2026-09-17',balance:1,realizedPnl:300,fees:0}]};
  assert.equal(campaignJournalMetrics(campaign).currentBalance,50300);
});
