import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createState, transition, activateFunded, hedgeRatio, driftlessFirstPassage, validateState } from '../src/lib/campaignEngine/state';
import * as R from '../src/lib/campaignEngine/rules';
import { generateValidActions, optimizeCampaign } from '../src/lib/campaignEngine/optimizer';
import { evaluation40, dailyFunded, flexFunded, bufferedFunded, EXAMPLES } from '../src/lib/campaignEngine/examples';
import type { AccountRules, CampaignState, CampaignAction } from '../src/lib/campaignEngine/types';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const action=(s:CampaignState,r:AccountRules,targetProfit:number,stopLoss=Math.min(R.getDistanceToMll(s,r),R.getRemainingDllRoom(s,r))):CampaignAction=>({targetProfit,stopLoss,hedgeRatio:hedgeRatio(s,r),purpose:'CUSTOM'});
const feeAware=(r:AccountRules):AccountRules=>({...structuredClone(r),feeConfig:{enabled:true,propTargetBufferPct:1/31,liveRecoveryFeeBufferPct:.04}});
test('fee-aware net targets, MLL and live recovery remain separate',()=>{
  const r=feeAware(dailyFunded),s=createState(r);
  assert.equal(R.grossTargetForNet(r,150),155);
  assert.equal(R.netPropPnl(r,150),150-150/31);
  near(R.getEffectiveMarketDownside(s,r),2000-2000/31);
  near(R.getTotalRealRecoveryRequirement(s,r),s.unrecoveredRealBasis*1.04);
  near(hedgeRatio(s,r),(s.unrecoveredRealBasis*1.04)/(2000-2000/31));
  // The simulated prop commission is not permitted to enter real recovery.
  near(R.getTotalRealRecoveryRequirement({...s,estimatedPropFees:999},r),s.unrecoveredRealBasis*1.04);
});
test('actual live fees replace, rather than double-count, the estimate',()=>{
  const r=feeAware(dailyFunded),s={...createState(r),actualLiveFees:4.37};
  near(R.getEstimatedLiveFees(s,r),4.37);
  near(R.getTotalRealRecoveryRequirement(s,r),s.unrecoveredRealBasis+4.37);
});
test('fee-aware transition qualifies by net P&L',()=>{
  const r=feeAware(dailyFunded),s=createState(r);
  const next=transition(s,r,{...action(s,r,150,100),hedgeRatio:0},'TP');
  near(next.grossPropPnL!,155);near(next.estimatedPropFees!,5);near(next.netPropPnL!,150);near(next.balance,50150);
});
test('40% EOD evaluation accounting, trail lock, pass and clean path',()=>{
  let s=createState(evaluation40);near(hedgeRatio(s,evaluation40),.0415);
  s=transition(s,evaluation40,action(s,evaluation40,1200),'TP');
  near(s.balance,51200);near(s.currentMllFloor,49200);near(s.unrecoveredRealBasis,132.8);near(hedgeRatio(s,evaluation40),.0664);
  s=transition(s,evaluation40,action(s,evaluation40,1200),'TP');
  near(s.balance,52400);near(s.currentMllFloor,50100);near(s.unrecoveredRealBasis,212.48);assert.ok(s.trailLocked);near(hedgeRatio(s,evaluation40),212.48/2300);
  s=transition(s,evaluation40,action(s,evaluation40,600),'TP');assert.equal(s.phase,'PASSED_EVAL');
  assert.deepEqual(optimizeCampaign(createState(evaluation40),evaluation40,{maxSearchDepth:6,maxStates:12000,maxCandidates:6}).projectedPath.map(x=>x.action.targetProfit),[1200,1200,600]);
});
test('Daily DLL preserves 10.8%; funded EOD trail can combine lock and payout',()=>{
  let s=createState(dailyFunded);near(hedgeRatio(s,dailyFunded),.108);
  assert.equal(optimizeCampaign(s,dailyFunded,{objective:'FULL_PAYOUT'}).nextAction?.targetProfit,2500);
  s=transition(s,dailyFunded,action(s,dailyFunded,2500),'SL');near(s.balance,49000);near(s.unrecoveredRealBasis,108);near(s.cumulativeLiveHedgePnl,108);near(hedgeRatio(s,dailyFunded),.108);
  assert.equal(s.phase,'FUNDED');assert.equal(R.getRemainingDllRoom(s,dailyFunded),1000);
  assert.equal(optimizeCampaign(s,dailyFunded,{objective:'FULL_PAYOUT'}).nextAction?.targetProfit,3500);
  s=transition(s,dailyFunded,action(s,dailyFunded,3500),'SL');assert.equal(s.phase,'FAILED');near(s.realizedRealCash,0);near(s.unrecoveredRealBasis,0);
  assert.throws(()=>transition(s,dailyFunded,action(s,dailyFunded,100),'TP'),/cannot continue/);
});
test('Static floor stays fixed and cushion grows',()=>{
  const r=structuredClone(dailyFunded);r.funded.maxLoss={amount:2000,type:'STATIC',locks:false};
  const s=transition(createState(r),r,action(createState(r),r,1200),'TP');near(s.currentMllFloor,48000);near(R.getDistanceToMll(s,r),3200);
});
test('DLL is not terminal downside and accounts for prior same-day PnL',()=>{
  const s={...createState(dailyFunded),dailyPnL:-400};assert.equal(R.getRemainingDllRoom(s,dailyFunded),600);near(hedgeRatio(s,dailyFunded),.108);
  assert.throws(()=>transition(s,dailyFunded,action(s,dailyFunded,100,601),'SL'),/legal loss room/);
});
test('50% consistency and oversize winning day changes requirement',()=>{
  const r=structuredClone(evaluation40);r.evaluation!.consistency!.maxLargestDayFraction=.5;
  let s=createState(r);s=transition(s,r,action(s,r,1500),'TP');assert.equal(s.phase,'EVALUATION');
  s=transition(s,r,action(s,r,1500),'TP');assert.equal(s.phase,'PASSED_EVAL');
  const imperfect={...createState(evaluation40),consistencyProfit:2400,consistencyLargestDay:1700};near(R.getConsistencyRequirement(imperfect,evaluation40),4250);near(R.getAdditionalProfitNeededForConsistency(imperfect,evaluation40),1850);
});
test('Payout conversion, caps, split, reset and retained floor',()=>{
  const r=structuredClone(dailyFunded);r.funded.payout.capsByPayoutNumber=[1250,1500];
  let s=createState(r);s=transition(s,r,action(s,r,2500),'TP');assert.ok(R.isPayoutEligible(s,r));near(R.getMaximumAvailablePayout(s,r),1250);
  const paid=R.applyPayout(s,r);near(paid.balance,51250);near(paid.cumulativePayouts,1125);near(paid.currentMllFloor,50100);assert.equal(paid.payoutNumber,1);assert.equal(R.getCurrentPayoutCap(paid,r),1500);assert.equal(paid.cumulativeCycleProfit,0);assert.equal(paid.consistencyLargestDay,0);assert.equal(paid.phase,'PAYOUT_CYCLE');assert.ok(!R.isPayoutEligible(paid,r));
});
test('Payout count maximum completes campaign',()=>{
  const r=structuredClone(dailyFunded);r.funded.payout.maxPayouts=1;let s=createState(r);s=transition(s,r,action(s,r,2500),'TP');assert.equal(R.applyPayout(s,r).phase,'COMPLETED');
});
test('Flex qualifying days, cap and legal generated continuation',()=>{
  let s=createState(flexFunded);near(R.getAdditionalProfitNeededForMaxPayout(s,flexFunded),5000);
  const p=optimizeCampaign(s,flexFunded,{objective:'FULL_PAYOUT',maxSearchDepth:6,maxStates:12000,maxCandidates:6});assert.ok(p.projectedPath.length>=5);
  for(const step of p.projectedPath) s=transition(s,flexFunded,step.action,'TP');
  assert.ok(s.qualifyingDaysCompleted>=5);assert.ok(R.isPayoutEligible(s,flexFunded));near(R.getMaximumAvailablePayout(s,flexFunded),2500);
});
test('Below-minimum profitable day does not qualify',()=>{
  let s=createState(flexFunded);s=transition(s,flexFunded,action(s,flexFunded,99),'TP');assert.equal(s.qualifyingDaysCompleted,0);assert.equal(s.profitableDaysCompleted,1);
});
test('Scaling tiers constrain action contracts',()=>{
  const r=structuredClone(dailyFunded);r.funded.scalingPlan=[{minimumProfit:0,maximumProfit:1000,maxContracts:2},{minimumProfit:1000,maxContracts:5}];
  let s=createState(r);assert.equal(R.getCurrentMaxContracts(s,r),2);assert.throws(()=>transition(s,r,{...action(s,r,1000),propContracts:3},'TP'),/scaling/);
  s=transition(s,r,action(s,r,1000),'TP');assert.equal(s.currentMaxContracts,5);
});
test('Activation charges fee once and resets funded trail',()=>{
  const r=structuredClone(evaluation40);r.activationFee=149;let s=createState(r);for(const n of [1200,1200,600])s=transition(s,r,action(s,r,n),'TP');
  const funded=activateFunded(s,r);near(funded.unrecoveredRealBasis,s.unrecoveredRealBasis+149);near(funded.realizedRealCash,s.realizedRealCash-149);near(funded.currentMllFloor,48000);assert.throws(()=>activateFunded(funded,r));
});
test('Costs increase basis; configured reserve changes hedge',()=>{
  const s=createState(dailyFunded);near(hedgeRatio(s,dailyFunded,{frictionReserve:10,desiredFailureProfit:20}),246/2000);
  const n=transition(s,dailyFunded,action(s,dailyFunded,100),'TP',{executionCost:2});near(n.unrecoveredRealBasis,228.8);near(n.cumulativeExecutionCosts,2);
});
test('State hash distinguishes largest day; candidates include exact split',()=>{
  const a={...createState(evaluation40),balance:52500,currentEodPeak:52500,consistencyProfit:2500,consistencyLargestDay:2100};
  const b={...a,consistencyLargestDay:500};assert.notEqual(R.getAdditionalProfitNeededForConsistency(a,evaluation40),R.getAdditionalProfitNeededForConsistency(b,evaluation40));
  const s={...createState(flexFunded),balance:54100,currentEodPeak:54100,cumulativePhaseProfit:4100,cumulativeCycleProfit:4100};assert.ok(generateValidActions(s,flexFunded).some(a=>a.targetProfit===180));
});
test('Deterministic property sweep: floors monotone, locked invariant, cap, basis',()=>{
  for(let seed=1;seed<=50;seed++) {
    let s=createState(flexFunded);for(let day=0;day<8;day++) {
      const floor=s.currentMllFloor,locked=s.trailLocked;
      const n=transition(s,flexFunded,action(s,flexFunded,100+(seed*37+day*71)%1600),'TP');
      assert.ok(n.currentMllFloor+1e-7>=floor);if(locked)near(n.currentMllFloor,floor);assert.ok(n.unrecoveredRealBasis>=0);assert.ok(R.getMaximumAvailablePayout(n,flexFunded)<=R.getCurrentPayoutCap(n,flexFunded));s=n;
    }
  }
});
test('Probability interface is separate and geometry-only',()=>{
  const s=createState(dailyFunded);near(driftlessFirstPassage.getWinProbability(action(s,dailyFunded,1000),s),.5);near(driftlessFirstPassage.getWinProbability(action(s,dailyFunded,2500),s),1000/3500);
});
test('Unsupported intraday excursion assumptions fail closed',()=>{
  const r=structuredClone(dailyFunded);r.funded.maxLoss.type='INTRADAY_TRAILING';assert.equal(optimizeCampaign(createState(r),r).nextAction,null);
});
test('All required examples provide finite deterministic output',()=>{
  for(const x of EXAMPLES){validateState(x.state,x.rules);const plan=optimizeCampaign(x.state,x.rules);assert.ok(plan.nextAction);assert.ok(Number.isFinite(plan.nextAction.targetProfit));assert.ok(plan.metrics.statesVisited<=3000);}
});
test('SQLite schema restores state and immutable transition JSON',()=>{
  const rust=readFileSync(new URL('../src-tauri/src/lib.rs',import.meta.url),'utf8');
  const schema=rust.match(/fn engine_schema[\s\S]*?execute_batch\("([\s\S]*?)"\)/)![1];
  const state=EXAMPLES[3].state,json=JSON.stringify(state).replaceAll("'","''");
  const sql=`${schema}\nBEGIN; INSERT INTO campaign_engine_sessions VALUES ('workspace','${json}'); INSERT INTO campaign_state_transitions VALUES ('t1','daily','now','{}','{}','SL','${json}','1.0.0','{}','{}'); COMMIT; SELECT session_json FROM campaign_engine_sessions; SELECT next_state_json FROM campaign_state_transitions;`;
  const result=spawnSync('sqlite3',[':memory:'],{input:sql,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);for(const row of result.stdout.trim().split('\n'))assert.deepEqual(JSON.parse(row),state);
});
test('Malformed state and search bounds are rejected',()=>{
  assert.throws(()=>validateState({...createState(dailyFunded),currentMllFloor:undefined} as unknown as CampaignState,dailyFunded));
  assert.throws(()=>optimizeCampaign(createState(dailyFunded),dailyFunded,{maxSearchDepth:NaN}));
});
test('Buffered 1050 + 1050 + 500 pays $500 and preserves $52100 buffer and floor',()=>{
  let s=createState(bufferedFunded);assert.equal(R.getFundedSubstate(s,bufferedFunded),'BUFFER_BUILDING');
  near(R.getPayoutTargetBalance(s,bufferedFunded),52600);
  for(const target of [1050,1050])s=transition(s,bufferedFunded,action(s,bufferedFunded,target),'TP');
  near(R.getMaximumAvailablePayout(s,bufferedFunded),0);assert.equal(R.getFundedSubstate(s,bufferedFunded),'BUFFER_LOCKED');
  s=transition(s,bufferedFunded,action(s,bufferedFunded,500),'TP');assert.ok(R.isPayoutEligible(s,bufferedFunded));near(R.getMaximumAvailablePayout(s,bufferedFunded),500);
  const paid=R.applyPayout(s,bufferedFunded);near(paid.balance,52100);near(paid.currentMllFloor,50100);near(paid.cumulativePayouts,500);near(R.getDistanceToMll(paid,bufferedFunded),2000);assert.equal(R.getFundedSubstate(paid,bufferedFunded),'BUFFER_LOCKED');
});
test('Buffered $2600 winning day fails 50% consistency despite $500 surplus',()=>{
  const s=transition(createState(bufferedFunded),bufferedFunded,action(createState(bufferedFunded),bufferedFunded,2600),'TP');
  near(R.getWithdrawableSurplus(s,bufferedFunded),500);near(R.getConsistencyRequirement(s,bufferedFunded),5200);assert.ok(!R.isPayoutEligible(s,bufferedFunded));
  assert.equal(R.getFundedSubstate(s,bufferedFunded),'SURPLUS_BUILDING');
});
test('Buffered net cap and split debit correct gross equity',()=>{
  const r=structuredClone(bufferedFunded);r.funded.consistency=undefined;r.funded.payout.profitShare=.9;
  let s=createState(r);s=transition(s,r,action(s,r,3100),'TP');near(R.getMaximumAvailablePayout(s,r),500);
  const paid=R.applyPayout(s,r);near(paid.balance,s.balance-500/.9);near(paid.cumulativePayouts,500);assert.ok(paid.balance>=52100);
  near(R.getPayoutTargetBalance(createState(r),r),52100+500/.9);
});
test('Buffered non-debit payout consumes entitlement, prevents repeated extraction',()=>{
  const r=structuredClone(bufferedFunded);r.funded.consistency=undefined;r.funded.payout.bufferedSurplus!.payoutReducesBalance=false;
  let s=createState(r);s=transition(s,r,action(s,r,2600),'TP');s=R.applyPayout(s,r);near(s.balance,52600);near(R.getWithdrawableSurplus(s,r),0);assert.ok(!R.isPayoutEligible(s,r));near(R.getPayoutTargetBalance(s,r),53100);
});
test('Consistency denominators and reset windows remain distinct',()=>{
  const r=structuredClone(bufferedFunded),s={...createState(r),balance:53000,currentEodPeak:53000,cumulativePhaseProfit:4000,cumulativeCycleProfit:2000,profitSinceLastPayout:1500};
  for(const [denominator,expected] of [['TOTAL_ACCOUNT_PROFIT',4000],['CURRENT_PAYOUT_CYCLE_PROFIT',2000],['PROFIT_SINCE_LAST_PAYOUT',1500],['WITHDRAWABLE_PROFIT',900]] as const){r.funded.consistency!.denominator=denominator;near(R.getConsistencyDenominator(s,r),expected);}
  r.funded.consistency!.resetsAfterPayout=false;const paid=R.applyPayout({...s,consistencyLargestDay:100},r);near(paid.consistencyLargestDay,100);near(paid.profitSinceLastPayout!,0);
});
test('Fresh buffered EOD account rejects targets below its trail lock',()=>{
  const values=generateValidActions(createState(bufferedFunded),bufferedFunded).map(a=>a.targetProfit);
  assert.ok(values.includes(2100));
  assert.ok(values.includes(2600));
  assert.ok(values.every(value=>value>=2100));
});
