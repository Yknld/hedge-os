import { campaignJournalMetrics, type Campaign, type DrawdownType } from '../../store/useAppStore';
import type { AccountRules, DrawdownRule } from './types';
import type { EngineSession } from './persistence';
import { createState } from './state';
import { activateFunded } from './state';
import { optimizeCampaign } from './optimizer';
export function rulesFromCampaign(c: Campaign): AccountRules {
  const drawdown = (amount: number,type: DrawdownType,buffer?: number): DrawdownRule => ({amount,
    type:type === 'end-of-day' ? 'EOD_TRAILING':type === 'intraday-trailing' ? 'INTRADAY_TRAILING':'STATIC',
    locks:Boolean(buffer && type !== 'static'),lockTriggerBalance:buffer ? c.accountSize+buffer:undefined,
    lockedFloor:buffer ? c.accountSize+buffer-amount:undefined});
  const e=c.evaluationRules,p=c.performanceRules;
  return {id:c.id,provider:c.accountTypeName,accountName:c.name,startingBalance:c.accountSize,
    evaluationFee:c.programPrice,activationFee:p.activationFee,
    evaluation:{enabled:true,profitTarget:e.profitTarget,maxLoss:drawdown(e.maxDrawdown,e.drawdownType),
      dailyLossLimit:e.dailyLossLimit ? {enabled:true,amount:e.dailyLossLimit}:undefined,
      consistency:e.consistencyLimit ? {enabled:true,maxLargestDayFraction:e.consistencyLimit/100}:undefined,
      minimumTradingDays:e.minimumTradingDays,maxContracts:e.maxContracts},
    funded:{maxLoss:drawdown(p.maxDrawdown,p.drawdownType,p.bufferLock),maxContracts:p.maxContracts,
      dailyLossLimit:p.dailyLossLimit ? {enabled:true,amount:p.dailyLossLimit}:undefined,
      consistency:p.payoutConsistencyLimit ? {enabled:true,maxLargestDayFraction:p.payoutConsistencyLimit/100}:undefined,
      minimumProfitDays:{requiredDays:p.minimumWinningDaysForPayout,minimumProfitPerDay:p.minimumWinningDayProfit},
      payout:{frequency:p.minimumTradingDaysForPayout>1 ? 'N_DAYS':'DAILY',requiredDays:p.minimumTradingDaysForPayout,
        profitShare:(p.payoutSplitPercent ?? 90)/100,payoutConversionRate:(p.withdrawableBalancePercent ?? 50)/100,
        defaultCap:p.payoutCap ?? undefined,qualifyingDaysResetAfterPayout:true,cycleProfitResets:true,consistencyResetsAfterPayout:true}}};
}
// Existing campaign summaries do not contain historic peaks/day counters. Import
// as a reviewable snapshot, never infer those counters from a hard-coded roadmap.
export function snapshotFromCampaign(c: Campaign) {
  const rules=rulesFromCampaign(c), phase = c.roadmapStage === 'evaluation' || (!c.roadmapStage && c.currentPhase===0) ? 'EVALUATION':'FUNDED';
  const journal=campaignJournalMetrics(c),copies=Math.max(1,c.accountQuantity ?? 1), basis=Math.max(0,(journal.evaluationSpend+journal.hedgingSpend-journal.payoutsReceived)/copies);
  const state=createState(rules,c.id,phase,basis);
  state.balance=journal.currentBalance; state.currentEodPeak=Math.max(state.balance,state.startingBalance);
  state.largestWinningDay=journal.bestDayProfit; state.consistencyLargestDay=journal.bestDayProfit;
  state.cumulativePhaseProfit=journal.currentBalance-c.accountSize; state.consistencyProfit=state.cumulativePhaseProfit; state.cumulativeCycleProfit=state.cumulativePhaseProfit;
  return {rules,state};
}

export function sessionFromCampaign(c: Campaign): EngineSession {
  const {rules,state}=snapshotFromCampaign(c);
  return {
    workspaceTitle:c.name,
    updatedAt:new Date().toISOString(),
    rules,
    state,
    options:{objective:'FULL_PAYOUT',maxSearchDepth:6,maxStates:12000,maxCandidates:6},
    history:[],
  };
}

export interface HedgeRequirement {
  evaluationHedgeCost: number;
  firstPayoutHedgeCost: number;
  total: number;
}

/** Successful-path hedge cash consumed from a fresh evaluation through the
 * first funded payout. Fees remain campaign costs, not hedge-account balance. */
export function minimumHedgeRequirement(rules: AccountRules): HedgeRequirement {
  const options={objective:'FULL_PAYOUT' as const,maxSearchDepth:12,maxStates:12000,maxCandidates:6};
  const evaluation=createState(rules,'hedge-balance-estimate','EVALUATION',rules.evaluationFee);
  const evaluationPlan=optimizeCampaign(evaluation,rules,options);
  const evaluationEnd=evaluationPlan.projectedPath.at(-1)?.nextState ?? evaluation;
  if (evaluationEnd.phase!=='PASSED_EVAL') throw new Error('Evaluation path did not reach activation.');
  const evaluationHedgeCost=Math.max(0,-evaluationEnd.cumulativeLiveHedgePnl+evaluationEnd.cumulativeExecutionCosts);
  const funded=activateFunded(evaluationEnd,rules);
  const fundedPlan=optimizeCampaign(funded,rules,options);
  const fundedEnd=fundedPlan.projectedPath.at(-1)?.nextState ?? funded;
  const total=Math.max(0,-fundedEnd.cumulativeLiveHedgePnl+fundedEnd.cumulativeExecutionCosts);
  return {
    evaluationHedgeCost:Math.ceil(evaluationHedgeCost*100)/100,
    firstPayoutHedgeCost:Math.ceil(Math.max(0,total-evaluationHedgeCost)*100)/100,
    total:Math.ceil(total*100)/100,
  };
}
