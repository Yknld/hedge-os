export type NasdaqContract = 'NQ' | 'MNQ' | 'NNQ';

export type ContractSpec = {
  dollarsPerPoint: number;
  mnqEquivalent: number;
  tickSize: number;
  tickValue: number;
};

/** Canonical contract economics. Price levels are never multiplier-adjusted. */
export const NASDAQ_CONTRACT_SPECS: Record<NasdaqContract, ContractSpec> = {
  NQ: { dollarsPerPoint: 20, mnqEquivalent: 10, tickSize: 0.25, tickValue: 5 },
  MNQ: { dollarsPerPoint: 2, mnqEquivalent: 1, tickSize: 0.25, tickValue: 0.5 },
  NNQ: { dollarsPerPoint: 0.2, mnqEquivalent: 0.1, tickSize: 0.5, tickValue: 0.1 },
};

export function isNasdaqContract(value: string): value is NasdaqContract {
  return value === 'NQ' || value === 'MNQ' || value === 'NNQ';
}

export function dollarsPerPoint(symbol: NasdaqContract, quantity: number) {
  return Math.abs(quantity) * NASDAQ_CONTRACT_SPECS[symbol].dollarsPerPoint;
}

export type HedgeContractMix = {
  mnq: number;
  nnq: number;
  targetMNQEquivalent: number;
  resultingMNQEquivalent: number;
  targetDollarsPerPoint: number;
  resultingDollarsPerPoint: number;
  /** Executable exposure minus requested exposure. Positive means over-hedged. */
  roundingErrorDollarsPerPoint: number;
  roundingErrorPercent: number;
  effectiveRatio: number;
  label: string;
};

export function decomposeMNQEquivalent(targetMNQEquivalent: number, propDollarsPerPoint = 0): HedgeContractMix {
  const targetTenths = Math.max(0, Math.round(targetMNQEquivalent * 10));
  const mnq = Math.floor(targetTenths / 10);
  const nnq = targetTenths % 10;
  const resultingMNQEquivalent = mnq + nnq * NASDAQ_CONTRACT_SPECS.NNQ.mnqEquivalent;
  const resultingDollarsPerPoint = dollarsPerPoint('MNQ', mnq) + dollarsPerPoint('NNQ', nnq);
  const targetDollarsPerPoint = targetMNQEquivalent * NASDAQ_CONTRACT_SPECS.MNQ.dollarsPerPoint;
  const roundingErrorDollarsPerPoint = Number((resultingDollarsPerPoint - targetDollarsPerPoint).toFixed(10));
  const effectiveRatio = propDollarsPerPoint > 0 ? (resultingDollarsPerPoint / propDollarsPerPoint) * 100 : 0;
  const roundingErrorPercent = propDollarsPerPoint > 0 ? (roundingErrorDollarsPerPoint / propDollarsPerPoint) * 100 : 0;
  const parts = [mnq ? `${mnq} MNQ` : '', nnq ? `${nnq} NNQ` : ''].filter(Boolean);
  return { mnq, nnq, targetMNQEquivalent, resultingMNQEquivalent, targetDollarsPerPoint, resultingDollarsPerPoint, roundingErrorDollarsPerPoint, roundingErrorPercent, effectiveRatio, label: parts.join(' + ') || '0 contracts' };
}

/** Converts prop dollar-per-point exposure to the only executable live mix: MNQ + NNQ. */
export function calculateNasdaqHedgeMix(
  propSymbol: Extract<NasdaqContract, 'NQ' | 'MNQ'>,
  propQuantity: number,
  requestedRatioPercent: number,
): HedgeContractMix {
  const propExposure = dollarsPerPoint(propSymbol, Math.max(0, Math.round(propQuantity)));
  return decomposeMNQEquivalent(propExposure * Math.max(0, requestedRatioPercent) / 100 / NASDAQ_CONTRACT_SPECS.MNQ.dollarsPerPoint, propExposure);
}

export function reconcileNasdaqExposure(input: {
  propSymbol: Extract<NasdaqContract, 'NQ' | 'MNQ'>;
  propQuantity: number;
  propSide: 'LONG' | 'SHORT';
  hedgeRatioPercent: number;
  mnqQuantity: number;
  nnqQuantity: number;
}) {
  const propSign = input.propSide === 'LONG' ? 1 : -1;
  const propDollarsPerPoint = propSign * dollarsPerPoint(input.propSymbol, input.propQuantity);
  const targetLiveDollarsPerPoint = -propDollarsPerPoint * Math.max(0, input.hedgeRatioPercent) / 100;
  const actualLiveDollarsPerPoint = input.mnqQuantity * NASDAQ_CONTRACT_SPECS.MNQ.dollarsPerPoint + input.nnqQuantity * NASDAQ_CONTRACT_SPECS.NNQ.dollarsPerPoint;
  const errorDollarsPerPoint = Number((targetLiveDollarsPerPoint - actualLiveDollarsPerPoint).toFixed(10));
  const correction = decomposeMNQEquivalent(Math.abs(errorDollarsPerPoint) / NASDAQ_CONTRACT_SPECS.MNQ.dollarsPerPoint);
  return {
    propDollarsPerPoint,
    targetLiveDollarsPerPoint,
    actualLiveDollarsPerPoint,
    errorDollarsPerPoint,
    actualMNQEquivalent: actualLiveDollarsPerPoint / NASDAQ_CONTRACT_SPECS.MNQ.dollarsPerPoint,
    correctionSide: errorDollarsPerPoint >= 0 ? 'BUY' as const : 'SELL' as const,
    correction,
  };
}

/**
 * Conservative, adjustable starting heuristic. It is intentionally not an
 * optimizer: it chooses enough MNQ exposure for a representable live hedge,
 * while avoiding a default-to-maximum prop position.
 */
export function selectMnqPropQuantity(input: {
  netTarget: number;
  effectiveMarketDownside: number;
  recoveryRatioPercent: number;
  maxPropMNQ: number;
  minimumLiveDollarsPerPoint?: number;
  targetMovePoints?: number;
}) {
  const max = Math.max(1, Math.floor(input.maxPropMNQ));
  const minimumLive = Math.max(0.2, input.minimumLiveDollarsPerPoint ?? 0.2);
  const targetMove = Math.max(1, input.targetMovePoints ?? 25);
  const forTarget = Math.ceil(Math.max(0, input.netTarget) / (NASDAQ_CONTRACT_SPECS.MNQ.dollarsPerPoint * targetMove));
  const ratio = Math.max(.0001, input.recoveryRatioPercent / 100);
  const forHedge = Math.ceil(minimumLive / (NASDAQ_CONTRACT_SPECS.MNQ.dollarsPerPoint * ratio));
  const forRisk = input.effectiveMarketDownside > 0
    ? Math.max(1, Math.floor(input.effectiveMarketDownside / (NASDAQ_CONTRACT_SPECS.MNQ.dollarsPerPoint * targetMove)))
    : max;
  return Math.max(1, Math.min(max, forTarget, forRisk, Math.max(forTarget, forHedge)));
}
