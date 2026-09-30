import type { AccountRules, CampaignState, CampaignAction, OptimizerOptions } from './types';
import { EPS, validateRules, phaseRules, getDistanceToMll, getRemainingDllRoom, getCurrentMaxContracts, getPayoutCycleHedgeRatio, applyEndOfDayTrail, isAccountFailed, isEvaluationPassed, isPayoutEligible, estimatePropFees, getEffectiveMarketDownside, getTotalRealRecoveryRequirement, grossTargetForNet } from './rules';
export const OPTIMIZER_VERSION = '1.2.0';
export function normalizePayoutCycleState(s:CampaignState,r:AccountRules):CampaignState {
  if(s.phase!=='PAYOUT_CYCLE')return s;
  const trailLocked=r.funded.maxLoss.type!=='STATIC' ? true:s.trailLocked;
  return trailLocked!==s.trailLocked || s.unrecoveredRealBasis!==0 ? {...s,trailLocked,unrecoveredRealBasis:0}:s;
}
export function reconcileBalanceEdit(s:CampaignState,r:AccountRules,balance:number):CampaignState {
  let next={...s,balance,currentEodPeak:Math.max(s.currentEodPeak,balance)};
  if(s.phase==='EVALUATION') {
    const profit=balance-s.startingBalance;
    // A manual balance edit is already account equity (net). Preserve that
    // fact so targets/qualification do not fall back to an old gross ledger.
    next={...next,cumulativePhaseProfit:profit,consistencyProfit:profit,netPropPnL:profit};
  }
  return applyEndOfDayTrail(next,r);
}
export function createState(r: AccountRules, campaignId = r.id, phase: 'EVALUATION' | 'FUNDED' = r.evaluation?.enabled ? 'EVALUATION' : 'FUNDED', basis = r.evaluationFee): CampaignState {
  validateRules(r);
  const p = phase === 'EVALUATION' ? r.evaluation! : r.funded;
  return {campaignId,phase,balance:r.startingBalance,startingBalance:r.startingBalance,currentEodPeak:r.startingBalance,
    currentMllFloor:r.startingBalance-p.maxLoss.amount,trailLocked:false,dailyPnL:0,currentDayNumber:1,
    tradingDaysCompleted:0,profitableDaysCompleted:0,qualifyingDaysCompleted:0,largestWinningDay:0,
    cumulativePhaseProfit:0,cumulativeCycleProfit:0,payoutNumber:0,cumulativePayouts:0,currentMaxContracts:p.maxContracts,
    initialRealBasis:basis,unrecoveredRealBasis:basis,realizedRealCash:-basis,cumulativeLiveHedgePnl:0,
    cumulativeExecutionCosts:0,peakWorkingCapital:basis,cycleTradingDays:0,payoutQualifyingDays:0,
    consistencyProfit:0,consistencyLargestDay:0,grossPropPnL:0,estimatedPropFees:0,netPropPnL:0,estimatedLiveFees:0,status:'ACTIVE'};
}
export function validateState(s: CampaignState,r: AccountRules) {
  validateRules(r);
  if (!['EVALUATION','FUNDED','PAYOUT_CYCLE','PASSED_EVAL','FAILED','COMPLETED'].includes(s.phase)) throw new Error('Invalid phase');
  const template=createState(r,s.campaignId,s.phase === 'EVALUATION' ? 'EVALUATION':'FUNDED');
  const optionalFeeFields = new Set(['grossPropPnL','estimatedPropFees','actualPropFees','netPropPnL','estimatedLiveFees','actualLiveFees']);
  for (const [key,value] of Object.entries(template)) {
    if (optionalFeeFields.has(key) && s[key as keyof CampaignState] === undefined) continue;
    if (typeof value === 'number' && (typeof s[key as keyof CampaignState] !== 'number' || !Number.isFinite(s[key as keyof CampaignState]))) throw new Error(`Missing or invalid state field: ${key}`);
  }
  for (const [key,value] of Object.entries(s)) if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Invalid state number: ${key}`);
  if (s.startingBalance !== r.startingBalance || s.unrecoveredRealBasis < 0 || s.currentEodPeak + EPS < s.balance) throw new Error('Invalid balance, basis, or high-water mark');
  for (const key of ['currentDayNumber','tradingDaysCompleted','profitableDaysCompleted','qualifyingDaysCompleted','payoutQualifyingDays','payoutNumber','cycleTradingDays'] as const)
    if (s[key] < 0 || !Number.isInteger(s[key])) throw new Error(`Invalid counter: ${key}`);
  if (s.phase === 'EVALUATION' && !r.evaluation?.enabled) throw new Error('Evaluation is not enabled');
  if (s.phase === 'PAYOUT_CYCLE' && r.funded.maxLoss.type !== 'STATIC' && !s.trailLocked) throw new Error('Payout-cycle PA trail must already be locked');
}
export function hedgeRatio(s: CampaignState,r: AccountRules,o: OptimizerOptions = {}) {
  if (s.phase === 'PAYOUT_CYCLE') return getPayoutCycleHedgeRatio(r);
  const downside = getEffectiveMarketDownside(s,r);
  const recovery = getTotalRealRecoveryRequirement(s,r);
  return downside > 0 ? (recovery+(o.frictionReserve ?? 0)+(o.desiredFailureProfit ?? 0))/downside : 0;
}
// V1: one fully resolved trade per session. Each transition closes the day and
// resets DLL. No assumptions about price excursions are made for intraday trails.
export function transition(s: CampaignState,r: AccountRules,a: CampaignAction,outcome: 'TP' | 'SL',o: OptimizerOptions = {}): CampaignState {
  validateState(s,r);
  if (!['EVALUATION','FUNDED','PAYOUT_CYCLE'].includes(s.phase) || isAccountFailed(s,r)) throw new Error('Account cannot continue');
  if (phaseRules(s,r).maxLoss.type === 'INTRADAY_TRAILING' && !s.trailLocked) throw new Error('Unlocked intraday trailing requires an intratrade path; V1 supports static and EOD trails');
  if (![a.targetProfit,a.stopLoss,a.hedgeRatio].every(Number.isFinite) || a.targetProfit <= 0 || a.stopLoss <= 0 || a.hedgeRatio < 0) throw new Error('Invalid trade geometry');
  if (a.stopLoss > Math.min(getEffectiveMarketDownside(s,r),getRemainingDllRoom(s,r))+EPS) throw new Error('Stop exceeds today’s legal loss room');
  if (a.propContracts !== undefined && (!Number.isInteger(a.propContracts) || a.propContracts < 1 || a.propContracts > getCurrentMaxContracts(s,r))) throw new Error('Contracts exceed scaling tier');
  // Actions express NET business targets. Price movement is gross; simulated
  // prop fees reduce only prop equity, never the real recovery basis.
  const grossPnl = outcome === 'TP' ? grossTargetForNet(r, a.targetProfit) : -a.stopLoss;
  const propFees = estimatePropFees(r, grossPnl);
  const pnl = grossPnl - propFees, hedge = -grossPnl*a.hedgeRatio, costs = o.executionCost ?? 0;
  if (costs < 0 || !Number.isFinite(costs)) throw new Error('Invalid execution cost');
  const dayProfit = s.dailyPnL+pnl;
  let n: CampaignState = {...s,balance:s.balance+pnl,dailyPnL:0,currentDayNumber:s.currentDayNumber+1,
    tradingDaysCompleted:s.tradingDaysCompleted+1,cycleTradingDays:s.cycleTradingDays+1,
    profitableDaysCompleted:s.profitableDaysCompleted+(dayProfit > EPS ? 1:0),
    qualifyingDaysCompleted:s.qualifyingDaysCompleted+(dayProfit > EPS && dayProfit+EPS >= (r.funded.minimumProfitDays?.minimumProfitPerDay ?? 0) ? 1:0),
    payoutQualifyingDays:s.payoutQualifyingDays+(dayProfit > EPS && dayProfit+EPS >= (r.funded.payout.minimumProfitPerDay ?? 0) ? 1:0),
    largestWinningDay:Math.max(s.largestWinningDay,dayProfit),consistencyLargestDay:Math.max(s.consistencyLargestDay,dayProfit),
    consistencyProfit:s.consistencyProfit+pnl,cumulativePhaseProfit:s.cumulativePhaseProfit+pnl,cumulativeCycleProfit:s.cumulativeCycleProfit+pnl,
    profitSinceLastPayout:(s.profitSinceLastPayout ?? s.cumulativeCycleProfit)+pnl,
    cumulativeLiveHedgePnl:s.cumulativeLiveHedgePnl+hedge,cumulativeExecutionCosts:s.cumulativeExecutionCosts+costs,
    grossPropPnL:(s.grossPropPnL ?? s.cumulativePhaseProfit)+grossPnl,
    estimatedPropFees:(s.estimatedPropFees ?? 0)+propFees,
    netPropPnL:(s.netPropPnL ?? s.cumulativePhaseProfit)+pnl,
    estimatedLiveFees:getTotalRealRecoveryRequirement(s,r)-s.unrecoveredRealBasis,
    realizedRealCash:s.realizedRealCash+hedge-costs,
    unrecoveredRealBasis:s.phase==='PAYOUT_CYCLE' ? 0:Math.max(0,s.unrecoveredRealBasis-hedge+costs),status:'ACTIVE'};
  n.peakWorkingCapital = Math.max(s.peakWorkingCapital,-n.realizedRealCash);
  // Failure at the existing floor must be evaluated before end-of-day changes.
  if (isAccountFailed(n,r)) return {...n,phase:'FAILED',status:'FAILED'};
  n = applyEndOfDayTrail(n,r);
  if (isAccountFailed(n,r)) return {...n,phase:'FAILED',status:'FAILED'};
  n.currentMaxContracts = getCurrentMaxContracts(n,r);
  if (isEvaluationPassed(n,r)) return {...n,phase:'PASSED_EVAL',status:'PASSED'};
  if (isPayoutEligible(n,r)) n.status = 'PAYOUT_ELIGIBLE';
  return n;
}
export function activateFunded(s: CampaignState,r: AccountRules): CampaignState {
  if (s.phase !== 'PASSED_EVAL') throw new Error('Evaluation must pass before activation');
  const fresh = createState(r,s.campaignId,'FUNDED',s.initialRealBasis);
  return {...fresh,initialRealBasis:s.initialRealBasis,unrecoveredRealBasis:s.unrecoveredRealBasis+r.activationFee,
    realizedRealCash:s.realizedRealCash-r.activationFee,cumulativeLiveHedgePnl:s.cumulativeLiveHedgePnl,
    cumulativeExecutionCosts:s.cumulativeExecutionCosts,peakWorkingCapital:Math.max(s.peakWorkingCapital,r.activationFee-s.realizedRealCash),
    cumulativePayouts:s.cumulativePayouts,payoutNumber:s.payoutNumber};
}
export interface OutcomeProbabilityModel { getWinProbability(action: CampaignAction,state: CampaignState): number }
export const driftlessFirstPassage: OutcomeProbabilityModel = {
  getWinProbability: (a) => a.stopLoss/(a.targetProfit+a.stopLoss),
};
