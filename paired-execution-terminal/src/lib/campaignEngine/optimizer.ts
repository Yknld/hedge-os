import type { AccountRules, CampaignState, CampaignAction, OptimizerOptions, CampaignRecommendation, CampaignPathStep } from './types';
import { EPS, phaseRules, getDistanceToMll, getEffectiveMarketDownside, getRemainingDllRoom, getCurrentMaxContracts, getRemainingEvalTarget, getAdditionalProfitNeededForConsistency, getRemainingProfitDays, getAdditionalProfitNeededForMaxPayout, getCurrentPayoutCap, getMaximumAvailablePayout, isPayoutEligible, applyPayout } from './rules';
import { hedgeRatio, transition, validateState } from './state';
import { optimizePayoutCycle } from './payoutCycle';
import { getBufferBalance, getPayoutTargetBalance, getConsistencyDenominator, getWithdrawableSurplus } from './rules';
export function generateValidActions(s: CampaignState,r: AccountRules,o: OptimizerOptions = {}): CampaignAction[] {
  if (!['EVALUATION','FUNDED','PAYOUT_CYCLE'].includes(s.phase)) return [];
  const loss = Math.min(getEffectiveMarketDownside(s,r),getRemainingDllRoom(s,r));
  if (loss <= EPS || (phaseRules(s,r).maxLoss.type === 'INTRADAY_TRAILING' && !s.trailLocked)) return [];
  const targets = new Map<number,CampaignAction['purpose']>();
  let minimumUnlockedTarget=0;
  const add = (n: number,p: CampaignAction['purpose']) => { if (Number.isFinite(n) && n > EPS && n+EPS>=minimumUnlockedTarget) { const value=Math.ceil((n-EPS)*100)/100;if(!targets.has(value))targets.set(value,p); } };
  const evalPhase = s.phase === 'EVALUATION', pr = phaseRules(s,r), dd = pr.maxLoss;
  // A funded EOD trail must be crossed by the first successful objective, but
  // the lock does not need its own day. Keep the exact lock as a candidate and
  // also let later payout/consistency boundaries compete. This allows a single
  // legal trade to both lock the trail and reach a payout when account rules
  // impose no additional qualifying-day constraint.
  if (!evalPhase && dd.type === 'EOD_TRAILING' && dd.locks && !s.trailLocked) {
    const lockDistance = (dd.lockTriggerBalance ?? s.balance) - s.balance;
    minimumUnlockedTarget=Math.max(0,lockDistance);
    add(lockDistance,'TRAIL_LOCK');
  }
  const c = pr.consistency?.enabled ? pr.consistency.maxLargestDayFraction : 1;
  const remaining = evalPhase ? getRemainingEvalTarget(s,r) : getAdditionalProfitNeededForMaxPayout(s,r);
  const days = evalPhase ? Math.max(1,(r.evaluation?.minimumTradingDays ?? 0)-s.tradingDaysCompleted,Math.ceil(1/c)-s.profitableDaysCompleted) : Math.max(1,getRemainingProfitDays(s,r),(r.funded.payout.requiredDays ?? 0)-s.cycleTradingDays);
  // A fresh consistency evaluation should not offer a one-day target that
  // immediately creates extra profit beyond the advertised evaluation goal.
  // Catch-up targets remain available after an oversized winning day.
  if (!evalPhase || c >= 1 || s.consistencyLargestDay > (r.evaluation?.profitTarget ?? 0)*c+EPS)
    add(remaining,evalPhase ? 'EVAL_PROGRESS':'MAX_PAYOUT');
  add(remaining/days,evalPhase ? 'EVAL_PROGRESS':'PAYOUT_PROGRESS');
  if(!evalPhase && r.funded.payout.model==='BUFFERED_SURPLUS') {
    const bufferDistance=Math.max(0,getBufferBalance(r)-s.balance);
    add(bufferDistance,'TRAIL_LOCK');
    add(bufferDistance/Math.max(1,Math.ceil(1/c)),'CONSISTENCY');
    const firstPayoutDistance=getPayoutTargetBalance(s,r)-s.balance;
    add(firstPayoutDistance,'PAYOUT_PROGRESS');
    add(firstPayoutDistance/Math.max(days,Math.ceil(1/c)),'CONSISTENCY');
  }
  if (evalPhase) add(Math.min(remaining,(r.evaluation?.profitTarget ?? 0)*c),'CONSISTENCY');
  add(getAdditionalProfitNeededForConsistency(s,r),'CONSISTENCY');
  if (c < 1 && getConsistencyDenominator(s,r) > 0) add(c*getConsistencyDenominator(s,r)/(1-c),'CONSISTENCY');
  if (dd.locks && !s.trailLocked) add((dd.lockTriggerBalance ?? s.balance)-s.balance,'TRAIL_LOCK');
  if (!evalPhase) {
    add(r.funded.minimumProfitDays?.minimumProfitPerDay ?? 0,'QUALIFYING_DAY');
    add(r.funded.payout.minimumProfitPerDay ?? 0,'QUALIFYING_DAY');
    add(getPayoutTargetBalance(s,r)-s.balance,'PAYOUT_PROGRESS');
    add((r.funded.payout.minimumCycleProfit ?? 0)-s.cumulativeCycleProfit,'PAYOUT_PROGRESS');
    for (const tier of r.funded.scalingPlan ?? []) add(s.startingBalance+tier.minimumProfit-s.balance,'PAYOUT_PROGRESS');
  }
  const boundaryCount = targets.size;
  for (const n of [100,150,180,200,250,300,400,500,600,750,1000,1200,1500,2000,2100,2500,3000,3500]) add(n,'CUSTOM');
  // Keep exact rule boundaries before supplemental round-number candidates.
  const limit = Math.max(boundaryCount,o.maxCandidates ?? 10);
  return [...targets].slice(0,limit).map(([targetProfit,purpose]) => ({targetProfit,stopLoss:loss,hedgeRatio:hedgeRatio(s,r,o),propContracts:Math.min(1,getCurrentMaxContracts(s,r)),purpose}));
}
type Node = {action?: CampaignAction; win?: Node; loss?: Node; state: CampaignState; rank: number[]; resolved: boolean;
  peak: number; basis: number; failureDeficit: number; min: number | null; max: number | null; days: number; payout: number; path: CampaignPathStep[]};
const compare = (a: number[],b: number[]) => {for (let i=0;i<a.length;i++) if (Math.abs(a[i]-b[i]) > EPS) return a[i]-b[i]; return 0;};
export function optimizeCampaign(s: CampaignState,r: AccountRules,o: OptimizerOptions = {}): CampaignRecommendation {
  validateState(s,r);
  for (const n of [o.maxSearchDepth,o.maxSearchDays,o.maxStates,o.maxCandidates]) if (n !== undefined && (!Number.isInteger(n) || n<1)) throw new Error('Search limits must be positive integers');
  for (const n of [o.executionCost,o.frictionReserve,o.desiredFailureProfit]) if (n !== undefined && (!Number.isFinite(n) || n<0)) throw new Error('Reserves and costs must be nonnegative');
  if(s.phase==='PAYOUT_CYCLE')return optimizePayoutCycle(s,r,o,generateValidActions);
  const depth = Math.max(1,Math.min(12,o.maxSearchDepth ?? 5,o.maxSearchDays ?? 8));
  const maxStates = Math.max(1,Math.min(50000,o.maxStates ?? 3000));
  let visited = 0, truncated = false;
  const cache = new Map<string,Node>();
  const rank = (resolved: boolean,peak: number,basis: number,days: number,payout: number,min: number | null) => {
    const solvency = Math.max(0,-(min ?? 0));
    const capital = [peak,basis,days,-payout,days*2];
    if (s.phase === 'EVALUATION') return [resolved ? 0:1,solvency,days,peak,basis,-payout];
    if (o.mode === 'FASTEST_PAYOUT') return [resolved ? 0:1,solvency,days,...capital];
    if (o.mode === 'HIGHEST_PAYOUT') return [resolved ? 0:1,solvency,-payout,...capital];
    return [resolved ? 0:1,solvency,...capital];
  };
  const terminal = (x: CampaignState): Node | null => {
    const payoutReady = isPayoutEligible(x,r) && (o.objective !== 'FULL_PAYOUT' || !Number.isFinite(getCurrentPayoutCap(x,r)) || getMaximumAvailablePayout(x,r)+EPS >= getCurrentPayoutCap(x,r));
    if (!['FAILED','COMPLETED','PASSED_EVAL'].includes(x.phase) && !payoutReady) return null;
    const end = payoutReady ? applyPayout(x,r) : x;
    const payout = end.cumulativePayouts-s.cumulativePayouts;
    return {state:end,resolved:true,peak:end.peakWorkingCapital,basis:end.unrecoveredRealBasis,failureDeficit:x.phase === 'FAILED' ? Math.max(0,-end.realizedRealCash):0,min:end.realizedRealCash,max:end.realizedRealCash,days:0,payout,path:[],rank:rank(true,end.peakWorkingCapital,end.unrecoveredRealBasis,0,payout,x.phase === 'FAILED' ? end.realizedRealCash : 0)};
  };
  const leaf = (x: CampaignState): Node => ({state:x,resolved:false,peak:x.peakWorkingCapital,basis:x.unrecoveredRealBasis,failureDeficit:0,min:null,max:null,days:0,payout:0,path:[],rank:rank(false,x.peakWorkingCapital,x.unrecoveredRealBasis,depth+1,0,0)});
  const combine = (x: CampaignState,a: CampaignAction,w: Node,l: Node): Node => {
    const winState = transition(x,r,a,'TP',o);
    const values = [w.min,l.min].filter((v):v is number => v !== null), maxima = [w.max,l.max].filter((v):v is number => v !== null);
    const peak = Math.max(w.peak,l.peak), resolved = w.resolved && l.resolved;
    const days = 1+Math.max(w.days,l.days), min = values.length ? Math.min(...values):null, max = maxima.length ? Math.max(...maxima):null;
    const failureDeficit=Math.max(w.failureDeficit,l.failureDeficit);
    return {state:x,action:a,win:w,loss:l,resolved,peak,basis:w.basis,failureDeficit,min,max,days,payout:w.payout,
      rank:rank(resolved,peak,w.basis,1+w.path.length,w.payout,-failureDeficit),
      path:[{state:x,action:a,nextState:winState},...w.path]};
  };
  const solve = (x: CampaignState,d: number,budget: number,ancestors: Set<string>): Node => {
    const end = terminal(x); if (end) return end;
    if (d<=0 || budget<1 || visited>=maxStates) {truncated=true;return leaf(x);}
    // Includes every state field, rules fixed per invocation, depth and budget.
    const stateKey = JSON.stringify(x), key = stateKey+':'+d+':'+budget;
    if (ancestors.has(stateKey)) {truncated=true;return leaf(x);}
    const cached = cache.get(key); if(cached) return cached;
    visited++;
    const generated = generateValidActions(x,r,o);
    // Bounded continuation beam keeps rule-derived full, evenly divided, and
    // consistency/lock targets. Root alternatives are all evaluated.
    const actions = generated.slice(0,r.funded.payout.model==='BUFFERED_SURPLUS' ? 6:3);
    if (generated.length>actions.length) truncated=true;
    if (!actions.length) return leaf(x);
    const nextAncestors = new Set(ancestors).add(stateKey);
    const branches=actions.reduce((count,a)=>count+(terminal(transition(x,r,a,'TP',o))?0:1)+(terminal(transition(x,r,a,'SL',o))?0:1),0);
    const share = Math.floor((budget-1)/Math.max(1,branches));
    let best: Node | undefined;
    for (const a of actions) {
      const w = solve(transition(x,r,a,'TP',o),d-1,share,nextAncestors);
      const l = solve(transition(x,r,a,'SL',o),d-1,share,nextAncestors);
      const candidate = combine(x,a,w,l);
      if (!best || compare(candidate.rank,best.rank)<0) best=candidate;
    }
    cache.set(key,best!); return best!;
  };
  const actions = generateValidActions(s,r,o), alternatives: CampaignRecommendation['alternatives'] = [];
  let best = terminal(s);
  if (!best) for (const a of actions) {
    const share = Math.floor(maxStates/Math.max(1,actions.length*2));
    const node = combine(s,a,solve(transition(s,r,a,'TP',o),depth-1,share,new Set()),solve(transition(s,r,a,'SL',o),depth-1,share,new Set()));
    alternatives.push({action:a,rank:node.rank,reason:'Lexicographic: completed continuation, failure solvency, peak capital, basis, days, payout.'});
    if (!best || compare(node.rank,best.rank)<0) best=node;
  }
  best ??= leaf(s);
  const a = best.action;
  const branch = (outcome: 'TP'|'SL',node: Node | undefined) => {
    const resultingState = transition(s,r,a!,outcome,o);
    return {resultingState,realCashImpact:resultingState.realizedRealCash-s.realizedRealCash,nextRecommendedAction:node?.action};
  };
  const warnings = ['V1 assumes one complete TP/SL trade per day and a linear, divisible hedge. No partial fills or intratrade excursions.'];
  if (truncated) warnings.push('Bounded search: terminal cash range covers reached leaves only; global optimality and unresolved outcomes are not guaranteed.');
  if (phaseRules(s,r).maxLoss.type === 'INTRADAY_TRAILING' && !s.trailLocked) warnings.push('Intraday trailing needs a price-path model. Recommendations are unavailable until that is supplied or the trail is locked.');
  if (o.mode === 'BALANCED') warnings.push('BALANCED currently uses CAPITAL_EFFICIENT lexicographic ranking; no subjective weights are applied.');
  return {currentStateSummary:s,nextAction:a ? {...a,hedgeRatioEquilibrium:hedgeRatio(s,r),hedgeRatioConfigured:a.hedgeRatio}:null,
    tpBranch:a ? branch('TP',best.win):undefined,lossBranch:a ? branch('SL',best.loss):undefined,
    projectedPath:best.path,metrics:{peakWorkingCapital:best.peak,minimumTerminalCash:best.min,maximumTerminalCash:best.max,
      daysToNextPayoutMin:null,daysToNextPayoutProjected:best.payout>0 ? best.path.length:null,projectedPayout:best.payout,
      maximumSearchPathDays:best.days,retainedPaCushion:(() => {const end=best.path.length ? best.path[best.path.length-1].nextState:s;return getDistanceToMll(isPayoutEligible(end,r) ? applyPayout(end,r):end,r);})(),
      statesVisited:visited,searchTruncated:truncated},warnings,
    explanation:[`Balance $${s.balance.toFixed(2)}; MLL floor $${s.currentMllFloor.toFixed(2)}; total downside $${getDistanceToMll(s,r).toFixed(2)}.`,
      `Unrecovered basis $${s.unrecoveredRealBasis.toFixed(2)} / terminal downside gives ${(100*hedgeRatio(s,r)).toFixed(2)}% equilibrium hedge.`,
      `Today's stop is limited by both remaining DLL room and MLL; DLL is not the hedge denominator.`,
      ...(s.phase !== 'EVALUATION' && r.funded.payout.model==='BUFFERED_SURPLUS' ? [
        `Protected buffer $${getBufferBalance(r).toFixed(2)}; withdrawable surplus $${getWithdrawableSurplus(s,r).toFixed(2)}.`,
        `Minimum payout balance is $${getPayoutTargetBalance(s,r).toFixed(2)} before consistency and qualifying-day checks.`,
        `Buffered payout caps apply to trader cash; gross equity withdrawn is trader cash divided by the split.`
      ]:s.phase !== 'EVALUATION' && Number.isFinite(getCurrentPayoutCap(s,r)) ? [`Full gross payout $${getCurrentPayoutCap(s,r)} requires $${getAdditionalProfitNeededForMaxPayout(s,r).toFixed(2)} additional profit at the configured conversion rate.`]:[]),
      a ? `Selected $${a.targetProfit} target (${a.purpose}) from ${actions.length} boundary candidates using ${o.mode ?? 'CAPITAL_EFFICIENT'} ranking.`:'No trade is needed at this terminal event, or no valid supported action exists.'],alternatives:alternatives.sort((x,y)=>compare(x.rank,y.rank))};
}
