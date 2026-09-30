import type { AccountRules, CampaignAction, CampaignPathStep, CampaignRecommendation, CampaignState, OptimizerOptions } from './types';
import { applyPayout, getDistanceToMll, getPayoutCycleHedgeRatio, isPayoutEligible } from './rules';
import { transition } from './state';

type Policy = { value: number; action?: CampaignAction; win?: Policy; loss?: Policy; payout?: boolean; days: number };
type Actions = (s:CampaignState,r:AccountRules,o:OptimizerOptions)=>CampaignAction[];

// Cash is additive and has no effect on PA eligibility. Solve continuation cash
// increments on PA states, then replay the policy with actual hedge accounting.
function geometry(s:CampaignState):CampaignState {
  return {...s,initialRealBasis:0,unrecoveredRealBasis:0,realizedRealCash:0,cumulativeLiveHedgePnl:0,cumulativeExecutionCosts:0,peakWorkingCapital:0};
}

export function optimizePayoutCycle(s:CampaignState,r:AccountRules,o:OptimizerOptions,actions:Actions):CampaignRecommendation {
  const depth=Math.max(1,Math.min(12,o.maxSearchDepth??5,o.maxSearchDays??8));
  const limit=Math.max(1,Math.min(50000,o.maxStates??3000));
  const cost=o.executionCost??0;
  const payoutRatio=getPayoutCycleHedgeRatio(r);
  let visited=0,truncated=false;
  const memo=new Map<string,Policy|null>();
  const alternatives:CampaignRecommendation['alternatives']=[];
  const solve=(input:CampaignState,d:number,root=false):Policy|null=>{
    const x=geometry(input);
    if(x.phase==='FAILED'||x.phase==='COMPLETED')return {value:0,days:0};
    // Taking an eligible payout is a candidate, not a requirement to hit a cap.
    let best:Policy|null=isPayoutEligible(x,r)?{value:applyPayout(x,r).realizedRealCash,payout:true,days:0}:null;
    if(d<=0||visited>=limit){truncated=true;return best;}
    const key=JSON.stringify([d,x]);
    if(!root&&memo.has(key))return memo.get(key)!;
    visited++;
    const generated=actions(x,r,o);
    const candidates=root?generated:generated.slice(0,6);
    if(candidates.length<generated.length)truncated=true;
    for(const candidate of candidates){
      const zeroHedge={...candidate,hedgeRatio:0};
      const win=solve(transition(x,r,zeroHedge,'TP',o),d-1);
      const loss=solve(transition(x,r,zeroHedge,'SL',o),d-1);
      // Never count an unresolved leaf as failure, payout, or zero cash.
      if(!win||!loss)continue;
      // Payout-cycle hedge follows the cash share of new PA profit, rather
      // than reopening the evaluation recovery-basis calculation.
      const h=payoutRatio;
      const value=Math.min(win.value-h*candidate.targetProfit,loss.value+h*candidate.stopLoss)-cost;
      const policy:Policy={value,action:{...candidate,hedgeRatio:h},win,loss,days:1+Math.max(win.days,loss.days)};
      if(root)alternatives.push({action:policy.action!,rank:[-value,policy.days],reason:'Maximize the lower net cash outcome of a fully resolved payout/failure policy; then fewer days.'});
      if(!best||value>best.value+1e-7||(Math.abs(value-best.value)<=1e-7&&policy.days<best.days))best=policy;
    }
    memo.set(key,best);return best;
  };
  const policy=solve(s,depth,true);
  const path:CampaignPathStep[]=[];
  let x=s,n=policy;
  while(n?.action){const next=transition(x,r,n.action,'TP',o);path.push({state:x,action:n.action,nextState:next});x=next;n=n.win!;}
  const end=n?.payout?applyPayout(x,r):x;
  const cash:number[]=[];let peak=s.peakWorkingCapital;
  const replay=(state:CampaignState,node:Policy)=>{
    peak=Math.max(peak,state.peakWorkingCapital);
    if(node.action){replay(transition(state,r,node.action,'TP',o),node.win!);replay(transition(state,r,node.action,'SL',o),node.loss!);}
    else {const terminal=node.payout?applyPayout(state,r):state;peak=Math.max(peak,terminal.peakWorkingCapital);cash.push(terminal.realizedRealCash);}
  };
  if(policy)replay(s,policy);
  const branch=(outcome:'TP'|'SL')=>{
    if(!policy?.action)return undefined;
    const resultingState=transition(s,r,policy.action,outcome,o);
    return {resultingState,realCashImpact:resultingState.realizedRealCash-s.realizedRealCash,nextRecommendedAction:(outcome==='TP'?policy.win:policy.loss)?.action};
  };
  const a=policy?.action;
  return {currentStateSummary:s,nextAction:a?{...a,hedgeRatioEquilibrium:a.hedgeRatio,hedgeRatioConfigured:a.hedgeRatio}:null,
    tpBranch:branch('TP'),lossBranch:branch('SL'),projectedPath:path,
    metrics:{peakWorkingCapital:peak,minimumTerminalCash:cash.length?Math.min(...cash):null,maximumTerminalCash:cash.length?Math.max(...cash):null,
      daysToNextPayoutMin:null,daysToNextPayoutProjected:end.cumulativePayouts>s.cumulativePayouts?path.length:null,
      projectedPayout:end.cumulativePayouts-s.cumulativePayouts,maximumSearchPathDays:policy?.days??0,retainedPaCushion:getDistanceToMll(end,r),
      statesVisited:visited,searchTruncated:truncated,optimizationObjective:'MAXIMIN_CASH',outcomeCoverageComplete:Boolean(policy)},
    alternatives:alternatives.sort((a,b)=>a.rank[0]-b.rank[0]||a.rank[1]-b.rank[1]),
    explanation:[
      'Payout-cycle objective: maximize the lower final real cash outcome, stopping at an eligible payout or account failure. Retained PA equity is not counted as cash.',
      `Payout-cycle hedge is ${(payoutRatio*100).toFixed(2)}%: the configured withdrawal conversion multiplied by the trader payout split. No evaluation recovery basis carries into this phase.`,
      a?`Selected ${(a.hedgeRatio*100).toFixed(2)}% payout-share hedge. Existing real cash is carried into both outcomes; recovery basis is not the hedge denominator.`:'No trade selected: payout is preferable, the account is terminal, or the search could not resolve both branches.',
      ...(policy?[`Lowest modeled terminal cash: $${Math.min(...cash).toFixed(2)}. Net increment from current cash: $${policy.value.toFixed(2)}.`]:[]),
    ],
    warnings:[
      'Model only: one completed trade per day, divisible linear hedge, and configured execution cost. No fill/slippage guarantee or future value assigned to retained PA equity.',
      ...(truncated?['Bounded search: best fully resolved policy found, not a guaranteed global optimum. Unresolved candidates are excluded.']:[]),
      ...(!policy?['No fully resolved payout/failure policy within the search limits. Increase the horizon/budget or review the rules; no hedge recommendation is available.']:[]),
      ...((o.frictionReserve??0)>0||(o.desiredFailureProfit??0)>0?['Recovery reserve/failure-profit inputs do not set the payout-cycle hedge. Configure executionCost for modeled per-trade friction.']:[]),
    ]};
}
