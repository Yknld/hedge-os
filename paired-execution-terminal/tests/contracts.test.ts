import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateNasdaqHedgeMix, dollarsPerPoint, reconcileNasdaqExposure, selectMnqPropQuantity, NASDAQ_CONTRACT_SPECS } from '../src/lib/contracts';

test('MNQ is the primary $/point prop unit while NQ remains defined', () => {
  assert.equal(NASDAQ_CONTRACT_SPECS.NQ.dollarsPerPoint, 20);
  assert.equal(dollarsPerPoint('MNQ', 30), 60);
});

test('3 NQ at a 45% hedge decomposes to 13 MNQ + 5 NNQ', () => {
  const hedge = calculateNasdaqHedgeMix('NQ', 3, 45);
  assert.equal(dollarsPerPoint('NQ', 3), 60);
  assert.deepEqual(
    { mnq: hedge.mnq, nnq: hedge.nnq, target: hedge.targetDollarsPerPoint, actual: hedge.resultingDollarsPerPoint, ratio: hedge.effectiveRatio },
    { mnq: 13, nnq: 5, target: 27, actual: 27, ratio: 45 },
  );
});

test('economically equivalent NQ and MNQ prop positions produce the same hedge', () => {
  const nq = calculateNasdaqHedgeMix('NQ', 3, 45);
  const mnq = calculateNasdaqHedgeMix('MNQ', 30, 45);
  assert.deepEqual([nq.mnq, nq.nnq, nq.resultingDollarsPerPoint], [mnq.mnq, mnq.nnq, mnq.resultingDollarsPerPoint]);
});

test('NNQ rounding remains explicit at one tenth of an MNQ equivalent', () => {
  const hedge = calculateNasdaqHedgeMix('NQ', 1, 23.7);
  assert.deepEqual([hedge.mnq, hedge.nnq, hedge.resultingMNQEquivalent], [2, 4, 2.4]);
});

test('MNQ plus NNQ decomposition exposes rounding error in dollars per point', () => {
  const hedge = calculateNasdaqHedgeMix('MNQ', 10, 5.25);
  assert.deepEqual([hedge.mnq, hedge.nnq], [0, 5]);
  assert.equal(hedge.targetDollarsPerPoint, 1.05);
  assert.equal(hedge.resultingDollarsPerPoint, 1);
  assert.equal(hedge.roundingErrorDollarsPerPoint, -0.05);
});

test('MNQ sizing heuristic avoids defaulting to the maximum while retaining live representability', () => {
  const quantity = selectMnqPropQuantity({ netTarget: 150, effectiveMarketDownside: 1980, recoveryRatioPercent: 5.25, maxPropMNQ: 20 });
  assert.ok(quantity >= 2 && quantity < 20);
});

test('reconciles actual MNQ and NNQ fills in dollar-per-point exposure', () => {
  const result = reconcileNasdaqExposure({ propSymbol: 'NQ', propQuantity: 3, propSide: 'LONG', hedgeRatioPercent: 45, mnqQuantity: -12, nnqQuantity: -3 });
  assert.deepEqual(
    { target: result.targetLiveDollarsPerPoint, actual: result.actualLiveDollarsPerPoint, error: result.errorDollarsPerPoint, side: result.correctionSide, mix: [result.correction.mnq, result.correction.nnq] },
    { target: -27, actual: -24.6, error: -2.4, side: 'SELL', mix: [1, 2] },
  );
});
