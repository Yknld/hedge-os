export interface DrawdownRule {
  amount: number;
  type: 'STATIC' | 'EOD_TRAILING' | 'INTRADAY_TRAILING';
  locks: boolean;
  lockTriggerBalance?: number;
  lockedFloor?: number;
  trailFloorCap?: number;
}
export interface DailyLossRule { enabled: boolean; amount: number; dynamicDescription?: string }
export interface ConsistencyRule { enabled: boolean; maxLargestDayFraction: number;
  denominator?: 'TOTAL_ACCOUNT_PROFIT' | 'CURRENT_PAYOUT_CYCLE_PROFIT' | 'PROFIT_SINCE_LAST_PAYOUT' | 'WITHDRAWABLE_PROFIT';
  resetsAfterPayout?: boolean;
}
export type PayoutModel = 'PROFIT_CONVERSION' | 'BUFFERED_SURPLUS';
export interface BufferedSurplusRule {
  bufferBalance?: number; bufferAboveStartingBalance?: number;
  payoutReducesBalance: boolean; bufferIsProtected: boolean;
}
export type FundedSubstate = 'TRAILING' | 'BUFFER_BUILDING' | 'BUFFER_LOCKED' | 'SURPLUS_BUILDING' | 'PAYOUT_ELIGIBLE';
export interface ScalingTier { minimumProfit: number; maximumProfit?: number; maxContracts: number }
export interface PayoutRule {
  model?: PayoutModel;
  bufferedSurplus?: BufferedSurplusRule;
  frequency: 'DAILY' | 'N_DAYS'; requiredDays?: number; minimumProfitPerDay?: number;
  profitShare: number; payoutConversionRate?: number; minimumPayout?: number;
  capsByPayoutNumber?: number[]; defaultCap?: number; maxPayouts?: number;
  minimumCycleProfit?: number;
  qualifyingDaysResetAfterPayout: boolean; cycleProfitResets?: boolean;
  consistencyResetsAfterPayout?: boolean;
}
/**
 * A deliberately simple, centralized estimate until brokers expose actual
 * commission data. Rates are fractions, not percentages (0.032258 = 3.2258%).
 */
export interface FeeConfig {
  enabled: boolean;
  propTargetBufferPct: number;
  liveRecoveryFeeBufferPct: number;
}
export interface AccountRules {
  id: string; provider: string; accountName: string; startingBalance: number;
  evaluationFee: number; activationFee: number;
  pricing?: { billing: 'MONTHLY' | 'ONE_TIME'; listPrice?: number; currentPrice: number;
    resetFee?: number; promotionalPrice?: number; promotionalResetFee?: number; sourceAsOf?: string };
  evaluation?: { enabled: boolean; profitTarget: number; maxLoss: DrawdownRule;
    dailyLossLimit?: DailyLossRule; consistency?: ConsistencyRule;
    minimumTradingDays?: number; maxContracts: number };
  funded: { maxLoss: DrawdownRule; dailyLossLimit?: DailyLossRule; consistency?: ConsistencyRule;
    minimumProfitDays?: { requiredDays: number; minimumProfitPerDay: number };
    scalingPlan?: ScalingTier[]; maxContracts: number; payoutsToLive?: number; payoutProfitTarget?: number; payout: PayoutRule };
  feeConfig?: FeeConfig;
}
export interface CampaignState {
  campaignId: string;
  phase: 'EVALUATION' | 'FUNDED' | 'PAYOUT_CYCLE' | 'PASSED_EVAL' | 'FAILED' | 'COMPLETED';
  balance: number; startingBalance: number; currentEodPeak: number; currentMllFloor: number;
  trailLocked: boolean; dailyPnL: number; currentDayNumber: number;
  tradingDaysCompleted: number; profitableDaysCompleted: number; qualifyingDaysCompleted: number;
  largestWinningDay: number; cumulativePhaseProfit: number; cumulativeCycleProfit: number;
  payoutNumber: number; cumulativePayouts: number; currentMaxContracts: number;
  initialRealBasis: number; unrecoveredRealBasis: number; realizedRealCash: number;
  cumulativeLiveHedgePnl: number; cumulativeExecutionCosts: number; peakWorkingCapital: number;
  /** Explicit fee-aware accounting. Actual values replace estimates when supplied. */
  grossPropPnL?: number; estimatedPropFees?: number; actualPropFees?: number;
  netPropPnL?: number; estimatedLiveFees?: number; actualLiveFees?: number;
  // Separate reset windows prevent payout-day and consistency counters conflating.
  cycleTradingDays: number; payoutQualifyingDays: number; consistencyProfit: number;
  consistencyLargestDay: number;
  profitSinceLastPayout?: number;
  consumedSurplus?: number;
  status: 'ACTIVE' | 'PASSED' | 'FAILED' | 'PAYOUT_ELIGIBLE';
}
export interface CampaignAction {
  targetProfit: number; stopLoss: number; hedgeRatio: number; propContracts?: number;
  purpose: 'EVAL_PROGRESS' | 'TRAIL_LOCK' | 'CONSISTENCY' | 'QUALIFYING_DAY' | 'PAYOUT_PROGRESS' | 'MAX_PAYOUT' | 'RECOVERY' | 'CUSTOM';
}
export interface OptimizerOptions {
  mode?: 'CAPITAL_EFFICIENT' | 'LOWEST_CAPITAL' | 'FASTEST_PAYOUT' | 'HIGHEST_PAYOUT' | 'BALANCED';
  objective?: 'NEXT_MONETIZATION' | 'FULL_PAYOUT';
  frictionReserve?: number; executionCost?: number; desiredFailureProfit?: number;
  maxSearchDepth?: number; maxSearchDays?: number; maxStates?: number; maxCandidates?: number;
}
export type Outcome = 'TP' | 'SL' | 'ACTIVATE' | 'PAYOUT';
export interface TransitionRecord {
  id: string; campaignId: string; timestamp: string; previousState: CampaignState;
  action: CampaignAction | null; outcome: Outcome; nextState: CampaignState;
  optimizerVersion: string; rules: AccountRules; options: OptimizerOptions;
}
export interface CampaignPathStep { action: CampaignAction; state: CampaignState; nextState: CampaignState }
export interface CampaignRecommendation {
  currentStateSummary: CampaignState;
  nextAction: (CampaignAction & { hedgeRatioEquilibrium: number; hedgeRatioConfigured: number }) | null;
  tpBranch?: { resultingState: CampaignState; realCashImpact: number; nextRecommendedAction?: CampaignAction };
  lossBranch?: { resultingState: CampaignState; realCashImpact: number; nextRecommendedAction?: CampaignAction };
  projectedPath: CampaignPathStep[];
  metrics: { peakWorkingCapital: number; minimumTerminalCash: number | null; maximumTerminalCash: number | null;
    daysToNextPayoutMin: number | null; daysToNextPayoutProjected: number | null; projectedPayout: number;
    maximumSearchPathDays: number; retainedPaCushion: number; statesVisited: number; searchTruncated: boolean;
    optimizationObjective?: 'MAXIMIN_CASH'; outcomeCoverageComplete?: boolean };
  warnings: string[]; explanation: string[];
  alternatives: { action: CampaignAction; rank: number[]; reason: string }[];
}
