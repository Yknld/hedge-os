// Presentation adapters only. All financial transitions stay in the engine.
import type { AccountRules, CampaignAction, CampaignRecommendation, CampaignState, OptimizerOptions } from './types';
import { optimizeCampaign } from './optimizer';
import { hedgeRatio, transition } from './state';
import { applyPayout, getCurrentPayoutCap, getCurrentMaxContracts, getDistanceToMll, getRemainingProfitDays, getRemainingEvalTarget, getAdditionalProfitNeededForMaxPayout, isPayoutEligible, phaseRules } from './rules';

export const money = (n: number | null | undefined) => n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', {style:'currency',currency:'USD',maximumFractionDigits:2});
export const rate = (n: number) => `${(n*100).toFixed(2)}%`;
export interface ProjectionPoint { label: string; equity: number; cash: number; marker?: string; failureCash?: number; failureTerminal?: boolean }
export function projectionData(s: CampaignState, r: AccountRules, plan: CampaignRecommendation, o: OptimizerOptions): ProjectionPoint[] {
  const points: ProjectionPoint[] = [{label:'Start',equity:s.balance,cash:s.realizedRealCash}];
  let end=s;
  for (const [i, step] of plan.projectedPath.entries()) {
    const loss=transition(step.state,r,step.action,'SL',o);
    end=step.nextState;
    points.push({label:`Day ${i+1}`,equity:end.balance,cash:end.realizedRealCash,
      marker:!step.state.trailLocked && end.trailLocked ? 'Trail locked' : end.phase==='PASSED_EVAL' ? 'Evaluation passed':undefined,
      failureCash:loss.realizedRealCash,failureTerminal:loss.phase==='FAILED'});
  }
  // Path steps end before payout. Append the same terminal event used by the optimizer.
  if (plan.metrics.projectedPayout>0 && isPayoutEligible(end,r)) {
    const paid=applyPayout(end,r);
    points.push({label:`Payout #${paid.payoutNumber}`,equity:paid.balance,cash:paid.realizedRealCash,
      marker:`Payout #${paid.payoutNumber} +${money(paid.cumulativePayouts-end.cumulativePayouts)}`});
  }
  return points;
}
export function previewAlternative(s: CampaignState,r: AccountRules,o: OptimizerOptions,action: CampaignAction): CampaignRecommendation {
  const win=transition(s,r,action,'TP',o),loss=transition(s,r,action,'SL',o);
  const continuation=optimizeCampaign(win,r,o),lossPlan=optimizeCampaign(loss,r,o);
  return {...continuation,currentStateSummary:s,
    nextAction:{...action,hedgeRatioEquilibrium:hedgeRatio(s,r),hedgeRatioConfigured:action.hedgeRatio},
    projectedPath:[{state:s,action,nextState:win},...continuation.projectedPath],
    tpBranch:{resultingState:win,realCashImpact:win.realizedRealCash-s.realizedRealCash,nextRecommendedAction:continuation.nextAction ?? undefined},
    lossBranch:{resultingState:loss,realCashImpact:loss.realizedRealCash-s.realizedRealCash,nextRecommendedAction:lossPlan.nextAction ?? undefined},
    metrics:{...continuation.metrics,peakWorkingCapital:Math.max(continuation.metrics.peakWorkingCapital,lossPlan.metrics.peakWorkingCapital),
      statesVisited:continuation.metrics.statesVisited+lossPlan.metrics.statesVisited,
      searchTruncated:continuation.metrics.searchTruncated||lossPlan.metrics.searchTruncated},
    explanation:[`User-selected first target ${money(action.targetProfit)}. Later targets are recalculated with the existing bounded optimizer.`,...continuation.explanation],
    warnings:[...new Set([...continuation.warnings,...lossPlan.warnings])],alternatives:[]};
}
export type StateField = {key:keyof CampaignState; label:string};
export function stateFields(s: CampaignState,r: AccountRules): StateField[] {
  const fields: StateField[]=[{key:'balance',label:'Current balance'},{key:'currentMllFloor',label:'Current MLL floor'},{key:'currentEodPeak',label:'Current EOD peak'},
    ...(s.phase==='PAYOUT_CYCLE'?[]:[{key:'unrecoveredRealBasis' as const,label:'Unrecovered real basis'}]),{key:'realizedRealCash',label:'Real cash'}, {key:'cumulativePhaseProfit',label:'Total phase profit'},
    {key:'currentDayNumber',label:'Current day number'}];
  const pr=phaseRules(s,r);
  if(pr.dailyLossLimit?.enabled) fields.push({key:'dailyPnL',label:'Today’s realized P&L'});
  if(pr.consistency?.enabled) fields.push({key:'consistencyLargestDay',label:'Largest winning day in consistency window'},{key:'consistencyProfit',label:'Current consistency profit'});
  if(s.phase==='EVALUATION') fields.push({key:'tradingDaysCompleted',label:'Trading days completed'},{key:'profitableDaysCompleted',label:'Profitable days completed'});
  else {
    fields.push({key:'cumulativeCycleProfit',label:'Current payout-cycle profit'},{key:'profitSinceLastPayout',label:'Profit since last payout'});
    if(r.funded.minimumProfitDays) fields.push({key:'qualifyingDaysCompleted',label:'Qualifying days completed'});
    if(r.funded.payout.frequency==='N_DAYS') fields.push(r.funded.payout.minimumProfitPerDay ? {key:'payoutQualifyingDays',label:'Payout qualifying days'}:{key:'cycleTradingDays',label:'Cycle trading days'});
    if(s.phase==='PAYOUT_CYCLE') fields.push({key:'payoutNumber',label:'Payouts already received'},{key:'cumulativePayouts',label:'Cumulative net payouts'});
    if(r.funded.payout.model==='BUFFERED_SURPLUS' && !r.funded.payout.bufferedSurplus?.payoutReducesBalance) fields.push({key:'consumedSurplus',label:'Previously withdrawn entitlement'});
  }
  return fields;
}
export function nextExplanation(s: CampaignState,r: AccountRules,p: CampaignRecommendation) {
  const a=p.nextAction;
  if(!a) return p.explanation.at(-1) ?? 'No supported next action.';
  if(p.metrics.optimizationObjective==='MAXIMIN_CASH') return p.explanation.filter(line=>line.startsWith('Payout-cycle objective:')||line.startsWith('Selected ')||line.startsWith('Lowest modeled')).join(' ');
  const purpose=a.purpose.replaceAll('_',' ').toLowerCase();
  const context=s.phase==='EVALUATION'
    ? `${money(getRemainingEvalTarget(s,r))} remains to the evaluation profit target.${r.evaluation?.consistency?.enabled?` The largest winning day must stay within ${rate(r.evaluation.consistency.maxLargestDayFraction)} of the applicable consistency profit.`:''}`
    : a.purpose==='QUALIFYING_DAY'
      ? `${getRemainingProfitDays(s,r)} more funded qualifying days remain; the minimum winning day is ${money(r.funded.minimumProfitDays?.minimumProfitPerDay??r.funded.payout.minimumProfitPerDay??0)}.`
      : Number.isFinite(getAdditionalProfitNeededForMaxPayout(s,r))?`${money(getAdditionalProfitNeededForMaxPayout(s,r))} additional profit is needed for the configured maximum payout, before consistency and day checks.`:'';
  return `${money(a.targetProfit)} advances ${purpose} on the selected bounded path. ${context} Unrecovered basis is ${money(s.unrecoveredRealBasis)} against ${money(getDistanceToMll(s,r))} terminal downside: ${rate(a.hedgeRatioEquilibrium)} equilibrium hedge. A daily loss limit can shorten today’s stop without changing that denominator.`;
}
export function terminalObjective(s: CampaignState,r: AccountRules,a: CampaignAction,campaignId: string) {
  if(campaignId!==s.campaignId) throw new Error('Import and review this campaign before sending a plan.');
  if(!['EVALUATION','FUNDED','PAYOUT_CYCLE'].includes(s.phase)) throw new Error('No active trading phase.');
  if(![a.targetProfit,a.stopLoss,a.hedgeRatio].every(Number.isFinite)||a.targetProfit<=0||a.stopLoss<=0||a.hedgeRatio<0) throw new Error('Invalid objective.');
  return {campaignId,targetProfit:a.targetProfit,stopLoss:a.stopLoss,hedgeRatioPercent:a.hedgeRatio*100,purpose:a.purpose,maxContracts:getCurrentMaxContracts(s,r)};
}
export const payoutUnits = (r:AccountRules) => r.funded.payout.model==='BUFFERED_SURPLUS'?'net':'gross';
export const payoutCapLabel = (s:CampaignState,r:AccountRules) => Number.isFinite(getCurrentPayoutCap(s,r))?money(getCurrentPayoutCap(s,r)):'Uncapped';
