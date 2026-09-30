import type { AccountRules, CampaignState, FeeConfig, FundedSubstate } from './types';
export const EPS = 1e-7;
export const DEFAULT_FEE_CONFIG: FeeConfig = Object.freeze({
  enabled: true,
  // Exact contract-based Tradovate commissions are applied at order creation.
  // The campaign engine therefore plans net objectives without a percentage
  // approximation that would double-count those commissions.
  propTargetBufferPct: 0,
  // Conservative temporary reserve for real live-side commissions/slippage.
  liveRecoveryFeeBufferPct: 0.04,
});
export function getFeeConfig(r: AccountRules): FeeConfig {
  const configured = r.feeConfig;
  // Existing persisted campaigns predate fee configuration. Keep them stable
  // until their configuration is explicitly migrated/saved with fees enabled.
  if (!configured) return { ...DEFAULT_FEE_CONFIG, enabled: false };
  return {
    enabled: configured.enabled !== false,
    propTargetBufferPct: Math.max(0, Math.min(.95, configured.propTargetBufferPct || 0)),
    liveRecoveryFeeBufferPct: Math.max(0, Math.min(.95, configured.liveRecoveryFeeBufferPct || 0)),
  };
}
export function estimatePropFees(r: AccountRules, grossMarketPnl: number) {
  const config = getFeeConfig(r);
  return config.enabled ? Math.abs(grossMarketPnl) * config.propTargetBufferPct : 0;
}
export function grossTargetForNet(r: AccountRules, netTarget: number) {
  const config = getFeeConfig(r);
  return config.enabled ? netTarget / Math.max(EPS, 1 - config.propTargetBufferPct) : netTarget;
}
export function netPropPnl(r: AccountRules, grossMarketPnl: number, actualFees?: number) {
  const fees = Number.isFinite(actualFees) ? Math.max(0, actualFees!) : estimatePropFees(r, grossMarketPnl);
  return grossMarketPnl - fees;
}
export function getEstimatedLiveFees(s: CampaignState, r: AccountRules) {
  if (Number.isFinite(s.actualLiveFees)) return Math.max(0, s.actualLiveFees!);
  const config = getFeeConfig(r);
  return config.enabled ? Math.max(0, s.unrecoveredRealBasis) * config.liveRecoveryFeeBufferPct : 0;
}
export function getTotalRealRecoveryRequirement(s: CampaignState, r: AccountRules) {
  return Math.max(0, s.unrecoveredRealBasis) + getEstimatedLiveFees(s, r);
}
export function getEffectiveMarketDownside(s: CampaignState, r: AccountRules) {
  const remainingMll = getDistanceToMll(s, r);
  // Prop fees reduce simulated equity room, but are never part of real cash recovery.
  return Math.max(0, remainingMll - estimatePropFees(r, remainingMll));
}
export const phaseRules = (s: CampaignState, r: AccountRules) =>
  s.phase === 'EVALUATION' && r.evaluation?.enabled ? r.evaluation : r.funded;
export function validateRules(r: AccountRules) {
  if (!(r.startingBalance > 0) || r.evaluationFee < 0 || r.activationFee < 0) throw new Error('Invalid account balance or fees');
  for (const p of [r.evaluation, r.funded]) {
    if (!p) continue;
    if (!(p.maxLoss.amount > 0) || !Number.isInteger(p.maxContracts) || p.maxContracts < 1) throw new Error('Drawdown and contract limit must be positive');
    if (p.dailyLossLimit?.enabled && !(p.dailyLossLimit.amount > 0)) throw new Error('DLL must be positive');
    if (p.consistency?.enabled && !(p.consistency.maxLargestDayFraction > 0 && p.consistency.maxLargestDayFraction <= 1)) throw new Error('Consistency must be in (0, 1]');
    if (p.maxLoss.locks && (p.maxLoss.lockTriggerBalance === undefined || p.maxLoss.lockedFloor === undefined || p.maxLoss.lockedFloor >= p.maxLoss.lockTriggerBalance)) throw new Error('Configure both lock trigger and a lower locked floor');
  }
  const p = r.funded.payout;
  if (p.minimumCycleProfit !== undefined && p.minimumCycleProfit < 0) throw new Error('Minimum cycle profit cannot be negative');
  if (p.model === 'BUFFERED_SURPLUS') {
    const b=p.bufferedSurplus;
    if (!b || (b.bufferBalance === undefined && b.bufferAboveStartingBalance === undefined)) throw new Error('Buffered payout requires a buffer balance or offset');
    if (b.bufferBalance !== undefined && b.bufferAboveStartingBalance !== undefined && Math.abs(b.bufferBalance-r.startingBalance-b.bufferAboveStartingBalance)>EPS) throw new Error('Buffer balance and offset disagree');
    if (!Number.isFinite(getBufferBalance(r)) || getBufferBalance(r)<r.startingBalance) throw new Error('Invalid protected buffer');
    if (typeof b.payoutReducesBalance !== 'boolean' || typeof b.bufferIsProtected !== 'boolean') throw new Error('Configure buffer protection and payout debit behavior');
  }
  if (!(p.profitShare > 0 && p.profitShare <= 1) || !((p.payoutConversionRate ?? 1) > 0 && (p.payoutConversionRate ?? 1) <= 1)) throw new Error('Payout rates must be in (0, 1]');
  if (p.frequency === 'N_DAYS' && !(p.requiredDays && p.requiredDays > 0)) throw new Error('Payout frequency requires a positive day count');
}
export const getCurrentMllFloor = (s: CampaignState, _r: AccountRules) => s.currentMllFloor;
export const getDistanceToMll = (s: CampaignState, r: AccountRules) => Math.max(0, s.balance - getCurrentMllFloor(s, r));
export function getRemainingDllRoom(s: CampaignState, r: AccountRules) {
  const dll = phaseRules(s, r).dailyLossLimit;
  return dll?.enabled ? Math.max(0, dll.amount + s.dailyPnL) : Infinity;
}
export function getCurrentMaxContracts(s: CampaignState, r: AccountRules) {
  const base = phaseRules(s, r).maxContracts;
  if (s.phase === 'EVALUATION') return base;
  const tier = [...(r.funded.scalingPlan ?? [])].sort((a,b) => b.minimumProfit - a.minimumProfit)
    .find(t => s.balance - s.startingBalance >= t.minimumProfit && (t.maximumProfit === undefined || s.balance - s.startingBalance < t.maximumProfit));
  return tier ? Math.min(base, tier.maxContracts) : base;
}
export function getConsistencyRequirement(s: CampaignState, r: AccountRules) {
  const c = phaseRules(s,r).consistency;
  return c?.enabled ? s.consistencyLargestDay / c.maxLargestDayFraction : 0;
}
export function getConsistencyDenominator(s: CampaignState,r: AccountRules) {
  switch(phaseRules(s,r).consistency?.denominator) {
    case 'TOTAL_ACCOUNT_PROFIT': return s.cumulativePhaseProfit;
    case 'CURRENT_PAYOUT_CYCLE_PROFIT': return s.cumulativeCycleProfit;
    case 'PROFIT_SINCE_LAST_PAYOUT': return s.profitSinceLastPayout ?? s.cumulativeCycleProfit;
    case 'WITHDRAWABLE_PROFIT': return getWithdrawableSurplus(s,r);
    default: return s.consistencyProfit;
  }
}
export function getAdditionalProfitNeededForConsistency(s: CampaignState,r: AccountRules) {
  const required=getConsistencyRequirement(s,r);
  if(required<=EPS) return 0;
  if(phaseRules(s,r).consistency?.denominator==='WITHDRAWABLE_PROFIT' && r.funded.payout.model==='BUFFERED_SURPLUS') {
    const b=r.funded.payout.bufferedSurplus!;
    const signedSurplus=s.balance-(b.bufferIsProtected ? getBufferBalance(r):s.startingBalance)-(b.payoutReducesBalance ? 0:s.consumedSurplus ?? 0);
    return Math.max(0,required-signedSurplus);
  }
  return Math.max(0,required-getConsistencyDenominator(s,r));
}
export const getRemainingEvalTarget = (s: CampaignState,r: AccountRules) => Math.max(0,(r.evaluation?.profitTarget ?? 0)-(s.netPropPnL ?? s.cumulativePhaseProfit));
export const getRemainingProfitDays = (s: CampaignState,r: AccountRules) => Math.max(0,(r.funded.minimumProfitDays?.requiredDays ?? 0)-s.qualifyingDaysCompleted);
export const getCurrentPayoutCap = (s: CampaignState,r: AccountRules) => r.funded.payout.capsByPayoutNumber?.[s.payoutNumber] ?? r.funded.payout.defaultCap ?? Infinity;
// Once a payout has cleared the recovery basis, hedge the fraction of new PA
// profit that becomes trader cash. For a 50% withdrawal conversion and a 90%
// trader split, that is 0.50 × 0.90 = 45%.
export const getPayoutCycleHedgeRatio = (r: AccountRules) => {
  const payout = r.funded.payout;
  return (payout.model === 'BUFFERED_SURPLUS' ? 1 : (payout.payoutConversionRate ?? 1)) * payout.profitShare;
};
export const eligibleProfit = (s: CampaignState,r: AccountRules) => Math.max(0, Math.min(s.balance-s.startingBalance, r.funded.payout.cycleProfitResets ? s.cumulativeCycleProfit : Infinity));
export const getBufferBalance = (r: AccountRules) => r.funded.payout.bufferedSurplus?.bufferBalance ?? r.startingBalance+(r.funded.payout.bufferedSurplus?.bufferAboveStartingBalance ?? 0);
export function getWithdrawableSurplus(s: CampaignState,r: AccountRules) {
  if (r.funded.payout.model !== 'BUFFERED_SURPLUS') return eligibleProfit(s,r);
  const b=r.funded.payout.bufferedSurplus!;
  return Math.max(0,s.balance-(b.bufferIsProtected ? getBufferBalance(r):s.startingBalance)-(b.payoutReducesBalance ? 0:(s.consumedSurplus ?? 0)));
}
// PROFIT_CONVERSION caps/minimum are gross; BUFFERED_SURPLUS caps/minimum
// are trader cash, matching min(surplus * split, cap). Debit gross = net/split.
export function getMaximumAvailablePayout(s: CampaignState,r: AccountRules) {
  if (r.funded.payout.model === 'BUFFERED_SURPLUS') return Math.max(0,Math.min(getWithdrawableSurplus(s,r)*r.funded.payout.profitShare,getCurrentPayoutCap(s,r),
    r.funded.payout.bufferedSurplus!.payoutReducesBalance ? (getDistanceToMll(s,r)-0.01)*r.funded.payout.profitShare:Infinity));
  return Math.max(0,Math.min(eligibleProfit(s,r)*(r.funded.payout.payoutConversionRate ?? 1),getCurrentPayoutCap(s,r),getDistanceToMll(s,r)-EPS));
}
export function getPayoutTargetBalance(s: CampaignState,r: AccountRules,amount=r.funded.payout.minimumPayout ?? 0) {
  const p=r.funded.payout,b=p.bufferedSurplus;
  return p.model==='BUFFERED_SURPLUS' ? (b!.bufferIsProtected ? getBufferBalance(r):s.startingBalance)+(b!.payoutReducesBalance ? 0:s.consumedSurplus ?? 0)+amount/p.profitShare : s.startingBalance+amount/(p.payoutConversionRate ?? 1);
}
export const getAdditionalProfitNeededForMaxPayout = (s: CampaignState,r: AccountRules) => r.funded.payout.model==='BUFFERED_SURPLUS'
  ? Math.max(0,getPayoutTargetBalance(s,r,getCurrentPayoutCap(s,r))-s.balance)
  : Math.max(0,getCurrentPayoutCap(s,r)/(r.funded.payout.payoutConversionRate ?? 1)-Math.min(s.balance-s.startingBalance,r.funded.payout.cycleProfitResets ? s.cumulativeCycleProfit : Infinity));
export function getFundedSubstate(s: CampaignState,r: AccountRules): FundedSubstate {
  if(isPayoutEligible(s,r)) return 'PAYOUT_ELIGIBLE';
  if(r.funded.payout.model==='BUFFERED_SURPLUS') {
    if(s.balance<getBufferBalance(r)-EPS) return 'BUFFER_BUILDING';
    if(getWithdrawableSurplus(s,r)<=EPS) return 'BUFFER_LOCKED';
    return 'SURPLUS_BUILDING';
  }
  return s.trailLocked ? 'SURPLUS_BUILDING':'TRAILING';
}
export const isAccountFailed = (s: CampaignState,_r: AccountRules) => s.phase === 'FAILED' || s.balance <= s.currentMllFloor + EPS;
export function isEvaluationPassed(s: CampaignState,r: AccountRules) {
  return s.phase === 'EVALUATION' && !isAccountFailed(s,r) && getRemainingEvalTarget(s,r) <= EPS &&
    getAdditionalProfitNeededForConsistency(s,r) <= EPS && s.tradingDaysCompleted >= (r.evaluation?.minimumTradingDays ?? 0);
}
export function isPayoutEligible(s: CampaignState,r: AccountRules) {
  const p = r.funded.payout;
  return ['FUNDED','PAYOUT_CYCLE'].includes(s.phase) && !isAccountFailed(s,r) &&
    (p.maxPayouts === undefined || s.payoutNumber < p.maxPayouts) &&
    getRemainingProfitDays(s,r) === 0 && s.cumulativeCycleProfit+EPS >= (p.minimumCycleProfit ?? 0) && getAdditionalProfitNeededForConsistency(s,r) <= EPS &&
    (p.frequency === 'DAILY' || (p.minimumProfitPerDay ? s.payoutQualifyingDays : s.cycleTradingDays) >= (p.requiredDays ?? 0)) &&
    getMaximumAvailablePayout(s,r) > EPS && getMaximumAvailablePayout(s,r) + EPS >= (p.minimumPayout ?? 0);
}
export function applyEndOfDayTrail(s: CampaignState,r: AccountRules): CampaignState {
  const d = phaseRules(s,r).maxLoss;
  const peak = Math.max(s.currentEodPeak,s.balance);
  if (s.trailLocked || d.type === 'STATIC') return {...s,currentEodPeak:peak};
  if (d.locks && peak >= d.lockTriggerBalance!) return {...s,currentEodPeak:peak,trailLocked:true,currentMllFloor:Math.max(s.currentMllFloor,d.lockedFloor!)};
  return {...s,currentEodPeak:peak,currentMllFloor:Math.max(s.currentMllFloor,Math.min(peak-d.amount,d.trailFloorCap ?? Infinity))};
}
export function applyPayout(s: CampaignState,r: AccountRules): CampaignState {
  if (!isPayoutEligible(s,r)) throw new Error('Payout is not eligible');
  const p = r.funded.payout, buffered=p.model==='BUFFERED_SURPLUS', available = getMaximumAvailablePayout(s,r);
  const net=buffered ? available:available*p.profitShare, gross=buffered ? net/p.profitShare:available;
  const debit=!buffered || p.bufferedSurplus!.payoutReducesBalance;
  const resetConsistency=r.funded.consistency?.resetsAfterPayout ?? p.consistencyResetsAfterPayout;
  const nextPhase=p.maxPayouts !== undefined && s.payoutNumber+1 >= p.maxPayouts ? 'COMPLETED' : 'PAYOUT_CYCLE';
  return {...s,balance:s.balance-(debit ? gross:0),consumedSurplus:(s.consumedSurplus ?? 0)+(debit ? 0:gross),profitSinceLastPayout:0,payoutNumber:s.payoutNumber+1,cumulativePayouts:s.cumulativePayouts+net,
    trailLocked:s.trailLocked || r.funded.maxLoss.type !== 'STATIC',
    realizedRealCash:s.realizedRealCash+net,unrecoveredRealBasis:nextPhase==='PAYOUT_CYCLE'?0:Math.max(0,s.unrecoveredRealBasis-net),
    phase:nextPhase,status:'ACTIVE',
    cycleTradingDays:0,payoutQualifyingDays:0,qualifyingDaysCompleted:p.qualifyingDaysResetAfterPayout ? 0 : s.qualifyingDaysCompleted,
    cumulativeCycleProfit:p.cycleProfitResets ? 0 : s.cumulativeCycleProfit,
    consistencyProfit:resetConsistency ? 0 : s.consistencyProfit,
    consistencyLargestDay:resetConsistency ? 0 : s.consistencyLargestDay};
}
