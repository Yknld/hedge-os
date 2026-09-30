import React from 'react';
import test, {afterEach} from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { EXAMPLES, evaluation40, bufferedFunded, dailyFunded } from '../src/lib/campaignEngine/examples';
import { createState, normalizePayoutCycleState, transition } from '../src/lib/campaignEngine/state';
import { optimizeCampaign } from '../src/lib/campaignEngine/optimizer';
import { projectionData, stateFields, terminalObjective, previewAlternative } from '../src/lib/campaignEngine/planner';
import { StateBuilderDrawer } from '../src/components/campaignEngine/StateBuilderDrawer';
import { CampaignSummaryCards, NextTradeRecommendation, OutcomeBranchCard, ProjectedPathTimeline } from '../src/components/campaignEngine/PlannerPanels';
import { PathExplorer } from '../src/components/campaignEngine/PathExplorer';
import { PLANNER_PRESETS } from '../src/lib/campaignEngine/presets';
import { migrateEngineSession, type EngineSession } from '../src/lib/campaignEngine/persistence';
import { applyPayout, getMaximumAvailablePayout, isPayoutEligible } from '../src/lib/campaignEngine/rules';
import { useAppStore } from '../src/store/useAppStore';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
Object.defineProperty(globalThis,'window',{value:dom.window,configurable:true});
Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
Object.assign(globalThis,{HTMLElement:dom.window.HTMLElement,React});
const {render,fireEvent,cleanup,waitFor}=await import('@testing-library/react');
afterEach(cleanup);
const options={objective:'FULL_PAYOUT' as const,maxSearchDepth:6,maxStates:12000,maxCandidates:6};
const session={rules:evaluation40,state:createState(evaluation40),options,history:[]};
const plan=optimizeCampaign(session.state,session.rules,options);

test('Catalog evaluations use two 50% days independently of PA qualifying days',()=>{
  for(const preset of PLANNER_PRESETS.filter(p=>p.rules.provider==='Lucid Trading'&&p.rules.id.includes('-flex-'))) {
    const r=preset.rules;
    assert.equal(r.evaluation?.minimumTradingDays,0);
    assert.equal(r.funded.minimumProfitDays?.requiredDays,5);
    assert.equal(r.funded.payout.requiredDays,5);
    const result=optimizeCampaign(preset.state,r,options);
    const half=r.evaluation!.profitTarget/2;
    assert.deepEqual(result.projectedPath.map(step=>step.action.targetProfit),[half,half]);
    assert.equal(result.projectedPath.at(-1)?.nextState.phase,'PASSED_EVAL');
  }
});

test('LucidFlex catalog includes every size and explicit DLL/price variant',()=>{
  const lucid=PLANNER_PRESETS.filter(p=>p.rules.id.includes('-flex-'));
  assert.equal(lucid.length,8);
  for(const size of [25000,50000,100000,150000]) {
    const variants=lucid.filter(p=>p.rules.startingBalance===size);
    assert.equal(variants.length,2);
    assert.deepEqual(variants.map(p=>p.rules.evaluation?.dailyLossLimit?.enabled).sort(),[false,true]);
    assert.equal(variants[0].rules.funded.maxContracts,variants[0].rules.evaluation?.maxContracts);
    assert.equal(variants[0].rules.funded.minimumProfitDays?.requiredDays,5);
    assert.equal(variants[0].rules.funded.payoutsToLive,5);
    assert.ok(variants.every(p=>p.rules.pricing?.sourceAsOf==='2026-09-07'));
  }
});

test('Every funded EOD first target reaches its configured trail lock',()=>{
  const presets=PLANNER_PRESETS.filter(p=>p.rules.funded.maxLoss.type==='EOD_TRAILING'&&p.rules.funded.maxLoss.locks);
  assert.ok(presets.length>0);
  for(const preset of presets) {
    const funded=createState(preset.rules,`${preset.rules.id}-funded`,'FUNDED',preset.rules.evaluationFee);
    const plan=optimizeCampaign(funded,preset.rules,options);
    const lock=preset.rules.funded.maxLoss.lockTriggerBalance!-preset.rules.startingBalance;
    assert.ok((plan.nextAction?.targetProfit??0)>=lock);
    assert.equal(transition(funded,preset.rules,plan.nextAction!,'TP').trailLocked,true);
  }
});

test('Tradeify Growth Daily combines trail lock and maximum payout on day one',()=>{
  const preset=PLANNER_PRESETS.find(p=>p.rules.id==='tradeify-50000-growth-daily')!;
  const funded=createState(preset.rules,'tradeify-combined','FUNDED',preset.rules.evaluationFee);
  const plan=optimizeCampaign(funded,preset.rules,options);
  assert.equal(plan.nextAction?.targetProfit,2500);
  assert.equal(plan.projectedPath.length,1);
  assert.equal(plan.metrics.projectedPayout,1125);
  assert.equal(plan.projectedPath[0].nextState.trailLocked,true);
});

test('Unsupported LucidDaily and LucidDirect accounts are absent',()=>{
  assert.equal(PLANNER_PRESETS.some(p=>/-daily-|-direct-/.test(p.rules.id)),false);
});

test('LucidPro catalog includes all sizes, DLL variants and funded payout targets',()=>{
  const pro=PLANNER_PRESETS.filter(p=>p.rules.id.includes('-pro-'));
  assert.equal(pro.length,8);
  const targets=new Map([[25000,250],[50000,500],[100000,750],[150000,1000]]);
  for(const [size,target] of targets) {
    const variants=pro.filter(p=>p.rules.startingBalance===size);
    assert.equal(variants.length,2);
    assert.deepEqual(variants.map(p=>p.rules.evaluation?.dailyLossLimit?.enabled).sort(),[false,true]);
    assert.ok(variants.every(p=>p.rules.funded.payoutProfitTarget===target));
    assert.ok(variants.every(p=>p.rules.funded.payout.minimumCycleProfit===target));
    assert.ok(variants.every(p=>p.rules.funded.consistency?.maxLargestDayFraction===.4));
    assert.ok(variants.every(p=>p.rules.funded.payout.requiredDays===3));
    assert.ok(variants.every(p=>p.rules.funded.payoutsToLive===5));
  }
  const pro150On=pro.find(p=>p.rules.id==='lucid-150000-pro-dll-on')!.rules;
  assert.equal(pro150On.evaluationFee,300.5);
  assert.equal(pro150On.pricing?.promotionalPrice,245.5);
  assert.equal(pro150On.pricing?.resetFee,245);
  assert.equal(pro150On.funded.dailyLossLimit?.amount,2700);
});

test('Tradeify Growth includes four EOD sizes with Daily and Flex funded paths',()=>{
  const rows=PLANNER_PRESETS.filter(p=>p.rules.provider==='Tradeify');
  assert.equal(rows.length,8);
  assert.ok(rows.every(p=>p.rules.evaluation?.maxLoss.type==='EOD_TRAILING'&&p.rules.funded.maxLoss.type==='EOD_TRAILING'));
  assert.equal(rows.filter(p=>p.rules.funded.payout.frequency==='DAILY').length,4);
  assert.equal(rows.filter(p=>p.rules.funded.payout.frequency==='N_DAYS').length,4);
});

test('Tradeify converts 50% of profit before applying the 90/10 payout split',()=>{
  const preset=PLANNER_PRESETS.find(p=>p.rules.id==='tradeify-25000-growth-daily')!;
  const r=preset.rules;
  let s=createState(r,'tradeify-payout','FUNDED',r.evaluationFee);
  s=transition(s,r,{targetProfit:600,stopLoss:500,hedgeRatio:0,purpose:'PAYOUT_PROGRESS'},'TP');
  assert.equal(isPayoutEligible(s,r),true);
  assert.equal(getMaximumAvailablePayout(s,r),300);
  const paid=applyPayout(s,r);
  assert.equal(paid.cumulativePayouts,270);
  assert.equal(paid.balance,25300);
});

test('saved Tradeify Growth sessions migrate the legacy 100% payout conversion',()=>{
  const preset=PLANNER_PRESETS.find(p=>p.rules.id==='tradeify-25000-growth-daily')!;
  const legacy:EngineSession={
    rules:{...preset.rules,funded:{...preset.rules.funded,payout:{...preset.rules.funded.payout,payoutConversionRate:1}}},
    state:preset.state,
    options:{},history:[],
    selectedPlan:{action:{targetProfit:600,stopLoss:500,hedgeRatio:.055,purpose:'MAX_PAYOUT'},stateKey:'legacy'},
  };
  const migrated=migrateEngineSession(legacy);
  assert.equal(migrated.rules.funded.payout.payoutConversionRate,.5);
  assert.equal(migrated.rules.funded.payout.profitShare,.9);
  assert.equal(migrated.selectedPlan,undefined);
});

test('Apex catalog admits only funded EOD trail variants',()=>{
  const rows=PLANNER_PRESETS.filter(p=>p.rules.provider==='Apex Trader Funding');
  assert.equal(rows.length,8);
  assert.ok(rows.every(p=>p.rules.evaluation?.maxLoss.type==='EOD_TRAILING'&&p.rules.funded.maxLoss.type==='EOD_TRAILING'));
  assert.deepEqual(new Set(rows.map(p=>p.rules.activationFee)),new Set([0,59]));
  assert.ok(rows.every(p=>p.rules.funded.payout.profitShare===1&&p.rules.funded.payout.requiredDays===5));
});

test('Payout cycle clears recovery basis and uses the configured cash-payout share',()=>{
  const r=structuredClone(dailyFunded);
  r.funded.payout={...r.funded.payout,frequency:'DAILY',profitShare:.9,payoutConversionRate:.5,defaultCap:1000};
  r.funded.minimumProfitDays=undefined;
  const s=normalizePayoutCycleState({...createState(r,'cash-cycle','FUNDED',0),phase:'PAYOUT_CYCLE' as const},r);
  const result=optimizeCampaign(s,r,{...options,maxSearchDepth:3,maxStates:5000});
  assert.equal(result.nextAction?.targetProfit,2000);
  // 50% conversion × 90% trader split = 45% hedge in every payout cycle.
  // No evaluation recovery basis carries into that ratio.
  assert.equal(result.nextAction?.hedgeRatio,0.45);
  assert.equal(result.metrics.minimumTerminalCash,0);
  assert.equal(result.metrics.maximumTerminalCash,900);
  assert.equal(result.metrics.optimizationObjective,'MAXIMIN_CASH');
  assert.equal(result.metrics.outcomeCoverageComplete,true);
  assert.equal(result.tpBranch?.resultingState.unrecoveredRealBasis,0);
  assert.equal(result.lossBranch?.resultingState.unrecoveredRealBasis,0);
  assert.match(result.explanation.join(' '),/45\.00%/);
});

test('Phase is the first question and survives subsequent account selection',()=>{
  const ui=render(<StateBuilderDrawer session={session} onClose={()=>{}} onApply={async()=>{}}/>);
  const form=document.getElementById('state-builder-form')!;
  assert.equal(form.querySelector('button, input, select')?.textContent,'EVALUATION');
  fireEvent.click(ui.getByRole('button',{name:'PAYOUT CYCLE',exact:true}));
  fireEvent.change(ui.getByLabelText('Provider'),{target:{value:'Lucid Trading'}});
  assert.equal(ui.getByRole('button',{name:'PAYOUT CYCLE',exact:true}).getAttribute('aria-pressed'),'true');
  assert.ok(ui.getByLabelText('Payouts already received'));
  assert.equal(ui.queryByLabelText('Trading days completed'),null);
});

test('State builder shows evaluation fields and excludes payout counters',()=>{
  const ui=render(<StateBuilderDrawer session={session} onClose={()=>{}} onApply={async()=>{}}/>);
  assert.ok(ui.getByLabelText('Trading days completed'));
  assert.ok(ui.getByLabelText('Current consistency profit'));
  assert.equal(ui.queryByLabelText('Payouts already received'),null);
  assert.equal(ui.queryByLabelText('Today’s realized P&L'),null);
});
test('Funded state exposes DLL but not evaluation counters',()=>{
  const ui=render(<StateBuilderDrawer session={{...session,rules:dailyFunded,state:createState(dailyFunded)}} onClose={()=>{}} onApply={async()=>{}}/>);
  assert.ok(ui.getByLabelText('Today’s realized P&L'));
  assert.equal(ui.queryByLabelText('Trading days completed'),null);
  assert.equal(ui.queryByLabelText('Current consistency profit'),null);
});
test('Payout cycle exposes payout state and buffered derived values',()=>{
  const ui=render(<StateBuilderDrawer session={{...session,rules:bufferedFunded,state:{...createState(bufferedFunded),phase:'PAYOUT_CYCLE'}}} onClose={()=>{}} onApply={async()=>{}}/>);
  assert.ok(ui.getByLabelText('Payouts already received'));
  assert.ok(ui.getByLabelText('Profit since last payout'));
  assert.ok(ui.getByText(/Protected buffer:/));
  assert.equal(ui.queryByLabelText('Cycle trading days'),null);
  assert.equal(ui.queryByLabelText('Trail status'),null);
  assert.ok(ui.getByText(/Locked from the completed first-payout phase/));
});
test('Preset loading uses normalized catalog rules, no provider UI branching',()=>{
  const ui=render(<StateBuilderDrawer session={session} onClose={()=>{}} onApply={async()=>{}}/>);
  fireEvent.change(ui.getByLabelText('Provider'),{target:{value:'Lucid Trading'}});
  assert.equal((ui.getByLabelText('Current balance') as HTMLInputElement).value,'25000');
  fireEvent.change(ui.getByLabelText('Account size'),{target:{value:'50000'}});
  assert.equal((ui.getByLabelText('Current balance') as HTMLInputElement).value,'50000');
  assert.ok(PLANNER_PRESETS.some(p=>p.rules.startingBalance===25000));
});
test('Custom rules remain hidden until requested and payout model is conditional',()=>{
  const ui=render(<StateBuilderDrawer session={session} onClose={()=>{}} onApply={async()=>{}}/>);
  assert.equal(ui.queryByLabelText('Evaluation fee'),null);
  fireEvent.click(ui.getByText('Customize rules'));
  assert.ok(ui.getByLabelText('Evaluation fee'));
  assert.equal(ui.queryByLabelText('Buffer balance'),null);
  fireEvent.change(ui.getByLabelText('Payout model'),{target:{value:'BUFFERED_SURPLUS'}});
  assert.ok(ui.getByLabelText('Buffer balance'));
});
test('Calculate path validates, applies entered state and closes',async()=>{
  let applied=false,closed=false;
  const ui=render(<StateBuilderDrawer session={session} onClose={()=>{closed=true;}} onApply={async next=>{applied=true;assert.equal(next.state.unrecoveredRealBasis,100);}}/>);
  fireEvent.change(ui.getByLabelText('Unrecovered real basis'),{target:{value:'100'}});
  fireEvent.submit(document.getElementById('state-builder-form')!);
  await waitFor(()=>assert.equal(applied,true));assert.equal(closed,true);
});
test('Balance edits reconcile dependent evaluation state',()=>{
  const ui=render(<StateBuilderDrawer session={session} onClose={()=>{}} onApply={async()=>{}}/>);
  fireEvent.change(ui.getByLabelText('Current balance'),{target:{value:'51000'}});
  assert.equal((ui.getByLabelText('Current EOD peak') as HTMLInputElement).value,'51000');
  assert.equal((ui.getByLabelText('Total phase profit') as HTMLInputElement).value,'1000');
  assert.match(ui.getByText(/Profit target remaining:/).textContent??'',/\$2,000/);
});
test('Recommendation and summary preserve the 40% regression display',()=>{
  const html=renderToStaticMarkup(<><CampaignSummaryCards state={session.state} rules={evaluation40} plan={plan}/><NextTradeRecommendation state={session.state} rules={evaluation40} plan={plan}/></>);
  assert.match(html,/1,200/);assert.match(html,/2,000/);assert.match(html,/4.15%/);assert.match(html,/267.91/);
});
test('Both outcome cards render actual transition values',()=>{
  const tp=renderToStaticMarkup(<OutcomeBranchCard title="If target hits" branch={plan.tpBranch} rules={evaluation40}/>);
  const sl=renderToStaticMarkup(<OutcomeBranchCard title="If loss boundary hits" branch={plan.lossBranch} rules={evaluation40}/>);
  assert.match(tp,/51,200/);assert.match(tp,/132.8/);assert.match(sl,/Account failed/);
});
test('Projection separates cash and equity, marks lock and evaluation pass',()=>{
  const data=projectionData(session.state,evaluation40,plan,options);
  assert.equal(data[0].cash,-83);assert.equal(data[0].equity,50000);
  assert.equal(data[1].equity,51200);assert.equal(data[1].cash,-132.8);
  assert.equal(data[2].marker,'Trail locked');assert.equal(data.at(-1)?.equity,53000);
  assert.ok(data.some(p=>p.failureTerminal));
});
test('Buffered projection appends real payout jump and equity debit',()=>{
  const s=createState(bufferedFunded),p=optimizeCampaign(s,bufferedFunded,options);
  const data=projectionData(s,bufferedFunded,p,options),last=data.at(-1)!,previous=data.at(-2)!;
  assert.match(last.marker??'',/Payout #1/);assert.equal(last.cash-previous.cash,500);assert.equal(last.equity,53700);
});
test('Path explorer selects without mutating recommendation',()=>{
  let picked=false;const snapshot=JSON.stringify(plan);
  const ui=render(<PathExplorer plan={plan} selected={null} onSelect={a=>{picked=Boolean(a);}}/>);
  fireEvent.click(ui.getAllByRole('button')[1]);assert.equal(picked,true);assert.equal(JSON.stringify(plan),snapshot);
  const alt=previewAlternative(session.state,evaluation40,options,plan.alternatives[1].action);
  assert.equal(alt.projectedPath[0].action.targetProfit,plan.alternatives[1].action.targetProfit);
});
test('Terminal mapping is per account, percent-correct, and refuses wrong campaign',()=>{
  const mapped=terminalObjective(session.state,evaluation40,plan.nextAction!,session.state.campaignId);
  assert.equal(mapped.targetProfit,1200);assert.equal(mapped.stopLoss,2000);assert.equal(mapped.hedgeRatioPercent,4.15);
  assert.throws(()=>terminalObjective(session.state,evaluation40,plan.nextAction!,'wrong'));
  useAppStore.getState().setLimitOrderStatus('draft');
  useAppStore.getState().setCampaignObjective(mapped);
  assert.equal(useAppStore.getState().limitOrderStatus,'draft');assert.equal(useAppStore.getState().confirmedEntryPrice,null);
  useAppStore.getState().setLimitOrderStatus('confirmed');assert.throws(()=>useAppStore.getState().setCampaignObjective(mapped));
  useAppStore.getState().setLimitOrderStatus('draft');
});
test('Timeline and field adapter remain deterministic; daily DLL target still increases',()=>{
  assert.match(renderToStaticMarkup(<ProjectedPathTimeline state={session.state} plan={plan}/>),/Evaluation passed/);
  assert.ok(!stateFields(session.state,evaluation40).some(f=>f.key==='payoutNumber'));
  const s=createState(dailyFunded),p=optimizeCampaign(s,dailyFunded,options);
  const lost=transition(s,dailyFunded,p.nextAction!,'SL');
  assert.equal(optimizeCampaign(lost,dailyFunded,options).nextAction?.targetProfit,3500);
});
