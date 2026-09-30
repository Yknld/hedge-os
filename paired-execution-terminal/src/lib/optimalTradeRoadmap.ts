import type { Campaign } from '../store/useAppStore';

export type OptimalTradeStepType =
  | 'evaluation'
  | 'buffer'
  | 'base-hit'
  | 'post-payout-base-hit'
  | 'payout';

export interface OptimalTradeStep {
  type: OptimalTradeStepType;
  label: string;
  target: number | null;
  failure: number | null;
  purpose: string;
  status: 'complete' | 'current' | 'upcoming';
}

export interface OptimalTradePlan {
  phase: 'Evaluation' | 'Performance account' | 'Post-payout';
  objective: OptimalTradeStep;
  steps: OptimalTradeStep[];
}

const isEvaluationPhase = (campaign: Campaign) =>
  /evaluation/i.test(campaign.phases[campaign.currentPhase]?.name ?? '');

export function getOptimalPayoutHedgeRatio(campaign: Campaign) {
  const withdrawablePercent = campaign.performanceRules.withdrawableBalancePercent ?? 50;
  const traderSplitPercent = campaign.performanceRules.payoutSplitPercent ?? 90;
  const capturablePayoutPercent = (withdrawablePercent * traderSplitPercent) / 100;
  const executionSafetyMargin = 1.5;
  return Math.min(100, Math.max(0, capturablePayoutPercent + executionSafetyMargin));
}

export function getOptimalTradePlan(
  campaign?: Campaign,
  phaseOverride?: 'evaluation' | 'performance' | 'post-payout'
): OptimalTradePlan | null {
  if (!campaign) return null;

  if (
    phaseOverride === 'post-payout' ||
    (!phaseOverride && campaign.roadmapStage === 'post-payout')
  ) {
    const target = Math.max(1, campaign.performanceRules.minimumWinningDayProfit || 100);
    const days = Math.max(1, campaign.performanceRules.minimumWinningDaysForPayout || 5);
    const lockedRatio = getOptimalPayoutHedgeRatio(campaign);
    const manualStep = campaign.roadmapStep?.['post-payout'] ?? 0;
    const steps: OptimalTradeStep[] = Array.from({ length: days }, (_, index) => ({
      type: 'post-payout-base-hit',
      label: `Base hit ${index + 1}`,
      target,
      failure: null,
      purpose: `${lockedRatio.toFixed(1)}% LOCKED OUTCOME`,
      status: index < manualStep ? 'complete' : index === manualStep ? 'current' : 'upcoming',
    }));
    steps.push({
      type: 'payout',
      label: `Payout cycle ${campaign.postPayoutCycle ?? 1}`,
      target: null,
      failure: null,
      purpose: 'REQUEST & RESET',
      status: 'upcoming',
    });
    if (manualStep >= days) steps[days].status = 'current';
    return { phase: 'Post-payout', objective: steps[0], steps };
  }

  if (
    phaseOverride === 'evaluation' ||
    (!phaseOverride && campaign.roadmapStage !== 'performance' && isEvaluationPhase(campaign))
  ) {
    const dayTarget = campaign.evaluationRules.profitTarget / 2;
    const evaluationProfit = Math.max(0, campaign.currentBalance - campaign.accountSize);
    const dayOneComplete = evaluationProfit >= dayTarget;
    const manualStep = campaign.roadmapStep?.evaluation;
    const currentStep = manualStep ?? (dayOneComplete ? 1 : 0);
    const steps: OptimalTradeStep[] = [1, 2].map((day) => ({
      type: 'evaluation' as const,
      label: `Evaluation day ${day}`,
      target: dayTarget,
      failure: campaign.evaluationRules.maxDrawdown,
      purpose: '50% CONSISTENCY',
      status: day - 1 < currentStep ? 'complete' : day - 1 === currentStep ? 'current' : 'upcoming',
    }));
    return {
      phase: 'Evaluation',
      objective: steps.find((step) => step.status === 'current') ?? steps[1],
      steps,
    };
  }

  const bufferTarget = Math.max(
    1,
    campaign.performanceRules.bufferLock ?? campaign.performanceRules.maxDrawdown + 100
  );
  const baseHitTarget = Math.max(
    1,
    campaign.performanceRules.minimumWinningDayProfit ||
      (campaign.accountSize <= 25_000 ? 100 : 150)
  );
  const requiredDays = Math.max(
    1,
    campaign.performanceRules.minimumWinningDaysForPayout ||
      campaign.performanceRules.minimumTradingDaysForPayout ||
      5
  );
  const baseHitCount = Math.max(0, requiredDays - 1);
  const profit = Math.max(0, campaign.totalPaProfit);
  const bufferComplete = profit >= bufferTarget;
  const completedBaseHits = bufferComplete
    ? Math.min(baseHitCount, Math.floor((profit - bufferTarget) / baseHitTarget))
    : 0;
  const automaticStep = bufferComplete ? 1 + completedBaseHits : 0;
  const currentStep = campaign.roadmapStep?.performance ?? automaticStep;

  const steps: OptimalTradeStep[] = [
    {
      type: 'buffer',
      label: 'Buffer / trail lock',
      target: bufferTarget,
      failure: null,
      purpose: 'LOCK TRAIL',
      status: currentStep > 0 ? 'complete' : 'current',
    },
  ];
  for (let index = 0; index < baseHitCount; index += 1) {
    steps.push({
      type: 'base-hit',
      label: `Base hit ${index + 1}`,
      target: baseHitTarget,
      failure: null,
      purpose: 'QUALIFYING DAY',
      status:
        index + 1 < currentStep ? 'complete' : index + 1 === currentStep ? 'current' : 'upcoming',
    });
  }
  steps.push({
    type: 'payout',
    label: 'Payout eligible',
    target: null,
    failure: null,
    purpose: 'REQUEST PAYOUT',
    status: currentStep >= baseHitCount + 1 ? 'current' : 'upcoming',
  });

  return {
    phase: 'Performance account',
    objective:
      steps.find((step) => step.status === 'current' && step.type !== 'payout') ??
      steps[Math.max(0, steps.length - 2)],
    steps,
  };
}
