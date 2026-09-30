import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftToLine,
  ArrowRightToLine,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  Clock3,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Circle,
  CircleDot,
  CirclePlus,
  Link2,
  LockKeyhole,
  Minus,
  MoreHorizontal,
  PanelBottomClose,
  PanelBottomOpen,
  PencilRuler,
  Plus,
  Ruler,
  ShieldCheck,
  Square,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { CampaignJournalModal } from '../components/CampaignJournalModal';
import { ema } from 'technicalindicators';
import {
  LineToolRectangle,
  createLineToolsPlugin,
  registerFibRetracementPlugin,
  registerLinesPlugin,
  registerPriceRangePlugin,
  type LineToolsPlugin,
} from '../vendor/difurious-line-tools.js';
import { campaignJournalMetrics, useAppStore, type TerminalView, type TradingInstrument } from '../store/useAppStore';
import { cn } from '../lib/cn';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Panel } from '../components/ui/Panel';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { StatusDot } from '../components/ui/StatusDot';
import { getOptimalPayoutHedgeRatio, getOptimalTradePlan, type OptimalTradeStep } from '../lib/optimalTradeRoadmap';
import { loadEngineSession, type EngineSession } from '../lib/campaignEngine/persistence';
import { optimizeCampaign } from '../lib/campaignEngine/optimizer';
import { calculateNasdaqHedgeMix, NASDAQ_CONTRACT_SPECS, selectMnqPropQuantity } from '../lib/contracts';
import { getCurrentContractLimit } from '../data/propAccountTypes';
import { previewAlternative } from '../lib/campaignEngine/planner';
import { cancelPairedExecution, cancelPairedPendingExecution, getTradingViewBridgeState, loadIronbeamExecutionAudit, sendPairedExecution, subscribeTradingViewBridge, type IronbeamBracketOrder, type TradingViewBridgeState } from '../lib/tradingViewBridge';
import { hasTradingRiskConsent } from '../lib/legal';
import { LegalDocumentDialog } from '../components/legal/LegalDocumentDialog';

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[10px] text-muted">{label}</span>
      <span
        className={cn(
          'font-mono text-[11px] tabular-nums',
          tone === 'positive'
            ? 'text-positive'
            : tone === 'negative'
              ? 'text-negative'
              : 'text-slate-300'
        )}
      >
        {value}
      </span>
    </div>
  );
}

function EditableNumberInput({
  value,
  onValueChange,
  onEdit,
  className,
  integer = false,
  readOnly = false,
  ariaLabel,
}: {
  value: number;
  onValueChange: (value: number) => void;
  onEdit?: () => void;
  className?: string;
  integer?: boolean;
  readOnly?: boolean;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const update = (next: string) => {
    const pattern = integer ? /^\d*$/ : /^\d*(?:\.\d*)?$/;
    if (!pattern.test(next)) return;
    onEdit?.();
    setDraft(next);
    if (next === '' || next === '.') return;
    const parsed = Number(next);
    if (Number.isFinite(parsed)) onValueChange(parsed);
  };

  return (
    <input
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      aria-label={ariaLabel}
      readOnly={readOnly}
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(event) => update(event.target.value)}
      onBlur={() => {
        focused.current = false;
        setDraft(String(value));
      }}
      className={className}
    />
  );
}

function ContextSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const campaigns = useAppStore((state) => state.campaigns);
  const activeCampaignId = useAppStore((state) => state.activeCampaignId);
  const activeCampaign =
    campaigns.find((campaign) => campaign.id === activeCampaignId) ?? campaigns[0];
  const activeStage =
    activeCampaign?.roadmapStage ??
    (/evaluation/i.test(activeCampaign?.phases[activeCampaign.currentPhase]?.name ?? '')
      ? 'evaluation'
      : 'performance');
  const storedActivePhase =
    activeCampaign?.phases[activeStage === 'evaluation' ? 0 : activeCampaign.phases.length - 1];
  const activePhase = storedActivePhase
    ? {
        ...storedActivePhase,
        name:
          activeStage === 'evaluation'
            ? 'Evaluation'
            : activeStage === 'post-payout'
              ? 'Post-payout'
              : 'PA',
      }
    : undefined;
  const performancePhase = Boolean(activeCampaign && activeStage !== 'evaluation');
  const accountQuantity = Math.max(1, activeCampaign?.accountQuantity ?? 1);
  const activeJournal=activeCampaign?campaignJournalMetrics(activeCampaign):null;
  // Progress is account equity gained above the campaign's starting balance.
  // `totalPaProfit` is a financial-ledger field and may contain historical PA
  // profit even while the campaign is in evaluation, so it is not a valid
  // phase-progress numerator.
  const phaseProfit = activeCampaign
    ? Math.max(0, (activeJournal?.currentBalance??activeCampaign.currentBalance) - activeCampaign.accountSize)
    : 0;
  const campaignProgress = activePhase?.profitTarget
    ? Math.min(100, (phaseProfit / activePhase.profitTarget) * 100)
    : 0;
  const journalPropBalance=activeJournal?.currentBalance??null;
  const journalGroupBalance=journalPropBalance===null?null:journalPropBalance*accountQuantity;
  const contractLimit = activeCampaign
    ? (performancePhase
        ? activeCampaign.performanceRules.maxContracts
        : activeCampaign.evaluationRules.maxContracts) * accountQuantity
    : 0;
  const consistencyLimit = activeCampaign
    ? performancePhase
      ? activeCampaign.performanceRules.payoutConsistencyLimit
      : activeCampaign.evaluationRules.consistencyLimit
    : null;
  const journalHedgeBalance=activeJournal?.currentHedgeBalance??null;
  const journalAllocatedHedgeCapital=activeJournal?.allocatedHedgeCapital??null;
  const formatMoney = (value: number) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const formatLiveMoney = (value: number) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (collapsed)
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center border-r border-line bg-surface py-2">
        <IconButton label="Expand account sidebar" onClick={onToggle}>
          <ArrowRightToLine className="size-3.5" />
        </IconButton>
        <div className="mt-3 h-px w-5 bg-line" />
        <div className="mt-4 [writing-mode:vertical-rl] text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">
          Accounts & campaign
        </div>
      </aside>
    );
  return (
    <aside className="terminal-accounts w-[250px] shrink-0 overflow-y-auto border-r border-line bg-surface">
      <div className="flex h-10 items-center justify-between border-b border-line px-3">
        <span className="section-kicker">Your accounts</span>
        <IconButton label="Collapse account sidebar" onClick={onToggle}>
          <ArrowLeftToLine className="size-3.5" />
        </IconButton>
      </div>
      <div className="border-b border-line p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-7 shrink-0 place-items-center border border-blue-400/30 bg-blue-400/10">
              <Activity className="size-3.5 text-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200">Prop · ×{accountQuantity}</div>
              <div className="mt-0.5 truncate font-mono text-[9px] text-muted">
                {activeCampaign?.accountTypeName ?? 'No campaign'}
              </div>
            </div>
          </div>
          <StatusDot status={activeCampaign?.status === 'active' ? 'online' : 'warning'} />
        </div>
        <Metric label="Group balance · journal" value={activeCampaign && journalGroupBalance !== null ? formatLiveMoney(journalGroupBalance) : '—'} />
        <Metric
          label="Per account · journal"
          value={activeCampaign && journalPropBalance !== null ? formatLiveMoney(journalPropBalance) : '—'}
        />
        <Metric
          label="Prop realized P&L · journal"
          value={activeCampaign&&activeJournal ? formatLiveMoney(activeJournal.totalPaProfit) : '—'}
          tone={!activeJournal ? 'neutral' : activeJournal.totalPaProfit >= 0 ? 'positive' : 'negative'}
        />
        <Metric label="Group contract limit" value={activeCampaign ? `${contractLimit}` : '—'} />
      </div>
      <div className="border-b border-line p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center border border-emerald-400/30 bg-emerald-400/10">
              <WalletCards className="size-3.5 text-positive" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Hedge</div>
              <div className="mt-0.5 font-mono text-[9px] text-muted">Campaign capital</div>
            </div>
          </div>
          <StatusDot status={activeCampaign ? 'online' : 'offline'} />
        </div>
        <Metric
          label="Allocated capital"
          value={journalAllocatedHedgeCapital !== null ? formatLiveMoney(journalAllocatedHedgeCapital) : '—'}
        />
        <Metric label="Account balance · journal" value={journalHedgeBalance !== null ? formatLiveMoney(journalHedgeBalance) : '—'} />
        <Metric
          label="Hedge realized P&L · journal"
          value={activeCampaign&&activeJournal ? formatLiveMoney(activeJournal.totalLiveProfit) : '—'}
          tone={!activeJournal ? 'neutral' : activeJournal.totalLiveProfit >= 0 ? 'positive' : 'negative'}
        />
        <Metric label="Hedge fees · journal" value={activeCampaign&&activeJournal ? formatLiveMoney(activeJournal.hedgingSpend) : '—'} />
      </div>
      <div className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted">Active campaign</div>
            <div className="mt-0.5 truncate text-xs font-semibold text-slate-200">
              {activeCampaign?.name ?? 'None selected'}
            </div>
          </div>
          <span className="ml-2 shrink-0 border border-blue-400/30 bg-blue-400/10 px-2 py-1 font-mono text-[9px] text-blue-300">
            {activePhase?.name ?? '—'}
          </span>
        </div>
        <Metric
          label="Phase target"
          value={activePhase ? formatMoney(activePhase.profitTarget) : '—'}
        />
        <Metric
          label="Maximum drawdown"
          value={activePhase ? formatMoney(activePhase.maxDrawdown) : '—'}
        />
        <Metric
          label="Consistency limit"
          value={consistencyLimit ? `${consistencyLimit}%` : 'None'}
        />
        <div className="mt-3 h-1 overflow-hidden bg-line">
          <div className="h-full bg-accent" style={{ width: `${campaignProgress}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[9px] text-slate-600">
          <span>Campaign progress</span>
          <span className="font-mono">{campaignProgress.toFixed(0)}%</span>
        </div>
      </div>
    </aside>
  );
}

type MnqBar = CandlestickData<UTCTimestamp> & { volume: number };
type LiveMinuteBar = Omit<MnqBar,'volume'> & { volume: null };
type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';
type EmaOverlay = { id: number; period: number; color: string };
type LimitPoint = { y: number; price: number };

const contractSpecs: Record<
  TradingInstrument,
  { pointValue: number; tickSize: number; tickValue: number }
> = {
  NQ: { pointValue: NASDAQ_CONTRACT_SPECS.NQ.dollarsPerPoint, tickSize: NASDAQ_CONTRACT_SPECS.NQ.tickSize, tickValue: NASDAQ_CONTRACT_SPECS.NQ.tickValue },
  MNQ: { pointValue: NASDAQ_CONTRACT_SPECS.MNQ.dollarsPerPoint, tickSize: NASDAQ_CONTRACT_SPECS.MNQ.tickSize, tickValue: NASDAQ_CONTRACT_SPECS.MNQ.tickValue },
  MBT: { pointValue: 0.1, tickSize: 5, tickValue: 0.5 },
};

// Tradovate all-in prop commissions. Targets are net objectives, so the
// complete entry-and-exit commission is added to the gross price target.
const TERMINAL_FEE_CONFIG = Object.freeze({ enabled: true, liveRecoveryFeeBufferPct: 0.04 });
const PROP_ROUND_TRIP_FEE: Record<TradingInstrument,number> = Object.freeze({ MNQ: 1.04, NQ: 5.74, MBT: 0 });
// Campaign targets are intentionally allowed a practical dollar band. A price
// tick is too fine-grained for a user entering a dollar objective by hand.
const OPTIMAL_TARGET_TOLERANCE_USD = 50;
const estimatePropFees = (gross: number, quantity: number, instrument: TradingInstrument) =>
  TERMINAL_FEE_CONFIG.enabled && Math.abs(gross)>0 ? Math.max(0,quantity)*PROP_ROUND_TRIP_FEE[instrument] : 0;
const grossForNetTarget = (net: number, quantity: number, instrument: TradingInstrument) =>
  net + estimatePropFees(net,quantity,instrument);
const estimateLiveFees = (recovery: number) => TERMINAL_FEE_CONFIG.enabled ? Math.max(0, recovery) * TERMINAL_FEE_CONFIG.liveRecoveryFeeBufferPct : 0;

function calculateWholeContractHedgeQuantity(
  propQuantity: number,
  requestedRatioPercent: number
) {
  if (propQuantity <= 0 || requestedRatioPercent <= 0) return 0;
  return Math.max(1, Math.round((propQuantity * requestedRatioPercent) / 100));
}

type ProjectedRoadmapOutcome = {
  requiredRecovery: number;
  requestedRatio: number;
  executableRatio: number;
  hedgeLossOnWin: number;
  hedgeProfitOnLoss: number;
  combinedOnWin: number;
  failureLoss: number;
  activationFeeIncluded: number;
};

function projectRoadmapOutcomes(
  steps: OptimalTradeStep[],
  baseRecovery: number,
  friction: number,
  desiredProfit: number,
  fallbackFailureLoss: number,
  propQuantity: number,
  instrument: TradingInstrument,
  activationFee = 0,
  accountQuantity = 1,
  lockedPayoutRatio = 46
) {
  let accumulatedHedgeLoss = 0;
  let performanceAccountStarted = false;
  return steps.map<ProjectedRoadmapOutcome | null>((step) => {
    if (step.target === null) return null;
    const failureLoss =
      step.failure !== null ? step.failure * accountQuantity : fallbackFailureLoss;
    const postPayout = step.type === 'post-payout-base-hit';
    if (step.type === 'buffer') performanceAccountStarted = true;
    const activationFeeIncluded = !postPayout && performanceAccountStarted ? activationFee : 0;
    const requiredRecovery = postPayout
      ? 0
      : baseRecovery + accumulatedHedgeLoss + activationFeeIncluded;
    const requestedRatio = postPayout
      ? lockedPayoutRatio
      : failureLoss > 0
        ? ((requiredRecovery + friction + desiredProfit) / failureLoss) * 100
        : 0;
    const executableRatio = calculateNasdaqHedgeMix('MNQ', propQuantity, requestedRatio).effectiveRatio;
    const aggregateTarget = step.target * accountQuantity;
    const hedgeLossOnWin = (aggregateTarget * executableRatio) / 100;
    const result = {
      requiredRecovery,
      requestedRatio,
      executableRatio,
      hedgeLossOnWin,
      hedgeProfitOnLoss: (failureLoss * executableRatio) / 100,
      combinedOnWin: aggregateTarget - hedgeLossOnWin,
      failureLoss,
      activationFeeIncluded,
    };
    if (!postPayout) accumulatedHedgeLoss += hedgeLossOnWin;
    return result;
  });
}

function roundToTick(price: number, tickSize: number) {
  return Number((Math.round(price / tickSize) * tickSize).toFixed(8));
}

function exitDollars(
  entry: number,
  exitPrice: number,
  quantity: number,
  instrument: TradingInstrument
) {
  return Math.abs(exitPrice - entry) * contractSpecs[instrument].pointValue * quantity;
}

function exitPriceFromDollars(
  entry: number,
  dollars: number,
  quantity: number,
  instrument: TradingInstrument,
  direction: 'long' | 'short',
  exit: 'tp' | 'sl',
  tickSizeOverride?: number
) {
  const spec = contractSpecs[instrument];
  const tickSize = tickSizeOverride ?? spec.tickSize;
  const rawDistance = dollars / (spec.pointValue * (quantity > 0 ? quantity : 1));
  const rawTicks = rawDistance / tickSize;
  const ticks = Math.max(1, Math.round(rawTicks));
  const distance = ticks * tickSize;
  const sign = direction === 'long' ? (exit === 'tp' ? 1 : -1) : exit === 'tp' ? -1 : 1;
  return roundToTick(entry + sign * distance, tickSize);
}

/** A stop budget must never round away from safety. Unlike a target, use the
 * lower executable tick so the resulting market loss cannot exceed its cap. */
function stopPriceFromGrossLossBudget(
  entry: number,
  dollars: number,
  quantity: number,
  instrument: TradingInstrument,
  direction: 'long' | 'short',
  tickSizeOverride?: number
) {
  const spec = contractSpecs[instrument];
  const tickSize = tickSizeOverride ?? spec.tickSize;
  const rawDistance = Math.max(0, dollars) / (spec.pointValue * (quantity > 0 ? quantity : 1));
  const ticks = Math.max(1, Math.floor(rawDistance / tickSize + 1e-8));
  const distance = ticks * tickSize;
  return roundToTick(entry + (direction === 'long' ? -distance : distance), tickSize);
}

function isTickAligned(price: number, tickSize: number) {
  return Math.abs(price / tickSize - Math.round(price / tickSize)) < 1e-8;
}

function bracketValidationErrors(
  direction: 'long' | 'short',
  entry: number,
  takeProfit: number,
  stopLoss: number
) {
  const errors: string[] = [];
  if (!Number.isFinite(entry) || entry <= 0) errors.push('Entry price must be greater than zero.');
  if (!Number.isFinite(takeProfit) || takeProfit <= 0)
    errors.push('Take profit must be greater than zero.');
  else if (Number.isFinite(entry) && entry > 0) {
    if (direction === 'long' && takeProfit <= entry)
      errors.push('Take profit is wrong: it must be above the entry for a long.');
    if (direction === 'short' && takeProfit >= entry)
      errors.push('Take profit is wrong: it must be below the entry for a short.');
  }
  if (!Number.isFinite(stopLoss) || stopLoss <= 0)
    errors.push('Stop loss must be greater than zero.');
  else if (Number.isFinite(entry) && entry > 0) {
    if (direction === 'long' && stopLoss >= entry)
      errors.push('Stop loss is wrong: it must be below the entry for a long.');
    if (direction === 'short' && stopLoss <= entry)
      errors.push('Stop loss is wrong: it must be above the entry for a short.');
  }
  return errors;
}

function hasValidBracket(
  direction: 'long' | 'short',
  entry: number,
  takeProfit: number,
  stopLoss: number
) {
  return bracketValidationErrors(direction, entry, takeProfit, stopLoss).length === 0;
}

/** Keep the ticket's existing TP/SL distances, but put them on the correct
 * sides whenever the user changes the intended trade direction or entry. */
function orientBracketAroundEntry(
  entry: number,
  takeProfit: number,
  stopLoss: number,
  direction: 'long' | 'short',
  tickSize: number
) {
  const targetDistance = Math.max(tickSize, Math.abs(takeProfit - entry));
  const stopDistance = Math.max(tickSize, Math.abs(stopLoss - entry));
  return direction === 'long'
    ? {
        takeProfit: roundToTick(entry + targetDistance, tickSize),
        stopLoss: roundToTick(entry - stopDistance, tickSize),
      }
    : {
        takeProfit: roundToTick(entry - targetDistance, tickSize),
        stopLoss: roundToTick(entry + stopDistance, tickSize),
      };
}

const emaColors = ['#f3b33d', '#a78bfa', '#36a9e1', '#22c99a', '#ef6271', '#fb7185'];

function calculateEma(data: MnqBar[], period: number): LineData<UTCTimestamp>[] {
  const values = ema({ period, values: data.map((bar) => bar.close) });
  return values.map((value, index) => ({
    time: data[index + period - 1].time,
    value,
  }));
}

const timeframeSeconds: Record<ChartTimeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1D': 86400,
};

const initialVisibleBars: Record<ChartTimeframe, number> = {
  '1m': 240,
  '5m': 240,
  '15m': 220,
  '1h': 180,
  '4h': 120,
  '1D': 70,
};

const chartDateTime=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const chartTickTime=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const chartTimestamp=(time:unknown)=>new Date(Number(time)*1000);

function aggregateBars(data: MnqBar[], timeframe: ChartTimeframe) {
  const seconds = timeframeSeconds[timeframe];
  const ordered = [...data]
    .filter((bar) => Number.isFinite(Number(bar.time)) && [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
    .sort((a, b) => Number(a.time) - Number(b.time));
  // Live quotes arrive as one-minute bars.  Only the 1m view may use them
  // directly; the 5m view must bucket them too, otherwise live 1m candles
  // overlay the historical 5m series and make the timeframe control appear
  // to do nothing.
  if (seconds <= 60) return ordered;
  const buckets = new Map<number, MnqBar>();
  for (const bar of ordered) {
    const time = Number(bar.time);
    const bucket = Math.floor(time / seconds) * seconds;
    const current = buckets.get(bucket);
    if (!current) {
      buckets.set(bucket, { ...bar, time: bucket as UTCTimestamp });
    } else {
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
      current.volume += bar.volume;
    }
  }
  return [...buckets.values()].sort((a, b) => Number(a.time) - Number(b.time));
}

// v2 starts clean because v1 could ingest a historical crosshair close as a
// live price and create artificial candle wicks.
const LIVE_MINUTE_KEY='hedge-os:tradingview-minute-bars:v2';
const mnqTick=(price:number)=>Math.round(price/0.25)*0.25;
const cmeSessionClock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',hourCycle:'h23'});
function isCmeEquityIndexSession(timestamp:number){
  const fields=Object.fromEntries(cmeSessionClock.formatToParts(new Date(timestamp)).filter(part=>part.type==='weekday'||part.type==='hour').map(part=>[part.type,part.value]));
  const hour=Number(fields.hour),day=fields.weekday;
  // CME equity-index futures: Sun 18:00 ET → Fri 17:00 ET, with the daily
  // 17:00–18:00 ET maintenance break. Holiday calendars are intentionally not
  // inferred from a stale quote; no new bar is created unless the session is open.
  if(!Number.isFinite(hour))return false;
  if(day==='Sun')return hour>=18;
  if(day==='Fri')return hour<17;
  if(day==='Sat')return false;
  return hour!==17;
}
function normalizeLiveMinuteBars(input:LiveMinuteBar[]):LiveMinuteBar[]{
  const ordered=[...input]
    .filter(bar=>Number.isFinite(Number(bar.time))&&[bar.open,bar.high,bar.low,bar.close].every(Number.isFinite))
    .sort((a,b)=>Number(a.time)-Number(b.time));
  const byMinute=new Map<number,LiveMinuteBar>();
  for(const raw of ordered){
    const minute=Math.floor(Number(raw.time)/60)*60;
    const bar={time:minute as UTCTimestamp,open:mnqTick(raw.open),high:mnqTick(raw.high),low:mnqTick(raw.low),close:mnqTick(raw.close),volume:null};
    const current=byMinute.get(minute);
    if(current){current.high=Math.max(current.high,bar.high);current.low=Math.min(current.low,bar.low);current.close=bar.close;}
    else byMinute.set(minute,bar);
  }
  return [...byMinute.values()].slice(-4320);
}
function loadLiveMinuteBars():LiveMinuteBar[]{try{return normalizeLiveMinuteBars(JSON.parse(localStorage.getItem(LIVE_MINUTE_KEY)||'[]') as LiveMinuteBar[]);}catch{return [];}}
function recordLiveMinute(price:number,timestamp:number):LiveMinuteBar[]{
  if(!isCmeEquityIndexSession(timestamp))return loadLiveMinuteBars();
  price=mnqTick(price);
  const minute=Math.floor(timestamp/60000)*60,bars=loadLiveMinuteBars();
  const current=bars.find(bar=>Number(bar.time)===minute);
  if(current){current.high=Math.max(current.high,price);current.low=Math.min(current.low,price);current.close=price;}
  else bars.push({time:minute as UTCTimestamp,open:price,high:price,low:price,close:price,volume:null});
  const retained=normalizeLiveMinuteBars(bars);localStorage.setItem(LIVE_MINUTE_KEY,JSON.stringify(retained));return retained;
}
function chartBars(bars:LiveMinuteBar[]):MnqBar[]{return bars.map(bar=>({...bar,volume:0}));}

function ChartWorkspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const workingPriceLineRef = useRef<IPriceLine | null>(null);
  const emaSeriesRef = useRef(new Map<number, ISeriesApi<'Line'>>());
  const chartDataRef = useRef<MnqBar[]>([]);
  const displayedTimeframeRef = useRef<ChartTimeframe | null>(null);
  const chartSubmissionRef = useRef(false);
  const chartPropPositionSeenRef = useRef(false);
  const lineToolsRef = useRef<LineToolsPlugin | null>(null);
  const activeDrawingToolRef = useRef<string | null>(null);
  const isIvoryTheme = document.documentElement.dataset.theme === 'ivory';
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('5m');
  const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null);
  const [drawingMenuOpen, setDrawingMenuOpen] = useState(false);
  const [emaPeriodDraft, setEmaPeriodDraft] = useState(20);
  const [emaOverlays, setEmaOverlays] = useState<EmaOverlay[]>([
    { id: 1, period: 20, color: emaColors[0] },
  ]);
  const [hovered, setHovered] = useState<MnqBar | null>(null);
  const [latest, setLatest] = useState<MnqBar | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [orderLineRevision, setOrderLineRevision] = useState(0);
  const [chartOrderError, setChartOrderError] = useState('');
  const [liveMinuteBars,setLiveMinuteBars]=useState<LiveMinuteBar[]>(loadLiveMinuteBars);
  const [historicalBars,setHistoricalBars]=useState<MnqBar[]>([]);
  const [liveBridge,setLiveBridge]=useState<TradingViewBridgeState>({relayConnected:false,extensionConnected:false,tradingViewReady:false,tradingViewSymbol:null,lastMessage:'Bridge disconnected'});
  const [cancelSending, setCancelSending] = useState(false);
  const [showOrderLockNotice, setShowOrderLockNotice] = useState(
    () => localStorage.getItem('hedge-os:hide-order-lock-notice') !== 'true'
  );
  const [hoverLimitPoint, setHoverLimitPoint] = useState<LimitPoint | null>(null);
  const [limitMenuPoint, setLimitMenuPoint] = useState<LimitPoint | null>(null);
  const [orderControlY, setOrderControlY] = useState<{
    working: number | null;
    draft: number | null;
    tp: number | null;
    sl: number | null;
  }>({ working: null, draft: null, tp: null, sl: null });
  const orderDirection = useAppStore((state) => state.orderDirection);
  const terminalView = useAppStore((state) => state.terminalView);
  const tradingInstrument = useAppStore((state) => state.tradingInstrument);
  const propQuantity = useAppStore((state) => state.propQuantity);
  const campaigns = useAppStore((state) => state.campaigns);
  const activeCampaignId = useAppStore((state) => state.activeCampaignId);
  const accountQuantity = Math.max(
    1,
    campaigns.find((campaign) => campaign.id === activeCampaignId)?.accountQuantity ?? 1
  );
  const aggregatePropQuantity = propQuantity * accountQuantity;
  const hedgeMode = useAppStore((state) => state.hedgeMode);
  const manualHedgeRatio = useAppStore((state) => state.manualHedgeRatio);
  const autoHedgeRatio = useAppStore((state) => state.autoHedgeRatio);
  const limitOrderStatus = useAppStore((state) => state.limitOrderStatus);
  const confirmedEntryPrice = useAppStore((state) => state.confirmedEntryPrice);
  const entryPrice = useAppStore((state) => state.entryPrice);
  const takeProfit = useAppStore((state) => state.takeProfit);
  const stopLoss = useAppStore((state) => state.stopLoss);
  const exitInputMode = useAppStore((state) => state.exitInputMode);
  const setEntryPrice = useAppStore((state) => state.setEntryPrice);
  const setTakeProfit = useAppStore((state) => state.setTakeProfit);
  const setStopLoss = useAppStore((state) => state.setStopLoss);
  const setOrderDirection = useAppStore((state) => state.setOrderDirection);
  const setLimitOrderStatus = useAppStore((state) => state.setLimitOrderStatus);
  const setConfirmedEntryPrice = useAppStore((state) => state.setConfirmedEntryPrice);
  const visibleDirection =
    terminalView === 'hedge' ? (orderDirection === 'long' ? 'short' : 'long') : orderDirection;
  const visibleTakeProfit = terminalView === 'hedge' ? stopLoss : takeProfit;
  const visibleStopLoss = terminalView === 'hedge' ? takeProfit : stopLoss;
  const hedgeCatastrophicGuardPoints = Math.max(1, Math.min(20, Number(localStorage.getItem('hedge-os:hedge-catastrophic-guard-points')) || 5));
  const chartHedgeMix = calculateNasdaqHedgeMix(
    'MNQ',
    aggregatePropQuantity,
    hedgeMode === 'auto' ? autoHedgeRatio : manualHedgeRatio
  );
  const chartHedgeLabel = chartHedgeMix.label;
  const visibleQuantityLabel =
    terminalView === 'hedge'
      ? chartHedgeLabel
      : accountQuantity > 1
        ? `${propQuantity}×${accountQuantity}`
        : String(propQuantity);
  // The chart is always priced in the prop contract, but Hedge view previews
  // the inverse live leg. The menu action and the staged chart line must use
  // that visible live direction; stageLimitAt converts it back to the paired
  // prop direction before anything is sent.
  const chartLimitAction = (propSide: 'long' | 'short'): { side: 'long' | 'short'; label: string; detail: string | null } => {
    const hedgeSide = propSide === 'long' ? 'short' : 'long';
    if (terminalView === 'hedge') {
      return {
        side: hedgeSide,
        label: `${hedgeSide === 'long' ? 'Buy' : 'Sell'} ${chartHedgeLabel || 'hedge'} hedge limit`,
        detail: `Prop ${propSide === 'long' ? 'long' : 'short'} · stages the paired operation`,
      };
    }
    return {
      side: propSide,
      label: `${propSide === 'long' ? 'Buy' : 'Sell'} ${propQuantity}${accountQuantity > 1 ? ` × ${accountQuantity} accounts` : ` ${tradingInstrument}`} limit`,
      detail: null,
    };
  };
  const chartLongLimitAction = chartLimitAction('long');
  const chartShortLimitAction = chartLimitAction('short');

  useEffect(()=>subscribeTradingViewBridge(setLiveBridge),[]);
  useEffect(() => {
    const event = liveBridge.ironbeamLastEvent;
    if (event?.type !== 'prop_hedge') return;
    const status = String(event.status ?? '');
    if (!['EMERGENCY_FLATTEN_STARTED', 'EMERGENCY_FLATTEN_COMPLETED', 'PROP_FLATTEN_FAILED'].includes(status)) return;
    // A broker-side safety close must clear the local chart immediately.  Do
    // not leave a fake working bracket on screen after the prop was flattened.
    chartSubmissionRef.current = false;
    setLimitOrderStatus('idle');
    setConfirmedEntryPrice(null);
    const reason = typeof event.reason === 'string' ? event.reason.replaceAll('_', ' ') : status.replaceAll('_', ' ');
    setChartOrderError(`Pair safety close: ${reason}. See Execution & plan for the broker reconciliation log.`);
  }, [liveBridge.ironbeamLastEvent, setConfirmedEntryPrice, setLimitOrderStatus]);
  useEffect(() => {
    if (limitOrderStatus !== 'confirmed' && limitOrderStatus !== 'modifying') {
      chartPropPositionSeenRef.current = false;
      return;
    }
    const position = liveBridge.tradingViewPosition;
    const isPropMnq = position?.symbol?.toUpperCase().includes('MNQ') && position.quantity > 0;
    if (isPropMnq) {
      chartPropPositionSeenRef.current = true;
      return;
    }
    // Only clear on a flat report after this chart ticket actually observed
    // its prop position. A merely pending entry is also flat and must remain
    // visible/cancellable.
    if (chartPropPositionSeenRef.current && position === null) {
      chartSubmissionRef.current = false;
      chartPropPositionSeenRef.current = false;
      setConfirmedEntryPrice(null);
      setLimitOrderStatus('idle');
    }
  }, [limitOrderStatus, liveBridge.tradingViewPosition, setConfirmedEntryPrice, setLimitOrderStatus]);
  useEffect(()=>{
    const root = String(liveBridge.tradingViewSymbol || '').toUpperCase().match(/^(MNQ|NQ)/)?.[1];
    const fallbackPrice = Number.isFinite(liveBridge.tradingViewLast) ? liveBridge.tradingViewLast
      : Number.isFinite(liveBridge.tradingViewBid) && Number.isFinite(liveBridge.tradingViewAsk)
        ? (Number(liveBridge.tradingViewBid) + Number(liveBridge.tradingViewAsk)) / 2
        : Number.isFinite(liveBridge.tradingViewBid) ? liveBridge.tradingViewBid : liveBridge.tradingViewAsk;
    if(root!=='MNQ'||!Number.isFinite(fallbackPrice)||!liveBridge.quoteUpdatedAt)return;
    setLiveMinuteBars(recordLiveMinute(Number(fallbackPrice),liveBridge.quoteUpdatedAt));
  },[liveBridge.tradingViewLast,liveBridge.tradingViewBid,liveBridge.tradingViewAsk,liveBridge.quoteUpdatedAt,liveBridge.tradingViewSymbol]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: isIvoryTheme ? '#fffdf8' : '#0c0c0c' },
        textColor: isIvoryTheme ? '#625d55' : '#8a8a8a',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isIvoryTheme ? '#e4ded4' : '#1c1c1c' },
        horzLines: { color: isIvoryTheme ? '#e4ded4' : '#1c1c1c' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: isIvoryTheme ? '#d5cec2' : '#2b2b2b', scaleMargins: { top: 0.08, bottom: 0.2 } },
      timeScale: {
        borderColor: isIvoryTheme ? '#d5cec2' : '#2b2b2b',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        tickMarkFormatter: (time:Time) => chartTickTime.format(chartTimestamp(time)),
      },
      localization: {
        priceFormatter: (price: number) =>
          price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        timeFormatter: (time:Time) => chartDateTime.format(chartTimestamp(time)),
      },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#22c99a',
      downColor: '#ef6271',
      wickUpColor: '#22c99a',
      wickDownColor: '#ef6271',
      borderVisible: false,
      priceLineColor: '#6c9cff',
    });
    const lineTools = createLineToolsPlugin(chart, candles);
    registerLinesPlugin(lineTools);
    lineTools.registerLineTool('Rectangle', LineToolRectangle);
    registerFibRetracementPlugin(lineTools);
    registerPriceRangePlugin(lineTools);
    lineToolsRef.current = lineTools;

    const saveDrawings = () => {
      try {
        localStorage.setItem('vector-terminal:mnq-drawings', lineTools.exportLineTools());
      } catch {
        /* local persistence is best effort */
      }
    };
    const savedDrawings = localStorage.getItem('vector-terminal:mnq-drawings');
    if (savedDrawings) lineTools.importLineTools(savedDrawings);
    const handleLineEdit = (event: {
      selectedLineTool: { id: string; points: Array<{ price: number }> };
    }) => {
      const state = useAppStore.getState();
      if (
        state.limitOrderStatus === 'confirmed' &&
        ['paired-entry-line', 'paired-tp-line', 'paired-sl-line'].includes(event.selectedLineTool.id)
      ) {
        if (state.confirmedEntryPrice !== null) state.setEntryPrice(state.confirmedEntryPrice);
        setShowOrderLockNotice(
          localStorage.getItem('hedge-os:hide-order-lock-notice') !== 'true'
        );
        setOrderLineRevision((revision) => revision + 1);
        return;
      }
      saveDrawings();
      const price = event.selectedLineTool.points[0]?.price;
      if (!Number.isFinite(price)) return;
      if (event.selectedLineTool.id === 'paired-entry-line') {
        state.setEntryPrice(Number(price.toFixed(2)));
      }
      if (event.selectedLineTool.id === 'paired-entry-draft-line')
        setEntryPrice(Number(price.toFixed(2)));
      if (event.selectedLineTool.id === 'paired-tp-line') {
        (state.terminalView === 'hedge' ? state.setStopLoss : state.setTakeProfit)(
          Number(price.toFixed(2))
        );
      }
      if (event.selectedLineTool.id === 'paired-sl-line') {
        (state.terminalView === 'hedge' ? state.setTakeProfit : state.setStopLoss)(
          Number(price.toFixed(2))
        );
      }
    };
    lineTools.subscribeLineToolsAfterEdit(handleLineEdit);

    const handleDrawingDelete = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      )
        return;
      event.preventDefault();
      lineTools.removeSelectedLineTools();
      saveDrawings();
      setOrderLineRevision((revision) => revision + 1);
      setActiveDrawingTool(null);
    };
    window.addEventListener('keydown', handleDrawingDelete);
    chartRef.current = chart;
    candlesRef.current = candles;

    const refreshOrderControlCoordinates = () => {
      const state = useAppStore.getState();
      const viewTakeProfit = state.terminalView === 'hedge' ? state.stopLoss : state.takeProfit;
      const viewStopLoss = state.terminalView === 'hedge' ? state.takeProfit : state.stopLoss;
      const workingPrice =
        state.limitOrderStatus === 'confirmed' || state.limitOrderStatus === 'modifying'
          ? (state.confirmedEntryPrice ?? state.entryPrice)
          : state.entryPrice;
      const active = state.limitOrderStatus !== 'idle';
      const bracketActive =
        state.limitOrderStatus === 'confirmed' || state.limitOrderStatus === 'modifying';
      setOrderControlY({
        working: active ? candles.priceToCoordinate(workingPrice) : null,
        draft:
          state.limitOrderStatus === 'modifying'
            ? candles.priceToCoordinate(state.entryPrice)
            : null,
        tp: bracketActive ? candles.priceToCoordinate(viewTakeProfit) : null,
        sl: bracketActive ? candles.priceToCoordinate(viewStopLoss) : null,
      });
    };
    let coordinateFrame = 0;
    const scheduleCoordinateRefresh = () => {
      cancelAnimationFrame(coordinateFrame);
      coordinateFrame = requestAnimationFrame(refreshOrderControlCoordinates);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleCoordinateRefresh);
    chart.timeScale().subscribeSizeChange(scheduleCoordinateRefresh);
    container.addEventListener('wheel', scheduleCoordinateRefresh, { passive: true });
    container.addEventListener('pointermove', scheduleCoordinateRefresh);
    container.addEventListener('pointerup', scheduleCoordinateRefresh);

    chart.subscribeCrosshairMove((param) => {
      scheduleCoordinateRefresh();
      const point = param.seriesData.get(candles) as MnqBar | undefined;
      setHovered(point ?? null);
      if (!param.point || param.point.y < 0 || param.point.y > container.clientHeight) {
        return;
      }
      const price = candles.coordinateToPrice(param.point.y);
      setHoverLimitPoint(
        price === null ? null : { y: param.point.y, price: Number(price.toFixed(2)) }
      );
    });

    const handleChartClick = (param: Parameters<Parameters<typeof chart.subscribeClick>[0]>[0]) => {
      if (
        activeDrawingToolRef.current ||
        !param.point ||
        param.point.y < 0 ||
        param.point.y > container.clientHeight
      )
        return;
      const price = candles.coordinateToPrice(param.point.y);
      if (price === null) return;
      const point = { y: param.point.y, price: Number(price.toFixed(2)) };
      setHoverLimitPoint(point);
      setLimitMenuPoint(point);
    };
    chart.subscribeClick(handleChartClick);

    return () => {
      saveDrawings();
      cancelAnimationFrame(coordinateFrame);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(scheduleCoordinateRefresh);
      chart.timeScale().unsubscribeSizeChange(scheduleCoordinateRefresh);
      container.removeEventListener('wheel', scheduleCoordinateRefresh);
      container.removeEventListener('pointermove', scheduleCoordinateRefresh);
      container.removeEventListener('pointerup', scheduleCoordinateRefresh);
      window.removeEventListener('keydown', handleDrawingDelete);
      lineTools.unsubscribeLineToolsAfterEdit(handleLineEdit);
      chart.unsubscribeClick(handleChartClick);
      lineTools.destroy();
      lineToolsRef.current = null;
      chartRef.current = null;
      candlesRef.current = null;
      emaSeriesRef.current.clear();
      workingPriceLineRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    activeDrawingToolRef.current = activeDrawingTool;
  }, [activeDrawingTool]);

  useEffect(() => {
    let active = true;
    setLatest(null);
    setHovered(null);
    setLoadError(false);
    const source = timeframe === '1m' ? '/data/mnq-1m.json' : '/data/mnq-5m.json';
    fetch(source)
      .then((response) => {
        if (!response.ok) throw new Error('MNQ data unavailable');
        return response.json();
      })
      .then((sourceData: MnqBar[]) => {
        if (!active) return;
        setHistoricalBars(aggregateBars(sourceData, timeframe));
      })
      .catch(() => active && setLoadError(true));

    return () => {
      active = false;
    };
  }, [timeframe]);

  useEffect(()=>{
    if(!candlesRef.current||!historicalBars.length)return;
    // Live TradingView bars always win on a shared timestamp. Rebuilding the
    // ordered set avoids discarding a quote simply because a cached fixture or
    // an older saved bar has a later timestamp.
    const merged=new Map<number,MnqBar>();
    for(const bar of historicalBars)merged.set(Number(bar.time),bar);
    for(const bar of aggregateBars(chartBars(liveMinuteBars),timeframe))merged.set(Number(bar.time),bar);
    const data=[...merged.values()].sort((a,b)=>Number(a.time)-Number(b.time));
    const previousLast=Number(chartDataRef.current.at(-1)?.time??0);
    chartDataRef.current=data;candlesRef.current.setData(data);setLatest(data.at(-1)??null);
    emaSeriesRef.current.forEach((series,id)=>{const overlay=emaOverlays.find(item=>item.id===id);if(overlay)series.setData(calculateEma(data,overlay.period));});
    if(displayedTimeframeRef.current!==timeframe){displayedTimeframeRef.current=timeframe;chartRef.current?.timeScale().setVisibleLogicalRange({from:Math.max(0,data.length-initialVisibleBars[timeframe]),to:data.length+3});}
    else if(Number(data.at(-1)?.time??0)>previousLast)chartRef.current?.timeScale().scrollToRealTime();
  },[historicalBars,liveMinuteBars,timeframe,emaOverlays]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const wantedIds = new Set(emaOverlays.map((overlay) => overlay.id));
    emaSeriesRef.current.forEach((series, id) => {
      if (!wantedIds.has(id)) {
        chart.removeSeries(series);
        emaSeriesRef.current.delete(id);
      }
    });
    emaOverlays.forEach((overlay) => {
      let series = emaSeriesRef.current.get(overlay.id);
      if (!series) {
        series = chart.addSeries(LineSeries, {
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        emaSeriesRef.current.set(overlay.id, series);
      }
      series.applyOptions({ color: overlay.color, title: `EMA ${overlay.period}` });
      series.setData(calculateEma(chartDataRef.current, overlay.period));
    });
  }, [emaOverlays]);

  useEffect(() => {
    const lineTools = lineToolsRef.current;
    const candles = candlesRef.current;
    const timestamp = Number(chartDataRef.current.at(-1)?.time);
    if (!lineTools || !candles || !Number.isFinite(timestamp)) return;
    const orderColor = visibleDirection === 'long' ? '#2962ff' : '#f23645';
    const takeProfitColor = '#26a69a';
    const stopLossColor = '#f59e0b';
    const workingPrice =
      limitOrderStatus === 'confirmed' || limitOrderStatus === 'modifying'
        ? (confirmedEntryPrice ?? entryPrice)
        : entryPrice;
    if (limitOrderStatus === 'confirmed' || limitOrderStatus === 'modifying') {
      if (!workingPriceLineRef.current) {
        workingPriceLineRef.current = candles.createPriceLine({
          price: workingPrice,
          color: orderColor,
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: false,
          title: '',
        });
      } else {
        workingPriceLineRef.current.applyOptions({
          price: workingPrice,
          color: orderColor,
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: false,
          title: '',
        });
      }
    } else if (workingPriceLineRef.current) {
      candles.removePriceLine(workingPriceLineRef.current);
      workingPriceLineRef.current = null;
    }
    const bracketLineStyle =
      limitOrderStatus === 'confirmed' || limitOrderStatus === 'modifying' ? 0 : 1;
    const lines: Array<{
      id: string;
      price: number;
      label: string;
      color: string;
      style?: number;
    }> = [];
    if (limitOrderStatus !== 'idle') {
      lines.push({
        id: 'paired-tp-line',
        price: visibleTakeProfit,
        label: 'TP',
        color: takeProfitColor,
        style: bracketLineStyle,
      });
      lines.push({
        id: 'paired-sl-line',
        price: visibleStopLoss,
        label: 'SL',
        color: stopLossColor,
        style: bracketLineStyle,
      });
    } else {
      lineTools.removeLineToolsById(['paired-tp-line', 'paired-sl-line']);
    }
    if (limitOrderStatus !== 'idle')
      lines.unshift({
        id: 'paired-entry-line',
        price: workingPrice,
        label: '',
        color: orderColor,
        style: limitOrderStatus === 'draft' ? 1 : 0,
      });
    else lineTools.removeLineToolsById(['paired-entry-line', 'paired-entry-draft-line']);
    lines.forEach((line) =>
      lineTools.createOrUpdateLineTool(
        'HorizontalLine',
        [{ timestamp, price: line.price }],
        {
          editable: limitOrderStatus === 'draft',
          line: { color: line.color, width: 1, style: line.style ?? 0 },
          text: { value: line.label, font: { color: line.color, size: 10 } },
          showPriceAxisLabels: true,
          priceAxisLabelAlwaysVisible: true,
        },
        line.id
      )
    );
    if (limitOrderStatus === 'modifying') {
      lineTools.createOrUpdateLineTool(
        'HorizontalLine',
        [{ timestamp, price: entryPrice }],
        {
          line: { color: orderColor, width: 1, style: 1 },
          text: { value: '', font: { color: orderColor, size: 10 } },
          showPriceAxisLabels: true,
          priceAxisLabelAlwaysVisible: true,
        },
        'paired-entry-draft-line'
      );
    } else {
      lineTools.removeLineToolsById(['paired-entry-draft-line']);
    }
    const workingCoordinate =
      limitOrderStatus === 'idle' ? null : candles.priceToCoordinate(workingPrice);
    const draftCoordinate =
      limitOrderStatus === 'modifying' ? candles.priceToCoordinate(entryPrice) : null;
    const showTradeBracket = limitOrderStatus === 'confirmed' || limitOrderStatus === 'modifying';
    setOrderControlY({
      working: workingCoordinate,
      draft: draftCoordinate,
      tp: showTradeBracket ? candles.priceToCoordinate(visibleTakeProfit) : null,
      sl: showTradeBracket ? candles.priceToCoordinate(visibleStopLoss) : null,
    });
  }, [
    entryPrice,
    takeProfit,
    stopLoss,
    visibleDirection,
    visibleTakeProfit,
    visibleStopLoss,
    limitOrderStatus,
    confirmedEntryPrice,
    latest,
    orderLineRevision,
  ]);

  const stageLimitAt = (direction: 'long' | 'short') => {
    if (!limitMenuPoint) return;
    setChartOrderError('');
    const nextDirection = terminalView === 'hedge'
      ? (direction === 'long' ? 'short' : 'long')
      : direction;
    const tickSize = contractSpecs[tradingInstrument].tickSize;
    // In Dollar mode the entry click defines only the entry.  Re-create the
    // price exits from the trader's existing dollar targets; retaining raw
    // point distances here was the path that changed $1,500/$2,000 into
    // unrelated amounts when a chart limit was staged at a new price.
    const nextBracket = exitInputMode === 'dollars' && terminalView === 'prop'
      ? {
          takeProfit: exitPriceFromDollars(
            limitMenuPoint.price,
            exitDollars(entryPrice, takeProfit, propQuantity, tradingInstrument),
            propQuantity,
            tradingInstrument,
            nextDirection,
            'tp',
            tickSize
          ),
          stopLoss: exitPriceFromDollars(
            limitMenuPoint.price,
            exitDollars(entryPrice, stopLoss, propQuantity, tradingInstrument),
            propQuantity,
            tradingInstrument,
            nextDirection,
            'sl',
            tickSize
          ),
        }
      : orientBracketAroundEntry(
          limitMenuPoint.price,
          takeProfit,
          stopLoss,
          nextDirection,
          tickSize
        );
    setOrderDirection(nextDirection);
    setEntryPrice(limitMenuPoint.price);
    setTakeProfit(nextBracket.takeProfit);
    setStopLoss(nextBracket.stopLoss);
    setConfirmedEntryPrice(null);
    setLimitOrderStatus('draft');
    setLimitMenuPoint(null);
    setHoverLimitPoint(null);
  };

  const confirmLimit = async () => {
    if (chartSubmissionRef.current || limitOrderStatus === 'confirmed') return;
    if (!hasTradingRiskConsent()) {
      window.dispatchEvent(new Event('hedge-os:request-trading-risk-consent'));
      return;
    }
    const executionTick = contractSpecs[tradingInstrument].tickSize;
    const alignedEntry = roundToTick(entryPrice, executionTick);
    const alignedTakeProfit = roundToTick(takeProfit, executionTick);
    const alignedStopLoss = roundToTick(stopLoss, executionTick);
    if (!hasValidBracket(orderDirection, alignedEntry, alignedTakeProfit, alignedStopLoss)) {
      setChartOrderError(
        'Trade not opened: take profit and stop loss must be on opposite sides of the entry price.'
      );
      return;
    }
    setChartOrderError('');
    setEntryPrice(alignedEntry);
    setTakeProfit(alignedTakeProfit);
    setStopLoss(alignedStopLoss);
    const hedgeSide: 'BUY' | 'SELL' = orderDirection === 'long' ? 'SELL' : 'BUY';
    // The live legs are only instructions at this point. After the confirmed
    // MNQ prop fill, the relay reads Ironbeam BBO and submits fresh marketable LIMITs.
    const hedgeOrderType: 'LIMIT' = 'LIMIT';
    const hedgeLegs: IronbeamBracketOrder[] = [
      ...(chartHedgeMix.mnq>0?[{symbol:'MNQ',side:hedgeSide,quantity:chartHedgeMix.mnq,limitPrice:alignedEntry,takeProfitOffset:Math.abs(alignedEntry-alignedStopLoss),stopLossOffset:Math.abs(alignedTakeProfit-alignedEntry),orderType:hedgeOrderType,campaignId:activeCampaignId}]:[]),
      ...(chartHedgeMix.nnq>0?[{symbol:'NNQ',side:hedgeSide,quantity:chartHedgeMix.nnq,limitPrice:alignedEntry,takeProfitOffset:Math.abs(alignedEntry-alignedStopLoss),stopLossOffset:Math.abs(alignedTakeProfit-alignedEntry),orderType:hedgeOrderType,campaignId:activeCampaignId}]:[]),
    ];
    const previousStatus=limitOrderStatus;
    const previousConfirmedEntry=confirmedEntryPrice;
    // Lock immediately when dispatch begins. The bridge can take several seconds
    // to return a broker-level result, and a second click must never send a
    // duplicate pair while that result is still in flight.
    chartSubmissionRef.current=true;
    setConfirmedEntryPrice(alignedEntry);
    setLimitOrderStatus('confirmed');
    try {
      await sendPairedExecution({
        symbol: 'MNQ',
        side: orderDirection === 'long' ? 'BUY' : 'SELL',
        quantity: propQuantity,
        entryPrice: alignedEntry,
        takeProfit: alignedTakeProfit,
        stopLoss: alignedStopLoss,
        campaignId: activeCampaignId,
      },hedgeLegs);
    } catch (error) {
      chartSubmissionRef.current=false;
      if(previousStatus==='modifying'){
        setConfirmedEntryPrice(previousConfirmedEntry);
        setLimitOrderStatus('confirmed');
      }else{
        setConfirmedEntryPrice(null);
        setLimitOrderStatus('idle');
      }
      setChartOrderError(
        error instanceof Error
          ? error.message
          : 'Unable to send order to the TradingView extension.'
      );
      return;
    }
    chartSubmissionRef.current=false;
  };

  const cancelLimitMove = () => {
    if (confirmedEntryPrice !== null) setEntryPrice(confirmedEntryPrice);
    setLimitOrderStatus('confirmed');
  };

  const cancelLimitOrder = async () => {
    setChartOrderError('');
    if (limitOrderStatus === 'confirmed' || limitOrderStatus === 'modifying') {
      setCancelSending(true);
      try {
        const roots=[...(chartHedgeMix.mnq>0?['MNQ']:[]),...(chartHedgeMix.nnq>0?['NNQ']:[])];
        // After a live prop fill, × means close the pair. Before a fill it
        // remains a pending-order cancellation. This prevents an already-flat
        // broker trade from trapping the local chart in WORKING state.
        if (chartPropPositionSeenRef.current) await cancelPairedExecution(roots);
        else await cancelPairedPendingExecution(roots);
      } catch (error) {
        const message=error instanceof Error ? error.message : 'Unable to cancel the TradingView order.';
        // The prop cancellation is authoritative for removing this chart
        // ticket. Ironbeam can reject a redundant cancel after its strategy
        // has already stopped; retain that warning once, but never leave or
        // resurrect a TradingView working line the broker confirmed canceled.
        if(/^TradingView pending orders were canceled, but hedge cancellation was not fully confirmed\./i.test(message)) {
          setChartOrderError(message);
        } else
        if(!/could not find TradingView (?:cancel confirmation|Close position) dialog|no pending orders|no open position/i.test(message)) {
          setChartOrderError(message);
          setCancelSending(false);
          return;
        }
      }
      setCancelSending(false);
    }
    setConfirmedEntryPrice(null);
    setLimitOrderStatus('idle');
    chartPropPositionSeenRef.current = false;
  };

  const addEma = () => {
    const period = Math.max(1, Math.min(500, Math.round(emaPeriodDraft || 20)));
    setEmaOverlays((current) => [
      ...current,
      {
        id: Date.now(),
        period,
        color: emaColors[current.length % emaColors.length],
      },
    ]);
  };

  const updateEma = (id: number, period: number) => {
    const normalized = Math.max(1, Math.min(500, Math.round(period || 1)));
    setEmaOverlays((current) =>
      current.map((overlay) => (overlay.id === id ? { ...overlay, period: normalized } : overlay))
    );
  };

  const removeEma = (id: number) =>
    setEmaOverlays((current) => current.filter((overlay) => overlay.id !== id));

  const beginDrawing = (tool: string) => {
    lineToolsRef.current?.addLineTool(tool, []);
    setActiveDrawingTool(tool);
  };

  const clearDrawings = () => {
    lineToolsRef.current?.removeAllLineTools();
    try {
      localStorage.setItem('vector-terminal:mnq-drawings', '[]');
    } catch {
      /* local persistence is best effort */
    }
    setOrderLineRevision((revision) => revision + 1);
    setActiveDrawingTool(null);
  };

  const display = hovered ?? latest;
  const positive = latest ? latest.close >= latest.open : true;

  return (
    <section
      onMouseLeave={() => {
        setHoverLimitPoint(null);
        setLimitMenuPoint(null);
      }}
      className="relative min-h-0 flex-1 overflow-hidden border-b border-line bg-surface"
    >
      <div className="relative z-50 flex h-10 items-center justify-between border-b border-line bg-surface px-3">
        <div className="flex items-center gap-3">
          <div className="flex min-w-[142px] flex-col justify-center leading-none">
            <span className="font-mono text-xs font-semibold text-slate-100">
              {tradingInstrument}
            </span>
            <span className="mt-1 whitespace-nowrap text-[9px] text-muted">
              Micro E-mini Nasdaq-100 · prop MNQ / live MNQ + NNQ
            </span>
          </div>
          <span className="h-4 w-px bg-line" />
          <div role="group" aria-label="Chart timeframe" className="flex items-center gap-0.5">
            {(['1m', '5m', '15m', '1h', '4h', '1D'] as ChartTimeframe[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTimeframe(item)}
                aria-pressed={timeframe === item}
                className={cn(
                  'h-6 min-w-7 px-1.5 font-mono text-[10px] transition-colors',
                  timeframe === item
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-500 hover:bg-raised hover:text-slate-200'
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <span className="h-4 w-px bg-line" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setDrawingMenuOpen((open) => !open)}
              aria-expanded={drawingMenuOpen}
              className={cn(
                'flex h-6 items-center gap-1.5 px-2 text-[10px] transition-colors',
                drawingMenuOpen
                  ? 'bg-raised text-slate-100'
                  : 'text-slate-500 hover:bg-raised hover:text-slate-200'
              )}
            >
              <PencilRuler className="size-3" />
              Drawing tools
              <ChevronDown
                className={cn('size-3 transition-transform', drawingMenuOpen && 'rotate-180')}
              />
            </button>
            {drawingMenuOpen && (
              <div
                className="absolute left-0 top-7 z-40 w-52 border border-line bg-surface p-1 shadow-xl"
                role="toolbar"
                aria-label="Drawing tools"
              >
                {[
                  { type: 'TrendLine', label: 'Trend line', icon: TrendingUp },
                  { type: 'HorizontalLine', label: 'Horizontal line', icon: Minus },
                  { type: 'Rectangle', label: 'Rectangle', icon: Square },
                  {
                    type: 'FibRetracement',
                    label: 'Fibonacci retracement',
                    icon: ChartNoAxesCombined,
                  },
                  { type: 'PriceRange', label: 'Price range', icon: Ruler },
                ].map(({ type, label, icon: ToolIcon }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      beginDrawing(type);
                      setDrawingMenuOpen(false);
                    }}
                    className={cn(
                      'flex h-8 w-full items-center gap-2 px-2 text-[10px] text-slate-300 hover:bg-raised',
                      activeDrawingTool === type && 'bg-blue-400/10 text-blue-300'
                    )}
                  >
                    <ToolIcon className="size-3.5" />
                    {label}
                  </button>
                ))}
                <div className="my-1 border-t border-line" />
                <div className="px-2 py-1.5">
                  <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Add EMA
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={emaPeriodDraft}
                      onChange={(event) => setEmaPeriodDraft(Number(event.target.value))}
                      onKeyDown={(event) => event.key === 'Enter' && addEma()}
                      aria-label="EMA lookback period"
                      className="h-7 min-w-0 flex-1 border border-line bg-canvas px-2 font-mono text-[10px] text-slate-200 outline-none focus:border-blue-400/60"
                    />
                    <button
                      type="button"
                      onClick={addEma}
                      aria-label="Add EMA"
                      className="grid size-7 place-items-center border border-line text-slate-400 hover:bg-raised hover:text-white"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="my-1 border-t border-line" />
                <button
                  type="button"
                  onClick={() => {
                    clearDrawings();
                    setDrawingMenuOpen(false);
                  }}
                  className="flex h-8 w-full items-center gap-2 px-2 text-[10px] text-slate-400 hover:bg-red-400/10 hover:text-red-300"
                >
                  <Trash2 className="size-3.5" />
                  Clear drawings
                </button>
              </div>
            )}
          </div>
          {display && (
            <div className="hidden items-center gap-2 font-mono text-[9px] text-slate-500 xl:flex">
              <span>
                O <b className="font-normal text-slate-300">{display.open.toFixed(2)}</b>
              </span>
              <span>
                H <b className="font-normal text-slate-300">{display.high.toFixed(2)}</b>
              </span>
              <span>
                L <b className="font-normal text-slate-300">{display.low.toFixed(2)}</b>
              </span>
              <span>
                C <b className="font-normal text-slate-300">{display.close.toFixed(2)}</b>
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn('mr-2 font-mono text-xs', positive ? 'text-positive' : 'text-negative')}
          >
            {latest
              ? latest.close.toLocaleString('en-US', { minimumFractionDigits: 2 })
              : 'Loading…'}
          </span>
          <IconButton label="Chart options">
            <MoreHorizontal className="size-3.5" />
          </IconButton>
        </div>
      </div>
      <div
        ref={containerRef}
        role="application"
        aria-label="Nasdaq-100 price chart"
        className="absolute inset-x-0 bottom-0 top-10"
      />
      {hoverLimitPoint && !limitMenuPoint && (
        <button
          type="button"
          aria-label={`Create limit order at ${hoverLimitPoint.price.toFixed(2)}`}
          title="Create limit order"
          onClick={() => setLimitMenuPoint(hoverLimitPoint)}
          className="absolute right-[58px] z-30 grid size-6 place-items-center border border-slate-500 bg-surface text-slate-200 shadow-lg hover:border-blue-400 hover:bg-blue-500 hover:text-white"
          style={{ top: 40 + hoverLimitPoint.y - 12 }}
        >
          <CirclePlus className="size-4" />
        </button>
      )}
      {limitMenuPoint && (
        <div
          className="absolute right-[58px] z-40 w-56 border border-line bg-surface p-1 shadow-2xl"
          style={{ top: Math.max(44, 40 + limitMenuPoint.y - 38) }}
        >
          <div className="border-b border-line px-2 py-1.5 font-mono text-[9px] text-slate-500">
            {terminalView === 'hedge' ? 'HEDGE LIMIT PREVIEW · ' : 'LIMIT @ '}
            {limitMenuPoint.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <button
            type="button"
            onClick={() => stageLimitAt(chartLongLimitAction.side)}
            title={chartLongLimitAction.detail ?? undefined}
            className={cn(
              'flex min-h-9 w-full items-center gap-2 px-2 py-1 text-left text-[11px] text-slate-200',
              chartLongLimitAction.side === 'long'
                ? 'hover:bg-emerald-400/10 hover:text-emerald-300'
                : 'hover:bg-rose-400/10 hover:text-rose-300'
            )}
          >
            {chartLongLimitAction.side === 'long' ? <ChevronsUp className="size-4" /> : <ChevronsDown className="size-4" />}
            <span>
              {chartLongLimitAction.label}
              {chartLongLimitAction.detail && <span className="mt-0.5 block font-mono text-[8px] text-slate-500">{chartLongLimitAction.detail}</span>}
            </span>
          </button>
          <button
            type="button"
            onClick={() => stageLimitAt(chartShortLimitAction.side)}
            title={chartShortLimitAction.detail ?? undefined}
            className={cn(
              'flex min-h-9 w-full items-center gap-2 px-2 py-1 text-left text-[11px] text-slate-200',
              chartShortLimitAction.side === 'long'
                ? 'hover:bg-emerald-400/10 hover:text-emerald-300'
                : 'hover:bg-rose-400/10 hover:text-rose-300'
            )}
          >
            {chartShortLimitAction.side === 'long' ? <ChevronsUp className="size-4" /> : <ChevronsDown className="size-4" />}
            <span>
              {chartShortLimitAction.label}
              {chartShortLimitAction.detail && <span className="mt-0.5 block font-mono text-[8px] text-slate-500">{chartShortLimitAction.detail}</span>}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setLimitMenuPoint(null)}
            className="h-7 w-full border-t border-line text-[9px] uppercase tracking-wider text-slate-600 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      )}
      {orderControlY.tp !== null && (
        <div
          className="pointer-events-none absolute right-[82px] z-20 flex h-6 items-stretch overflow-hidden rounded-md bg-surface text-[9px] shadow-lg ring-1 ring-[#26a69a]"
          style={{ top: 40 + orderControlY.tp - 12 }}
        >
          <span className="grid place-items-center bg-[#26a69a] px-2 font-semibold text-slate-950">
            TP
          </span>
          <span className="grid min-w-7 place-items-center border-l border-[#26a69a]/40 px-2 font-mono text-[#5fd8ca]">
            {visibleQuantityLabel}
          </span>
          <span className="grid place-items-center border-l border-[#26a69a]/40 px-2 font-mono text-[#5fd8ca]">
            {visibleTakeProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
      {orderControlY.sl !== null && (
        <div
          className="pointer-events-none absolute right-[82px] z-20 flex h-6 items-stretch overflow-hidden rounded-md bg-surface text-[9px] shadow-lg ring-1 ring-amber-500"
          style={{ top: 40 + orderControlY.sl - 12 }}
        >
          <span className="grid place-items-center bg-amber-500 px-2 font-semibold text-slate-950">
            SL
          </span>
          <span className="grid min-w-7 place-items-center border-l border-amber-500/40 px-2 font-mono text-amber-300">
            {visibleQuantityLabel}
          </span>
          <span className="grid place-items-center border-l border-amber-500/40 px-2 font-mono text-amber-300">
            {visibleStopLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
      {orderControlY.working !== null && (
        <div
          className={cn(
            'absolute right-[82px] z-20 flex h-6 items-stretch overflow-hidden rounded-md bg-surface shadow-lg',
            visibleDirection === 'long' ? 'ring-1 ring-blue-500/80' : 'ring-1 ring-rose-500/70'
          )}
          style={{ top: 40 + orderControlY.working - 12 }}
        >
          <button
            type="button"
            onClick={limitOrderStatus === 'draft' ? confirmLimit : undefined}
            className={cn(
              'px-2 text-[9px] font-semibold uppercase tracking-wide',
              visibleDirection === 'long' ? 'text-blue-300' : 'text-rose-300',
              limitOrderStatus !== 'draft' &&
                (visibleDirection === 'long' ? 'bg-blue-600 text-white' : 'bg-rose-500 text-white'),
              limitOrderStatus === 'draft' && 'pending-entry-pulse hover:bg-raised'
            )}
          >
            {limitOrderStatus === 'draft'
              ? visibleDirection === 'long'
                ? 'Buy'
                : 'Sell'
              : 'Working'}
          </button>
          <span
            className={cn(
              'grid min-w-6 place-items-center border-l px-2 font-mono text-[9px]',
              visibleDirection === 'long'
                ? 'border-blue-500/40 text-blue-300'
                : 'border-rose-500/40 text-rose-300'
            )}
          >
            {visibleQuantityLabel}
          </span>
          <span
            className={cn(
              'grid place-items-center border-l px-2 text-[9px] uppercase',
              visibleDirection === 'long'
                ? 'border-blue-500/40 text-blue-300'
                : 'border-rose-500/40 text-rose-300'
            )}
          >
            Entry
          </span>
          <button
            type="button"
            onClick={cancelLimitOrder}
            disabled={cancelSending}
            aria-label="Cancel limit order"
            className={cn(
              'grid w-6 place-items-center border-l text-xs',
              visibleDirection === 'long'
                ? 'border-blue-500/40 text-blue-400'
                : 'border-rose-500/40 text-rose-400'
            )}
          >
            {cancelSending ? '…' : '×'}
          </button>
        </div>
      )}
      {limitOrderStatus === 'modifying' && orderControlY.draft !== null && (
        <div
          className={cn(
            'absolute right-[82px] z-30 flex h-6 items-stretch overflow-hidden rounded-md bg-surface shadow-lg ring-1',
            visibleDirection === 'long' ? 'ring-emerald-500/70' : 'ring-rose-500/70'
          )}
          style={{ top: 40 + orderControlY.draft - 12 }}
        >
          <button
            type="button"
            onClick={confirmLimit}
            className={cn(
              'px-2 text-[9px] font-semibold uppercase tracking-wide hover:bg-raised',
              visibleDirection === 'long' ? 'text-emerald-300' : 'text-rose-300'
            )}
          >
            Move
          </button>
          <span
            className={cn(
              'grid place-items-center border-l px-2 font-mono text-[8px]',
              visibleDirection === 'long'
                ? 'border-emerald-500/40 text-emerald-300'
                : 'border-rose-500/40 text-rose-300'
            )}
          >
            {entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <button
            type="button"
            onClick={cancelLimitMove}
            aria-label="Cancel limit move"
            className={cn(
              'grid w-6 place-items-center border-l text-xs',
              visibleDirection === 'long'
                ? 'border-emerald-500/40 text-emerald-400'
                : 'border-rose-500/40 text-rose-400'
            )}
          >
            ×
          </button>
        </div>
      )}
      {chartOrderError && (
        <div
          role="alert"
          className="absolute right-[82px] top-12 z-50 flex max-w-xs items-start gap-2 border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[9px] text-rose-200 shadow-xl"
        >
          <span className="min-w-0 flex-1">{chartOrderError}</span>
          <button
            type="button"
            aria-label="Dismiss warning"
            title="Dismiss"
            onClick={() => setChartOrderError('')}
            className="-mr-1 -mt-0.5 grid size-5 shrink-0 place-items-center text-rose-300/70 hover:bg-rose-500/15 hover:text-rose-100"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
      {showOrderLockNotice && limitOrderStatus === 'confirmed' && (
        <div className="absolute bottom-10 right-[82px] z-50 w-72 border border-slate-600 bg-surface p-3 text-[10px] leading-4 text-slate-300 shadow-2xl">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
            <div>
              <div className="font-semibold text-slate-100">Working orders are locked</div>
              <p className="mt-1">To change this order, cancel it and create a completely new order.</p>
              <div className="mt-2 flex gap-3">
                <button type="button" className="text-slate-400 hover:text-white" onClick={() => setShowOrderLockNotice(false)}>Dismiss</button>
                <button
                  type="button"
                  className="text-slate-400 hover:text-white"
                  onClick={() => {
                    localStorage.setItem('hedge-os:hide-order-lock-notice', 'true');
                    setShowOrderLockNotice(false);
                  }}
                >
                  Don’t show again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="absolute left-2 top-12 z-20 flex flex-col gap-1">
        {emaOverlays.map((overlay) => (
          <div
            key={overlay.id}
            className="flex h-7 items-center border border-line bg-surface shadow-lg"
          >
            <span className="mx-2 size-2" style={{ backgroundColor: overlay.color }} />
            <span className="text-[9px] font-semibold text-slate-400">EMA</span>
            <EditableNumberInput
              integer
              value={overlay.period}
              onValueChange={(value) => updateEma(overlay.id, value)}
              ariaLabel={`EMA ${overlay.period} lookback period`}
              className="h-full w-12 bg-transparent px-1.5 font-mono text-[10px] text-slate-200 outline-none focus:bg-raised"
            />
            <button
              type="button"
              onClick={() => removeEma(overlay.id)}
              aria-label={`Remove EMA ${overlay.period}`}
              className="grid size-7 place-items-center border-l border-line text-slate-600 hover:bg-red-400/10 hover:text-red-300"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
      </div>
      {loadError && (
        <div className="absolute inset-x-0 bottom-0 top-10 grid place-items-center text-xs text-negative">
          Unable to load local MNQ history.
        </div>
      )}
      <div className="pointer-events-none absolute bottom-7 left-3 border border-line bg-surface px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-slate-600">
        Historical Nasdaq-100 proxy · {timeframe === '1m' ? 'Aug 25–26' : 'May 17–Aug 26'}, 2026
      </div>
    </section>
  );
}

function OrderTicket() {
  const [ticketSection, setTicketSection] = useState<string | null>('entry');
  const [dismissedNotices, setDismissedNotices] = useState<Record<string, boolean>>({});
  // Keep following the campaign-derived recovery until the user edits it.
  // The prior effect wrote the derived default back on every recalculation,
  // which made a user's recovery input appear to reset itself.
  const recoveryContextRef = useRef<string | null>(null);
  const recoveryCustomizedRef = useRef(false);
  // Planner defaults are useful for a new campaign/phase, but they must not
  // keep replacing TP/SL after the trader has explicitly set either value.
  const exitDefaultsContextRef = useRef<string | null>(null);
  const exitValuesCustomizedRef = useRef(false);
  const sectionHeading = (id: string, label: string, summary: string) => (
    <button type="button" className="ticket-section-heading" aria-expanded={ticketSection === id} aria-controls={`ticket-${id}`} onClick={() => setTicketSection(ticketSection === id ? null : id)}>
      <span>{label}<small>{summary}</small></span><ChevronDown className={cn('size-4 shrink-0', ticketSection === id && 'rotate-180')} />
    </button>
  );
  const engineObjective=useAppStore(state=>state.campaignObjective);
  const [armError, setArmError] = useState('');
  const [bridgeSending, setBridgeSending] = useState(false);
  const [contractLimitGuardEnabled] = useState(() => localStorage.getItem('hedge-os:contract-limit-guard') !== 'off');
  const instrument = useAppStore((state) => state.tradingInstrument);
  const terminalView = useAppStore((state) => state.terminalView);
  const setTerminalView = useAppStore((state) => state.setTerminalView);
  const direction = useAppStore((state) => state.orderDirection);
  const entry = useAppStore((state) => state.entryPrice);
  const tp = useAppStore((state) => state.takeProfit);
  const sl = useAppStore((state) => state.stopLoss);
  const exitInputMode = useAppStore((state) => state.exitInputMode);
  const quantity = useAppStore((state) => state.propQuantity);
  const hedgeMode = useAppStore((state) => state.hedgeMode);
  const manualRatio = useAppStore((state) => state.manualHedgeRatio);
  const autoRatio = useAppStore((state) => state.autoHedgeRatio);
  const requiredRecovery = useAppStore((state) => state.hedgeRequiredRecovery);
  const frictionAllowance = useAppStore((state) => state.hedgeFrictionAllowance);
  const desiredFailureProfit = useAppStore((state) => state.hedgeDesiredFailureProfit);
  const limitStatus = useAppStore((state) => state.limitOrderStatus);
  const confirmedPrice = useAppStore((state) => state.confirmedEntryPrice);
  const setDirection = useAppStore((state) => state.setOrderDirection);
  const setEntry = useAppStore((state) => state.setEntryPrice);
  const setTp = useAppStore((state) => state.setTakeProfit);
  const setSl = useAppStore((state) => state.setStopLoss);
  const setExitInputMode = useAppStore((state) => state.setExitInputMode);
  const setQuantity = useAppStore((state) => state.setPropQuantity);
  const setHedgeMode = useAppStore((state) => state.setHedgeMode);
  const setManualRatio = useAppStore((state) => state.setManualHedgeRatio);
  const setAutoRatio = useAppStore((state) => state.setAutoHedgeRatio);
  const setRequiredRecovery = useAppStore((state) => state.setHedgeRequiredRecovery);
  const setFrictionAllowance = useAppStore((state) => state.setHedgeFrictionAllowance);
  const setDesiredFailureProfit = useAppStore((state) => state.setHedgeDesiredFailureProfit);
  const setLimitStatus = useAppStore((state) => state.setLimitOrderStatus);
  const setConfirmedPrice = useAppStore((state) => state.setConfirmedEntryPrice);
  const campaigns = useAppStore((state) => state.campaigns);
  const activeCampaignId = useAppStore((state) => state.activeCampaignId);
  const activeCampaign =
    campaigns.find((campaign) => campaign.id === activeCampaignId) ?? campaigns[0];
  const accountQuantity = Math.max(1, activeCampaign?.accountQuantity ?? 1);
  const contractLimit = activeCampaign ? getCurrentContractLimit(activeCampaign) : null;
  const contractLimitExceeded = Boolean(contractLimitGuardEnabled && terminalView === 'prop' && contractLimit && quantity > contractLimit.maxContracts);
  const contractLimitMessage = contractLimit
    ? `${activeCampaign?.accountTypeName ?? 'Active account'} allows ${contractLimit.maxContracts} MNQ prop contract${contractLimit.maxContracts === 1 ? '' : 's'} per account in its ${contractLimit.phase === 'funded' ? `funded tier${contractLimit.tierProfit !== null ? ` ($${contractLimit.tierProfit.toLocaleString()}+ closed profit)` : ''}` : 'evaluation'}. You entered ${quantity}.`
    : '';
  const aggregatePropQuantity = quantity * accountQuantity;
  const optimalPlan = getOptimalTradePlan(activeCampaign);
  const evaluationPlan = getOptimalTradePlan(activeCampaign, 'evaluation');
  const performancePlan = getOptimalTradePlan(activeCampaign, 'performance');
  const postPayoutPlan = getOptimalTradePlan(activeCampaign, 'post-payout');
  const visibleDirection =
    terminalView === 'hedge' ? (direction === 'long' ? 'short' : 'long') : direction;
  const visibleTp = terminalView === 'hedge' ? sl : tp;
  const visibleSl = terminalView === 'hedge' ? tp : sl;
  const hedgeCatastrophicGuardPoints = Math.max(1, Math.min(20, Number(localStorage.getItem('hedge-os:hedge-catastrophic-guard-points')) || 5));
  const setVisibleTp = terminalView === 'hedge' ? setSl : setTp;
  const setVisibleSl = terminalView === 'hedge' ? setTp : setSl;

  const paLossAtFailure = Math.abs(
    (sl - entry) * contractSpecs[instrument].pointValue * aggregatePropQuantity
  );
  const configuredMaxDrawdownPerAccount =
    activeCampaign?.phases[activeCampaign.currentPhase]?.maxDrawdown ??
    (optimalPlan?.phase === 'Evaluation'
      ? activeCampaign?.evaluationRules.maxDrawdown
      : activeCampaign?.performanceRules.maxDrawdown) ??
    0;
  // A stopped position has incurred both the market loss and the complete
  // entry-and-exit prop commission. Reserve that commission before exposing a
  // maximum stop, otherwise a "$2,000 stop" can breach a $2,000 drawdown.
  const roundTripPropFees = estimatePropFees(1, aggregatePropQuantity, instrument);
  const aggregateMaxDrawdown = configuredMaxDrawdownPerAccount * accountQuantity;
  const maxGrossStopLoss = aggregateMaxDrawdown > 0
    ? Math.max(0, aggregateMaxDrawdown - roundTripPropFees)
    : Number.POSITIVE_INFINITY;
  const maxGrossStopLossPerAccount = maxGrossStopLoss / accountQuantity;
  const stopLossTotalCost = paLossAtFailure + roundTripPropFees;
  const stopLossExceedsDrawdown = aggregateMaxDrawdown > 0 &&
    stopLossTotalCost > aggregateMaxDrawdown + 0.01;
  const roadmapSteps = [
    ...(evaluationPlan?.steps ?? []),
    ...(performancePlan?.steps ?? []),
    ...(postPayoutPlan?.steps ?? []),
  ];
  const roadmapOutcomes = projectRoadmapOutcomes(
    roadmapSteps,
    activeCampaign?.evaluationSpend ?? 0,
    frictionAllowance,
    desiredFailureProfit,
    paLossAtFailure,
    aggregatePropQuantity,
    instrument,
    (activeCampaign?.performanceRules.activationFee ?? 0) * accountQuantity,
    accountQuantity,
    activeCampaign ? getOptimalPayoutHedgeRatio(activeCampaign) : 46
  );
  const phaseOffset =
    optimalPlan?.phase === 'Performance account'
      ? (evaluationPlan?.steps.length ?? 0)
      : optimalPlan?.phase === 'Post-payout'
        ? (evaluationPlan?.steps.length ?? 0) + (performancePlan?.steps.length ?? 0)
        : 0;
  const objectiveIndex =
    phaseOffset + Math.max(0, optimalPlan?.steps.indexOf(optimalPlan.objective) ?? 0);
  const derivedRequiredRecovery =
    roadmapOutcomes[objectiveIndex]?.requiredRecovery ?? activeCampaign?.evaluationSpend ?? 0;
  const currentRoadmapStep = roadmapSteps[objectiveIndex];
  const projectedPropFeeAtFailure = roundTripPropFees;
  const effectiveMarketDownside = paLossAtFailure + projectedPropFeeAtFailure;
  // Only actual live-side costs belong in cash recovery. This temporary
  // percentage reserve is later replaceable by broker-reported fees.
  const estimatedLiveFee = estimateLiveFees(requiredRecovery);
  const baseRecoveryRequirement = requiredRecovery + frictionAllowance + desiredFailureProfit + estimatedLiveFee;
  const calculatedAutoRatio =
    currentRoadmapStep?.type === 'post-payout-base-hit'
      ? activeCampaign
        ? getOptimalPayoutHedgeRatio(activeCampaign)
        : 46
      : paLossAtFailure > 0
        ? (baseRecoveryRequirement / Math.max(0.01, effectiveMarketDownside)) * 100
        : 0;
  const suggestedPropMNQQuantity = selectMnqPropQuantity({
    netTarget: Math.max(0, currentRoadmapStep?.target ?? Math.abs((tp - entry) * contractSpecs[instrument].pointValue * aggregatePropQuantity)),
    effectiveMarketDownside: Math.max(0, effectiveMarketDownside),
    recoveryRatioPercent: calculatedAutoRatio,
    maxPropMNQ: contractLimit?.maxContracts ?? 20,
  });
  const ratioPercent = hedgeMode === 'auto' ? autoRatio : manualRatio;
  const hedgeMix = calculateNasdaqHedgeMix('MNQ', aggregatePropQuantity, ratioPercent);
  const hedgeFees = estimatedLiveFee;
  const executableHedgeQuantity = hedgeMix.resultingMNQEquivalent;
  const requestedHedgeQuantity = (aggregatePropQuantity * ratioPercent) / 100;
  const effectiveHedgeRatio = hedgeMix.effectiveRatio;
  const ratio = effectiveHedgeRatio / 100;
  const multiplier = contractSpecs[instrument].pointValue;
  const side = direction === 'long' ? 1 : -1;
  const paTp = (tp - entry) * multiplier * aggregatePropQuantity * side;
  const paSl = (sl - entry) * multiplier * aggregatePropQuantity * side;
  const propFees = estimatePropFees(paTp,aggregatePropQuantity,instrument);
  const propSlFees = estimatePropFees(paSl,aggregatePropQuantity,instrument);
  const hedgeAtTp = -paTp * ratio;
  const hedgeAtSl = -paSl * ratio;
  const netPaTp = paTp - propFees;
  const netPaSl = paSl - propSlFees;
  const netHedgeAtTp = hedgeAtTp - hedgeFees;
  const netHedgeAtSl = hedgeAtSl - hedgeFees;
  const money = (value: number) =>
    `${value >= 0 ? '+' : '-'}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const orderLocked = limitStatus === 'confirmed' || limitStatus === 'modifying';
  const lockedOrderMessage = 'This working order is locked. Cancel it, then create a completely new order.';
  const updateNumber = (setter: (value: number) => void) => (value: number) => {
    if (orderLocked) {
      setArmError(lockedOrderMessage);
      return;
    }
    setter(value);
    setArmError('');
  };
  const updatePropExit = (setter: (value: number) => void) => (value: number) => {
    exitValuesCustomizedRef.current = true;
    updateNumber(setter)(value);
  };
  const disarmForEdit = () => {
    setArmError(orderLocked ? lockedOrderMessage : '');
  };
  const confirmTicketLimit = async () => {
    if (!hasTradingRiskConsent()) {
      window.dispatchEvent(new Event('hedge-os:request-trading-risk-consent'));
      return;
    }
    if (contractLimitExceeded) {
      setArmError(`Order blocked by provider contract-limit guard. ${contractLimitMessage}`);
      return;
    }
    if (stopLossExceedsDrawdown) {
      setArmError(
        `Order blocked by drawdown guard. Market stop $${paLossAtFailure.toFixed(2)} + estimated prop fees $${roundTripPropFees.toFixed(2)} = $${stopLossTotalCost.toFixed(2)}, above the $${aggregateMaxDrawdown.toFixed(2)} maximum drawdown. Set the market stop no higher than $${maxGrossStopLoss.toFixed(2)}.`
      );
      return;
    }
    const errors = bracketValidationErrors(visibleDirection, entry, visibleTp, visibleSl);
    if (errors.length) {
      setArmError(errors.join(' '));
      return;
    }
    const executionTick = contractSpecs[instrument].tickSize;
    const alignedEntry = roundToTick(entry, executionTick);
    const alignedTp = roundToTick(tp, executionTick);
    const alignedSl = roundToTick(sl, executionTick);
    const hedgeSide: 'BUY' | 'SELL' = direction === 'long' ? 'SELL' : 'BUY';
    // MNQ is staged immediately at this exact entry and bracket geometry. The
    // relay uses a non-marketable inverse trigger when required for safety;
    // NNQ remains a fresh-BBO marketable limit after the MNQ fill is verified.
    const hedgeOrderType: 'LIMIT' = 'LIMIT';
    const hedgeLegs: IronbeamBracketOrder[] = [
      ...(hedgeMix.mnq > 0 ? [{symbol:'MNQ',side:hedgeSide,quantity:hedgeMix.mnq,limitPrice:alignedEntry,takeProfitOffset:Math.abs(alignedEntry-alignedSl),stopLossOffset:Math.abs(alignedTp-alignedEntry),orderType:hedgeOrderType,campaignId:activeCampaignId}] : []),
      ...(hedgeMix.nnq > 0 ? [{symbol:'NNQ',side:hedgeSide,quantity:hedgeMix.nnq,limitPrice:alignedEntry,takeProfitOffset:Math.abs(alignedEntry-alignedSl),stopLossOffset:Math.abs(alignedTp-alignedEntry),orderType:hedgeOrderType,campaignId:activeCampaignId}] : []),
    ];
    if(!hedgeLegs.length){setArmError('No executable hedge contracts were calculated. Increase the hedge ratio or prop quantity.');return;}
    const previousStatus=limitStatus;
    const previousConfirmedPrice=confirmedPrice;
    setArmError('');
    // Make the provisional working order visible before waiting on the bridge,
    // which prevents repeated ARM PAIR clicks from creating duplicate signals.
    setEntry(alignedEntry);
    setTp(alignedTp);
    setSl(alignedSl);
    setConfirmedPrice(alignedEntry);
    setLimitStatus('confirmed');
    setBridgeSending(true);
    try {
      await sendPairedExecution({
        symbol: 'MNQ',
        side: direction === 'long' ? 'BUY' : 'SELL',
        quantity,
        entryPrice: alignedEntry,
        takeProfit: alignedTp,
        stopLoss: alignedSl,
        campaignId: activeCampaignId,
      },hedgeLegs);
    } catch (error) {
      if(previousStatus==='modifying'){
        setConfirmedPrice(previousConfirmedPrice);
        setLimitStatus('confirmed');
      }else{
        setConfirmedPrice(null);
        setLimitStatus('idle');
      }
      setArmError(error instanceof Error ? error.message : 'Unable to send order to the TradingView extension.');
    } finally {
      setBridgeSending(false);
    }
  };
  const cancelTicketMove = () => {
    if (confirmedPrice !== null) setEntry(confirmedPrice);
    setLimitStatus('confirmed');
  };
  const cancelTicketOrder = async () => {
    setArmError('');
    setBridgeSending(true);
    try {
      const hedgeRoots=[...(hedgeMix.mnq>0?['MNQ']:[]),...(hedgeMix.nnq>0?['NNQ']:[])];
      // A pending ticket must only cancel pending orders. The prior path
      // always invoked TradingView's global Flatten control, which could close
      // an unrelated or newly observed prop position during a no-fill cancel.
      const propIsOpen=Number(getTradingViewBridgeState().tradingViewPosition?.quantity||0)>0;
      if(propIsOpen) await cancelPairedExecution(hedgeRoots);
      else await cancelPairedPendingExecution(hedgeRoots);
      setConfirmedPrice(null);
      setLimitStatus('idle');
    } catch (error) {
      const message=error instanceof Error ? error.message : 'Unable to cancel the TradingView order.';
      setArmError(message);
    } finally {
      setBridgeSending(false);
    }
  };
  const changeDirection = (nextDirection: 'long' | 'short') => {
    if (orderLocked) {
      setArmError(lockedOrderMessage);
      return;
    }
    const nextPropDirection = terminalView === 'hedge'
      ? (nextDirection === 'long' ? 'short' : 'long')
      : nextDirection;
    if (nextPropDirection !== direction) {
      const nextBracket = orientBracketAroundEntry(
        entry,
        tp,
        sl,
        nextPropDirection,
        contractSpecs[instrument].tickSize
      );
      setTp(nextBracket.takeProfit);
      setSl(nextBracket.stopLoss);
    }
    setDirection(nextPropDirection);
    setArmError('');
  };
  const displayedQuantity = terminalView === 'hedge' ? executableHedgeQuantity : quantity;
  const hedgeMnqEquivalent = hedgeMix.resultingDollarsPerPoint / NASDAQ_CONTRACT_SPECS.MNQ.dollarsPerPoint;
  const executionTickSize =
    contractSpecs[instrument].tickSize;
  const displayedTpValue =
    terminalView === 'hedge' && exitInputMode === 'dollars'
      ? Number(Math.abs(netHedgeAtSl).toFixed(2))
      : exitInputMode === 'dollars'
      ? Number(exitDollars(entry, visibleTp, displayedQuantity, instrument).toFixed(2))
      : visibleTp;
  const displayedSlValue =
    terminalView === 'hedge' && exitInputMode === 'dollars'
      ? Number(Math.abs(netHedgeAtTp).toFixed(2))
      : exitInputMode === 'dollars'
      ? Number(exitDollars(entry, visibleSl, displayedQuantity, instrument).toFixed(2))
      : visibleSl;
  const updateVisibleTp = (value: number) =>
    setVisibleTp(
      exitInputMode === 'dollars'
        ? exitPriceFromDollars(
            entry,
            value,
            displayedQuantity,
            instrument,
            visibleDirection,
            'tp',
            executionTickSize
          )
        : value
    );
  const updateVisibleSl = (value: number) =>
    setVisibleSl(
      exitInputMode === 'dollars'
        ? exitPriceFromDollars(
            entry,
            value,
            displayedQuantity,
            instrument,
            visibleDirection,
            'sl',
            executionTickSize
          )
        : value
    );
  const updateDisplayedQuantity = (value: number) => {
    if (orderLocked) {
      setArmError(lockedOrderMessage);
      return;
    }
    if (terminalView === 'prop') {
      const nextQuantity = Math.max(1, Math.round(value));
      setQuantity(nextQuantity);
      if (contractLimitGuardEnabled && contractLimit && nextQuantity > contractLimit.maxContracts) {
        setArmError(`Provider contract-limit warning: ${activeCampaign?.accountTypeName ?? 'This account'} is currently limited to ${contractLimit.maxContracts} MNQ prop contract${contractLimit.maxContracts === 1 ? '' : 's'} per account (${contractLimit.phase}${contractLimit.tierProfit !== null ? ` tier: $${contractLimit.tierProfit.toLocaleString()}+ closed profit` : ''}).`);
      } else setArmError('');
      return;
    }
    const ratioDecimal = ratioPercent / 100;
    if (ratioDecimal <= 0) {
      setArmError('Cannot set hedge quantity: hedge ratio must be greater than zero.');
      return;
    }
    const requiredAggregatePropQuantity = value / ratioDecimal;
    const requiredPerAccountQuantity = requiredAggregatePropQuantity / accountQuantity;
    const wholePropQuantity = Math.round(requiredPerAccountQuantity);
    if (wholePropQuantity < 1 || Math.abs(requiredPerAccountQuantity - wholePropQuantity) > 1e-8) {
      setArmError(
        `Hedge quantity rejected: ${value} at ${ratioPercent.toFixed(1)}% requires ${requiredPerAccountQuantity.toFixed(3)} prop contracts per account across ${accountQuantity} copied account${accountQuantity === 1 ? '' : 's'}. Per-account quantity must be a whole number.`
      );
      return;
    }
    setQuantity(wholePropQuantity);
    setArmError('');
  };

  const setManualHedgeRatioFromExposure = (nextRatioPercent: number) => {
    if (orderLocked) {
      setArmError(lockedOrderMessage);
      return;
    }
    if (!Number.isFinite(nextRatioPercent) || nextRatioPercent < 0) return;
    // Editing a Hedge-view value is deliberately an override of the hedge
    // only. It must never resize the prop order or move its TP/SL boundaries.
    setHedgeMode('manual');
    setManualRatio(nextRatioPercent);
    setArmError('');
  };

  const updateHedgeOutcome = (value: number, propOutcome: number) => {
    if (Math.abs(propOutcome) <= Number.EPSILON) {
      setArmError('Set a prop entry and exit distance before setting hedge exposure.');
      return;
    }
    setManualHedgeRatioFromExposure((Math.max(0, value) / Math.abs(propOutcome)) * 100);
  };

  const updateHedgeMnqEquivalent = (value: number) => {
    if (aggregatePropQuantity <= 0) return;
    setManualHedgeRatioFromExposure((Math.max(0, value) / aggregatePropQuantity) * 100);
  };

  useEffect(() => {
    if(useAppStore.getState().limitOrderStatus==='confirmed'||useAppStore.getState().limitOrderStatus==='modifying') return;
    const defaultsContext = `${activeCampaign?.id ?? 'none'}:${activeCampaign?.currentPhase ?? 0}:${engineObjective?.campaignId ?? 'none'}:${engineObjective?.targetProfit ?? 'none'}:${engineObjective?.stopLoss ?? 'none'}`;
    if (exitDefaultsContextRef.current !== defaultsContext) {
      exitDefaultsContextRef.current = defaultsContext;
      exitValuesCustomizedRef.current = false;
    }
    if (exitValuesCustomizedRef.current) return;
    if(engineObjective?.campaignId===activeCampaign?.id) {
      setExitInputMode('dollars');
      setTp(exitPriceFromDollars(entry,grossForNetTarget(engineObjective.targetProfit,quantity,instrument),quantity,instrument,direction,'tp',executionTickSize));
      setSl(stopPriceFromGrossLossBudget(entry,Math.min(engineObjective.stopLoss,maxGrossStopLossPerAccount),quantity,instrument,direction,executionTickSize));
      setHedgeMode('manual');
      setManualRatio(engineObjective.hedgeRatioPercent);
      return;
    }
    const objective = optimalPlan?.objective;
    if (!objective?.target) return;
    setExitInputMode('dollars');
    setTp(
      exitPriceFromDollars(
        entry,
        grossForNetTarget(objective.target,quantity,instrument),
        quantity,
        instrument,
        direction,
        'tp',
        executionTickSize
      )
    );
    if (objective.failure)
      setSl(
        stopPriceFromGrossLossBudget(
          entry,
          Math.min(objective.failure,maxGrossStopLossPerAccount),
          quantity,
          instrument,
          direction,
          executionTickSize
        )
      );
    setArmError('');
  }, [activeCampaign?.id, activeCampaign?.currentPhase, direction, quantity, instrument, engineObjective]);

  useEffect(() => {
    setFrictionAllowance(0);
    setDesiredFailureProfit(0);
  }, [activeCampaign?.id]);

  useEffect(() => {
    const campaignPhaseKey = `${activeCampaign?.id ?? 'none'}:${activeCampaign?.currentPhase ?? 0}`;
    if (recoveryContextRef.current !== campaignPhaseKey) {
      recoveryContextRef.current = campaignPhaseKey;
      recoveryCustomizedRef.current = false;
    }
    if (!recoveryCustomizedRef.current) setRequiredRecovery(derivedRequiredRecovery);
  }, [activeCampaign?.id, activeCampaign?.currentPhase, derivedRequiredRecovery, setRequiredRecovery]);

  useEffect(() => {
    setAutoRatio(Number.isFinite(calculatedAutoRatio) ? calculatedAutoRatio : 0);
  }, [calculatedAutoRatio, setAutoRatio]);

  const optimalStopTolerance = contractSpecs[instrument].tickValue * Math.max(1, aggregatePropQuantity);
  const optimalTargetTolerance = Math.max(optimalStopTolerance, OPTIMAL_TARGET_TOLERANCE_USD);
  const aggregateOptimalTarget = (optimalPlan?.objective.target ?? 0) * accountQuantity;
  const engineOptimalTarget = engineObjective?.campaignId === activeCampaign?.id
    ? engineObjective.targetProfit * accountQuantity
    : null;
  const optimalNetTarget = engineOptimalTarget ?? (optimalPlan?.objective.target ? aggregateOptimalTarget : null);
  const requiredGrossTarget = optimalNetTarget === null
    ? null
    : grossForNetTarget(optimalNetTarget, aggregatePropQuantity, instrument);
  const feeShortfall = requiredGrossTarget === null ? 0 : Math.max(0, requiredGrossTarget - paTp);
  const targetIsNearObjective = optimalNetTarget !== null &&
    Math.abs(paTp - optimalNetTarget) <= optimalTargetTolerance;
  const needsFeeReview = terminalView === 'prop' && exitInputMode === 'dollars' &&
    paTp > 0 && targetIsNearObjective && feeShortfall > 0;
  useEffect(() => {
    setDismissedNotices({});
  }, [terminalView, exitInputMode, paTp, paLossAtFailure, aggregatePropQuantity, activeCampaign?.id, activeCampaign?.currentPhase]);
  const dismissNotice = (notice: string) =>
    setDismissedNotices((current) => ({ ...current, [notice]: true }));
  const departsFromOptimal = Boolean(
    engineObjective?.campaignId===activeCampaign?.id ?
      Math.abs(paTp-engineObjective.targetProfit*accountQuantity)>optimalTargetTolerance || Math.abs(Math.abs(paSl)-engineObjective.stopLoss*accountQuantity)>optimalStopTolerance :
    optimalPlan?.objective.target &&
      (optimalPlan.phase !== 'Evaluation'
        ? paTp + optimalTargetTolerance < aggregateOptimalTarget
        : Math.abs(paTp - aggregateOptimalTarget) > optimalTargetTolerance ||
          Boolean(
            optimalPlan.objective.failure &&
              Math.abs(Math.abs(paSl) - optimalPlan.objective.failure * accountQuantity) >
                optimalStopTolerance
          ))
  );

  return (
    <aside className="terminal-ticket w-[344px] shrink-0 overflow-y-auto border-l border-line bg-surface">
      <div className="ticket-heading"><span className="section-kicker">Trade setup</span><h2>Order ticket</h2><p>Configure your entry and paired hedge.</p></div>
      {engineObjective?.campaignId===activeCampaign?.id&&<div className="border-b border-blue-400/30 bg-blue-400/10 p-3 text-xs"><div className="text-blue-200">Campaign planner · {engineObjective.purpose.replaceAll('_',' ')}</div><p className="mt-2 text-muted">Objective loaded as a draft. Review quantity (maximum {engineObjective.maxContracts}), entry and tick-rounded exits before confirming. No order was sent.</p><button className="mt-2 underline" onClick={()=>useAppStore.getState().setCampaignObjective(null)}>Return to roadmap defaults</button></div>}
      <div className="border-b border-line bg-surface p-2.5">
        <SegmentedControl<TerminalView>
          label="Terminal view"
          value={terminalView}
          onChange={(nextView) => {
            setTerminalView(nextView);
            // Hedge outcomes are exposure dollars, not alternate prop price
            // boundaries. Keep the editable representation unambiguous.
            if (nextView === 'hedge') setExitInputMode('dollars');
          }}
          options={[
            { label: 'Prop', value: 'prop' },
            { label: 'Hedge', value: 'hedge' },
          ]}
          className="w-full"
        />
      </div>
      <div className="ticket-sections">
        {sectionHeading('entry', 'Entry & direction', `${visibleDirection} · ${entry.toLocaleString('en-US')}`)}
        <div id="ticket-entry" className="ticket-section-body" hidden={ticketSection !== 'entry'}>
        <label className="field-label">Direction</label>
        <div className="mb-3 grid grid-cols-2 border border-line">
          {(['long', 'short'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => changeDirection(item)}
              className={cn(
                'h-9 text-[10px] font-semibold uppercase',
                visibleDirection === item
                  ? item === 'long'
                    ? 'bg-emerald-400/10 text-emerald-300'
                    : 'bg-rose-400/10 text-rose-300'
                  : 'text-muted hover:bg-raised',
                item === 'short' && 'border-l border-line'
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="field-label">Entry · {instrument} price</label>
            <EditableNumberInput
              ariaLabel={`Entry ${instrument} price`}
              value={entry}
              onValueChange={updateNumber(setEntry)}
              onEdit={disarmForEdit}
              className="field-input font-mono"
            />
          </div>
        </div>
        </div>
        {sectionHeading(
          'exits',
          'Size & exits',
          terminalView === 'prop'
            ? `${quantity} ${instrument} · TP ${displayedTpValue} / SL ${displayedSlValue}`
            : `${hedgeMnqEquivalent.toFixed(2)} MNQ-eq · ${effectiveHedgeRatio.toFixed(1)}% · ${hedgeMix.label || '0 contracts'}`
        )}
        <div id="ticket-exits" className="ticket-section-body space-y-3" hidden={ticketSection !== 'exits'}>
          <div>
            <label className="field-label">TP / SL input</label>
            <div className="grid grid-cols-2 border border-line">
              <button
                type="button"
                onClick={() => setExitInputMode('dollars')}
                className={cn(
                  'h-8 text-[10px] font-semibold uppercase',
                  exitInputMode === 'dollars'
                    ? 'bg-blue-400/10 text-blue-300'
                    : 'text-muted hover:bg-raised'
                )}
              >
                Dollar amount
              </button>
              <button
                type="button"
                onClick={() => setExitInputMode('price')}
                disabled={terminalView === 'hedge'}
                className={cn(
                  'h-8 border-l border-line text-[10px] font-semibold uppercase',
                  exitInputMode === 'price'
                    ? 'bg-blue-400/10 text-blue-300'
                    : 'text-muted hover:bg-raised',
                  terminalView === 'hedge' && 'cursor-not-allowed opacity-40'
                )}
              >
                Price
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">
                {terminalView === 'hedge' ? 'Gain if prop stops' : 'Take profit'} · {exitInputMode === 'dollars' ? 'USD' : 'Price'}
              </label>
              <EditableNumberInput
                ariaLabel={terminalView === 'hedge' ? 'Hedge gain if prop stops' : 'Take profit'}
                value={displayedTpValue}
                onValueChange={terminalView === 'hedge'
                  ? (value) => updateHedgeOutcome(value, paSl)
                  : updatePropExit(updateVisibleTp)}
                onEdit={disarmForEdit}
                readOnly={terminalView === 'hedge' && exitInputMode === 'price'}
                className="field-input font-mono text-positive"
              />
            </div>
            <div>
              <label className="field-label">
                {terminalView === 'hedge' ? 'Loss if prop targets' : 'Stop loss'} · {exitInputMode === 'dollars' ? 'USD' : 'Price'}
              </label>
              <EditableNumberInput
                ariaLabel={terminalView === 'hedge' ? 'Hedge loss if prop targets' : 'Stop loss'}
                value={displayedSlValue}
                onValueChange={terminalView === 'hedge'
                  ? (value) => updateHedgeOutcome(value, paTp)
                  : updatePropExit(updateVisibleSl)}
                onEdit={disarmForEdit}
                readOnly={terminalView === 'hedge' && exitInputMode === 'price'}
                className="field-input font-mono text-negative"
              />
            </div>
          </div>
          {departsFromOptimal && optimalPlan && (
            <div
              role="status"
              className="flex gap-2 border border-amber-500/30 bg-amber-500/[0.07] p-2.5 text-[9px] leading-4 text-amber-200/80"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
              <span>
                <b className="font-semibold text-amber-300">Not on the optimal trade map.</b>{' '}
                {optimalPlan.phase !== 'Evaluation'
                  ? `Net objective: $${aggregateOptimalTarget.toLocaleString('en-US')}. This ${aggregatePropQuantity}-MNQ aggregate position needs $${grossForNetTarget(aggregateOptimalTarget,aggregatePropQuantity,instrument).toLocaleString('en-US',{maximumFractionDigits:2})} gross including Tradovate round-trip fees. Stop risk is your choice; Hedge OS uses it to calculate the required hedge ratio.`
                  : `Net evaluation objective: $${aggregateOptimalTarget.toLocaleString('en-US')}. This ${aggregatePropQuantity}-MNQ aggregate position targets $${grossForNetTarget(aggregateOptimalTarget,aggregatePropQuantity,instrument).toLocaleString('en-US',{maximumFractionDigits:2})} gross including Tradovate round-trip fees.`}
              </span>
            </div>
          )}
          {needsFeeReview && !dismissedNotices.feeReview && requiredGrossTarget !== null && optimalNetTarget !== null && (
            <div
              role="status"
              className="mt-2 flex gap-2 border border-amber-500/30 bg-amber-500/[0.07] p-2.5 text-[9px] leading-4 text-amber-200/80"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
              <span className="min-w-0 flex-1">
                <b className="font-semibold text-amber-300">Fee check before arming.</b>{' '}
                ${paTp.toLocaleString('en-US', { maximumFractionDigits: 2 })} is a gross target. Estimated prop round-trip fees are ${propFees.toLocaleString('en-US', { maximumFractionDigits: 2 })}, leaving about ${netPaTp.toLocaleString('en-US', { maximumFractionDigits: 2 })} net—${feeShortfall.toLocaleString('en-US', { maximumFractionDigits: 2 })} short of the ${optimalNetTarget.toLocaleString('en-US', { maximumFractionDigits: 2 })} campaign objective. Use about ${requiredGrossTarget.toLocaleString('en-US', { maximumFractionDigits: 2 })} gross if that net objective is required.
              </span>
              <button type="button" aria-label="Dismiss fee warning" title="Dismiss" onClick={() => dismissNotice('feeReview')} className="-mr-1 -mt-0.5 grid size-5 shrink-0 place-items-center text-amber-300/70 hover:bg-amber-500/15 hover:text-amber-100"><X className="size-3" /></button>
            </div>
          )}
          {terminalView === 'prop' && !dismissedNotices.drawdownGuard && aggregateMaxDrawdown > 0 && (
            <div
              role="status"
              className={cn(
                'mt-2 flex gap-2 border p-2.5 text-[9px] leading-4',
                stopLossExceedsDrawdown
                  ? 'border-red-500/40 bg-red-500/[0.08] text-red-100/90'
                  : 'border-line bg-canvas text-muted'
              )}
            >
              <AlertTriangle className={cn('mt-0.5 size-3.5 shrink-0', stopLossExceedsDrawdown ? 'text-red-300' : 'text-amber-400')} />
              <span className="min-w-0 flex-1">
                <b className={cn('font-semibold', stopLossExceedsDrawdown ? 'text-red-200' : 'text-slate-300')}>Fee-aware drawdown guard.</b>{' '}
                ${aggregateMaxDrawdown.toLocaleString('en-US', { maximumFractionDigits: 2 })} maximum drawdown − ${roundTripPropFees.toLocaleString('en-US', { maximumFractionDigits: 2 })} estimated round-trip prop fees for {aggregatePropQuantity} {instrument} contract{aggregatePropQuantity === 1 ? '' : 's'} = ${maxGrossStopLoss.toLocaleString('en-US', { maximumFractionDigits: 2 })} maximum market stop. Your current stop is ${paLossAtFailure.toLocaleString('en-US', { maximumFractionDigits: 2 })} market loss + ${roundTripPropFees.toLocaleString('en-US', { maximumFractionDigits: 2 })} fees = ${stopLossTotalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })} total drawdown.
                {stopLossExceedsDrawdown ? ' It cannot be armed until the stop is reduced.' : ''}
              </span>
              <button type="button" aria-label="Dismiss drawdown guard" title="Dismiss" onClick={() => dismissNotice('drawdownGuard')} className={cn('-mr-1 -mt-0.5 grid size-5 shrink-0 place-items-center hover:bg-white/10', stopLossExceedsDrawdown ? 'text-red-300/70 hover:text-red-100' : 'text-slate-400 hover:text-slate-100')}><X className="size-3" /></button>
            </div>
          )}
          <div>
            <label className="field-label">
              {terminalView === 'prop' ? 'MNQ contracts per prop account' : 'Live hedge exposure · MNQ equivalent'}
            </label>
            <div className="flex">
              {terminalView === 'prop' ? <EditableNumberInput
                ariaLabel="Prop quantity per account"
                integer
                value={quantity}
                onValueChange={updateDisplayedQuantity}
                onEdit={disarmForEdit}
                className="field-input min-w-0 flex-1 border-r-0 font-mono"
              /> : <EditableNumberInput
                ariaLabel="Hedge size in MNQ equivalents"
                value={hedgeMnqEquivalent}
                onValueChange={updateHedgeMnqEquivalent}
                onEdit={disarmForEdit}
                readOnly={exitInputMode === 'price'}
                className="field-input min-w-0 flex-1 border-r-0 font-mono"
              />}
              <span className="grid h-9 w-16 place-items-center border border-line bg-canvas px-1 font-mono text-[9px] text-slate-500">
                {terminalView === 'hedge' ? 'MNQ-eq' : 'MNQ'}
              </span>
            </div>
            {terminalView === 'hedge' && <p className="mt-1 text-[9px] text-muted">{effectiveHedgeRatio.toFixed(1)}% effective hedge · {hedgeMix.label || '0 contracts'} · {hedgeMix.resultingDollarsPerPoint.toFixed(2)} live $/point</p>}
            {terminalView === 'hedge' && <p className="mt-1 text-[9px] text-muted">Changing hedge values adjusts hedge ratio and contracts only; prop entry, target, and stop stay fixed.</p>}
            {contractLimitExceeded && !dismissedNotices.contractLimit && <div role="alert" className="mt-2 flex gap-2 border border-amber-500/40 bg-amber-500/[0.08] p-2 text-[10px] leading-4 text-amber-200"><AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-400"/><span className="min-w-0 flex-1"><b className="font-semibold">Order blocked.</b> {contractLimitMessage} Change the size or disable the provider contract-limit guard in Settings only if the provider has changed its rules.</span><button type="button" aria-label="Dismiss contract-limit warning" title="Dismiss" onClick={() => dismissNotice('contractLimit')} className="-mr-1 -mt-0.5 grid size-5 shrink-0 place-items-center text-amber-300/70 hover:bg-amber-500/15 hover:text-amber-100"><X className="size-3" /></button></div>}
            {!contractLimitExceeded && contractLimitGuardEnabled && terminalView === 'prop' && contractLimit && <p className="mt-1 text-[9px] text-muted">Provider limit: {contractLimit.maxContracts} MNQ prop contracts per account · {contractLimit.phase}{contractLimit.tierProfit !== null ? ` tier from $${contractLimit.tierProfit.toLocaleString()} closed profit` : ''}</p>}
            {accountQuantity > 1 && (
              <div className="mt-1 font-mono text-[8px] text-blue-300">
                {quantity} × {accountQuantity} accounts = {aggregatePropQuantity} aggregate prop
                contracts
              </div>
            )}
          </div>
        </div>

        {sectionHeading('hedge', 'Hedge settings', `${hedgeMode} · ${effectiveHedgeRatio.toFixed(1)}% · ${hedgeMix.label}`)}
        <div id="ticket-hedge" className="ticket-section-body" hidden={ticketSection !== 'hedge'}>
        <label className="field-label">Hedge mode</label>
        <div className="mb-3 grid grid-cols-2 border border-line">
          {(['auto', 'manual'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setHedgeMode(item)}
              className={cn(
                'h-8 text-[10px] font-semibold uppercase',
                hedgeMode === item ? 'bg-blue-400/10 text-blue-300' : 'text-muted hover:bg-raised',
                item === 'manual' && 'border-l border-line'
              )}
            >
              {item}
            </button>
          ))}
        </div>
        {hedgeMode === 'manual' && (
          <div className="mb-3">
            <label className="field-label">Hedge ratio</label>
            <div className="flex">
              <EditableNumberInput
                ariaLabel="Hedge ratio"
                value={manualRatio}
                onValueChange={updateNumber(setManualRatio)}
                onEdit={disarmForEdit}
                className="field-input min-w-0 flex-1 border-r-0 font-mono"
              />
              <span className="grid h-9 w-10 place-items-center border border-line bg-canvas font-mono text-[10px] text-slate-500">
                %
              </span>
            </div>
          </div>
        )}
        {hedgeMode === 'auto' && (
          <div className="hedge-recovery-fields mb-3 grid grid-cols-3 gap-2">
            <div>
              <label className="field-label">Required recovery</label>
              <div className="flex">
                <span className="grid h-9 w-7 shrink-0 place-items-center border border-r-0 border-line bg-canvas font-mono text-[10px] text-slate-500">
                  $
                </span>
                <EditableNumberInput
                  ariaLabel="Required recovery in dollars"
                  value={requiredRecovery}
                onValueChange={(value) => {
                  recoveryCustomizedRef.current = true;
                  updateNumber(setRequiredRecovery)(value);
                }}
                  className="field-input min-w-0 flex-1 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="field-label">Friction allowance</label>
              <EditableNumberInput
                ariaLabel="Friction allowance"
                value={frictionAllowance}
                onValueChange={setFrictionAllowance}
                className="field-input font-mono"
              />
            </div>
            <div>
              <label className="field-label">Failure profit</label>
              <div className="flex">
                <span className="grid h-9 w-7 shrink-0 place-items-center border border-r-0 border-line bg-canvas font-mono text-[10px] text-slate-500">
                  $
                </span>
                <EditableNumberInput
                  ariaLabel="Desired failure profit in dollars"
                  value={desiredFailureProfit}
                  onValueChange={setDesiredFailureProfit}
                  className="field-input min-w-0 flex-1 font-mono"
                />
              </div>
            </div>
          </div>
        )}
        <div className="border border-line bg-canvas p-3">
          <Metric
            label={hedgeMode === 'auto' ? 'Required hedge ratio' : 'Requested hedge ratio'}
            value={`${ratioPercent.toFixed(1)}%`}
          />
          {hedgeMode === 'auto' && (
            <Metric
              label="PA loss at failure"
              value={`$${paLossAtFailure.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
            />
          )}
          <Metric
            label="Executable hedge"
            value={hedgeMix.label}
          />
          <Metric label="Effective hedge ratio" value={`${effectiveHedgeRatio.toFixed(1)}%`} />
          <Metric label="Suggested prop MNQ qty" value={`${suggestedPropMNQQuantity} (adjustable)`} />
          <Metric label="Target live exposure" value={`$${hedgeMix.targetDollarsPerPoint.toFixed(2)}/pt`} />
          <Metric label="Executable live exposure" value={`$${hedgeMix.resultingDollarsPerPoint.toFixed(2)}/pt`} />
          <Metric label="Hedge rounding error" value={`${hedgeMix.roundingErrorDollarsPerPoint >= 0 ? '+' : ''}$${hedgeMix.roundingErrorDollarsPerPoint.toFixed(2)}/pt`} tone={hedgeMix.roundingErrorDollarsPerPoint === 0 ? 'neutral' : 'negative'} />
          <Metric label="Estimated fees" value={`Prop $${propFees.toFixed(2)} · Live $${hedgeFees.toFixed(2)}`} />
          {hedgeMode === 'auto' && <><Metric label="Effective market downside" value={`$${effectiveMarketDownside.toFixed(2)}`} /><Metric label="Live recovery requirement" value={`$${baseRecoveryRequirement.toFixed(2)}`} /></>}
          <Metric label="Hedge direction" value={direction === 'long' ? 'SHORT' : 'LONG'} />
          {hedgeMix.nnq > 0 && (
            <div className="mt-2 border-t border-line pt-2 text-[9px] leading-4 text-amber-300/80">
              MNQ is $2/point and NNQ is $0.20/point per contract. Both live legs are held until an actual MNQ fill, then submitted together as marketable limits using fresh Ironbeam quotes.
            </div>
          )}
          {instrument === 'MBT' && requestedHedgeQuantity > 0 && requestedHedgeQuantity < 1 && (
            <div className="mt-2 border-t border-line pt-2 text-[9px] leading-4 text-amber-300/80">
              The requested ratio equals {requestedHedgeQuantity.toFixed(2)} MBT. MBT trades in
              whole contracts, so Hedge OS uses the minimum executable quantity of 1 MBT.
            </div>
          )}
        </div>

        </div>
        {sectionHeading('outcomes', 'Projected outcomes', `TP ${money(netPaTp + netHedgeAtTp)} · Recovery ${money(netHedgeAtSl)}`)}
        <div id="ticket-outcomes" className="ticket-section-body" hidden={ticketSection !== 'outcomes'}>
        <div className="mb-2 border border-line bg-canvas p-2 text-[9px] text-muted">
          Net target ${netPaTp.toFixed(2)} · required gross ${grossForNetTarget(Math.max(0, netPaTp),aggregatePropQuantity,instrument).toFixed(2)} · Tradovate round-trip fee ${propFees.toFixed(2)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="border border-line bg-canvas p-2.5">
            <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-positive">
              PA TP
            </div>
            <Metric
              label="PA net of fees"
              value={money(netPaTp)}
              tone={netPaTp >= 0 ? 'positive' : 'negative'}
            />
            <Metric
              label="Hedge"
              value={money(netHedgeAtTp)}
              tone={netHedgeAtTp >= 0 ? 'positive' : 'negative'}
            />
            <div className="mt-2 border-t border-line pt-1">
              <Metric
                label="Combined"
                value={money(netPaTp + netHedgeAtTp)}
                tone={netPaTp + netHedgeAtTp >= 0 ? 'positive' : 'negative'}
              />
            </div>
          </div>
          <div className="border border-line bg-canvas p-2.5">
            <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-negative">
              PA SL
            </div>
            <Metric label="PA net of fees" value={money(netPaSl)} tone="negative" />
            <Metric
              label="Hedge real"
              value={money(netHedgeAtSl)}
              tone={netHedgeAtSl >= 0 ? 'positive' : 'negative'}
            />
            <div className="mt-2 border-t border-line pt-1">
              <Metric
                label="Recovery"
                value={money(netHedgeAtSl)}
                tone={netHedgeAtSl >= 0 ? 'positive' : 'negative'}
              />
            </div>
          </div>
        </div>

        </div>
      </div>
      <div className="ticket-actions">
        <Button className="h-10 w-full" variant="primary" disabled={bridgeSending || orderLocked} onClick={confirmTicketLimit}>
          {bridgeSending
            ? 'SENDING PROP + HEDGE…'
            : limitStatus === 'modifying'
            ? 'CONFIRM LIMIT MOVE'
            : limitStatus === 'confirmed'
              ? 'PAIR ARMED'
              : 'ARM PAIR'}
        </Button>
        {limitStatus === 'confirmed' && (
          <Button className="mt-2 w-full" variant="ghost" disabled={bridgeSending} onClick={cancelTicketOrder}>
            {bridgeSending ? 'CANCELLING & FLATTENING…' : 'CANCEL ALL & FLATTEN'}
          </Button>
        )}
        {armError && (
          <div
            role="alert"
            className="mt-2 flex items-start gap-2 border border-rose-500/30 bg-rose-500/10 p-2 text-[10px] leading-4 text-rose-300"
          >
            <span className="min-w-0 flex-1">{armError}</span>
            <button
              type="button"
              aria-label="Dismiss warning"
              title="Dismiss"
              onClick={() => setArmError('')}
              className="grid size-5 shrink-0 place-items-center text-rose-300/70 hover:bg-rose-500/15 hover:text-rose-100"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
        {limitStatus === 'modifying' && (
          <Button className="mt-2 w-full" variant="ghost" onClick={cancelTicketMove}>
            Cancel limit move
          </Button>
        )}
        <div className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">
          Limit order only
        </div>
        <div className="mt-3 flex items-start gap-2 border border-amber-500/20 bg-amber-500/[0.05] p-2.5">
          <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
          <p className="text-[10px] leading-4 text-amber-200/70">
            Arming stages the matched MNQ bracket on Ironbeam, then sends the prop bracket to
            TradingView. NNQ is released only after the MNQ fill is confirmed.
          </p>
        </div>
      </div>
    </aside>
  );
}

function ExecutionPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [fullTimelineOpen, setFullTimelineOpen] = useState(false);
  const [executionHistoryOpen, setExecutionHistoryOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [selectedTimelinePhase, setSelectedTimelinePhase] = useState<'Evaluation' | 'Performance account' | 'Post-payout'>('Performance account');
  const [engineSession, setEngineSession] = useState<EngineSession | null>(null);
  const [engineLoadError, setEngineLoadError] = useState<string | null>(null);
  const [liveBridge, setLiveBridge] = useState<TradingViewBridgeState>({ relayConnected: false, extensionConnected: false, tradingViewReady: false, tradingViewSymbol: null, lastMessage: 'Bridge disconnected' });
  useEffect(() => subscribeTradingViewBridge(setLiveBridge), []);
  useEffect(() => {
    if (liveBridge.ironbeamReady) void loadIronbeamExecutionAudit().catch(() => {});
  }, [liveBridge.ironbeamReady]);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      void loadEngineSession()
        .then((session) => {
          if (!live) return;
          setEngineSession(session);
          setEngineLoadError(null);
        })
        .catch((error: unknown) => {
          if (!live) return;
          setEngineLoadError(error instanceof Error ? error.message : 'Could not load engine session.');
        });
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('hedge-os:campaign-engine-updated', refresh);
    return () => {
      live = false;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('hedge-os:campaign-engine-updated', refresh);
    };
  }, []);
  const campaigns = useAppStore((state) => state.campaigns);
  const activeCampaignId = useAppStore((state) => state.activeCampaignId);
  const autoHedgeRatio = useAppStore((state) => state.autoHedgeRatio);
  const propQuantity = useAppStore((state) => state.propQuantity);
  const instrument = useAppStore((state) => state.tradingInstrument);
  const entry = useAppStore((state) => state.entryPrice);
  const stopLoss = useAppStore((state) => state.stopLoss);
  const frictionAllowance = useAppStore((state) => state.hedgeFrictionAllowance);
  const desiredFailureProfit = useAppStore((state) => state.hedgeDesiredFailureProfit);
  const limitOrderStatus = useAppStore((state) => state.limitOrderStatus);
  const setRoadmapStage = useAppStore((state) => state.setCampaignRoadmapStage);
  const setRoadmapStep = useAppStore((state) => state.setCampaignRoadmapStep);
  const resetPostPayoutCycle = useAppStore((state) => state.resetPostPayoutCycle);
  const campaign = campaigns.find((item) => item.id === activeCampaignId) ?? campaigns[0];
  const accountQuantity = Math.max(1, campaign?.accountQuantity ?? 1);
  const aggregatePropQuantity = propQuantity * accountQuantity;
  const lockedPayoutRatio = campaign ? getOptimalPayoutHedgeRatio(campaign) : 46;
  const plan = getOptimalTradePlan(campaign);
  const enginePlan = useMemo(() => {
    if (!engineSession) return null;
    try {
      const stateKey = JSON.stringify({
        state: engineSession.state,
        rules: engineSession.rules,
        options: engineSession.options,
      });
      return engineSession.selectedPlan?.stateKey === stateKey
        ? previewAlternative(
            engineSession.state,
            engineSession.rules,
            engineSession.options,
            engineSession.selectedPlan.action
          )
        : optimizeCampaign(engineSession.state, engineSession.rules, engineSession.options);
    } catch {
      return null;
    }
  }, [engineSession]);
  const engineSteps = enginePlan?.projectedPath ?? [];
  const engineObjective = enginePlan?.nextAction ?? null;
  const enginePhase = engineSession?.state.phase.replaceAll('_', ' ') ?? null;
  const formatEngineMoney = (value: number) =>
    `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const chronologicalTimeline = campaign
    ? [
        getOptimalTradePlan(campaign, 'evaluation'),
        getOptimalTradePlan(campaign, 'performance'),
        getOptimalTradePlan(campaign, 'post-payout'),
      ].filter(Boolean)
    : [];
  const stage =
    campaign?.roadmapStage ??
    (/evaluation/i.test(campaign?.phases[campaign.currentPhase]?.name ?? '')
      ? 'evaluation'
      : 'performance');
  const phaseOrder =
    stage === 'evaluation'
      ? ['Evaluation', 'Performance account', 'Post-payout']
      : stage === 'performance'
        ? ['Performance account', 'Post-payout', 'Evaluation']
        : ['Post-payout', 'Evaluation', 'Performance account'];
  const fullTimeline = phaseOrder
    .map((name) => chronologicalTimeline.find((phase) => phase!.phase === name))
    .filter(Boolean);
  const selectedTimelinePlan = chronologicalTimeline.find((phase) => phase!.phase === selectedTimelinePhase) ?? fullTimeline[0];
  const money = (value: number | null) =>
    value === null ? '—' : `+$${value.toLocaleString('en-US')}`;
  const currentFailureLoss = campaign
    ? campaign.performanceRules.maxDrawdown * accountQuantity
    : Math.abs((stopLoss - entry) * contractSpecs[instrument].pointValue * aggregatePropQuantity);
  const fullSteps = chronologicalTimeline.flatMap((phase) => phase!.steps);
  const outcomes = projectRoadmapOutcomes(
    fullSteps,
    campaign?.evaluationSpend ?? 0,
    frictionAllowance,
    desiredFailureProfit,
    currentFailureLoss,
    aggregatePropQuantity,
    instrument,
    (campaign?.performanceRules.activationFee ?? 0) * accountQuantity,
    accountQuantity,
    campaign ? getOptimalPayoutHedgeRatio(campaign) : 46
  );
  const evaluationStepCount = chronologicalTimeline[0]?.steps.length ?? 0;
  const performanceStepCount = chronologicalTimeline[1]?.steps.length ?? 0;
  const phaseOffset = (phaseName: string) =>
    phaseName === 'Evaluation'
      ? 0
      : phaseName === 'Performance account'
        ? evaluationStepCount
        : evaluationStepCount + performanceStepCount;
  const currentIndex =
    phaseOffset(plan?.phase ?? 'Evaluation') +
    Math.max(0, plan?.steps.indexOf(plan.objective) ?? 0);
  const currentOutcome = outcomes[currentIndex] ?? null;
  const lastFill = liveBridge.ironbeamLastFill;
  const fillStatus = typeof lastFill?.status === 'string' ? lastFill.status.replaceAll('_', ' ') : null;
  const fillQuantity = typeof lastFill?.filledQuantity === 'number' ? lastFill.filledQuantity : null;
  const fillPrice = typeof lastFill?.averageFillPrice === 'number' ? lastFill.averageFillPrice : null;
  const fillSymbol = typeof lastFill?.symbol === 'string' ? lastFill.symbol : null;
  const fillObservedAt = typeof lastFill?.observedAt === 'number' ? lastFill.observedAt : null;
  const hedgeLifecycle = liveBridge.ironbeamLastEvent?.type === 'prop_hedge'
    ? String(liveBridge.ironbeamLastEvent.status ?? '')
    : null;
  const safetyClosed = ['EMERGENCY_FLATTEN_STARTED', 'EMERGENCY_FLATTEN_COMPLETED', 'PROP_FLATTEN_FAILED'].includes(hedgeLifecycle ?? '');
  const executionTrace = liveBridge.ironbeamExecutionTrace;
  const executionHistory = liveBridge.ironbeamExecutionHistory ?? [];
  const traceProp = executionTrace?.prop as Record<string, Record<string, unknown>> | undefined;
  const traceLegs = executionTrace?.legs as Record<string, Record<string, unknown>> | undefined;
  const traceAt = (node: Record<string, unknown> | undefined) => typeof node?.at === 'number' ? node.at : null;
  const elapsed = (from: number | null, to: number | null) => from !== null && to !== null ? `${Math.max(0, to - from)}ms` : 'pending';
  const tracePrice = (value: unknown) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0
      ? number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : 'unavailable';
  };
  const receiptSummary = (receipt: Record<string, unknown>) => {
    const type = String(receipt.type ?? 'event');
    if (type === 'execution_audit') {
      const action=String(receipt.action ?? 'broker event').replaceAll('_', ' ');
      const category=String(receipt.category ?? 'audit').replaceAll('_', ' ');
      const reason=typeof receipt.error === 'string' ? ` · ${receipt.error}` : '';
      const strategy=typeof receipt.strategyId === 'number' ? ` · strategy ${receipt.strategyId}` : '';
      const order=typeof receipt.side === 'string'
        ? ` · ${receipt.side} ${typeof receipt.quantity === 'number' ? receipt.quantity : ''} ${typeof receipt.orderType === 'string' ? receipt.orderType : ''}`.replace(/\s+/g, ' ').trimEnd()
        : '';
      const price=typeof receipt.averageFillPrice === 'number'
        ? ` @ ${tracePrice(receipt.averageFillPrice)}`
        : typeof receipt.stopPrice === 'number' ? ` stop ${tracePrice(receipt.stopPrice)}` : typeof receipt.limitPrice === 'number' ? ` limit ${tracePrice(receipt.limitPrice)}` : '';
      const fill=typeof receipt.filledQuantity === 'number' ? ` · filled ${receipt.filledQuantity}` : '';
      return `${category}: ${action}${strategy}${order}${price}${fill}${reason}`;
    }
    if (type === 'order_fill') {
      const quantity = typeof receipt.filledQuantity === 'number' ? ` · ${receipt.filledQuantity}` : '';
      const symbol = typeof receipt.symbol === 'string' ? ` ${receipt.symbol}` : '';
      const price = typeof receipt.averageFillPrice === 'number' ? ` @ ${tracePrice(receipt.averageFillPrice)}` : '';
      return `Fill${quantity}${symbol}${price}`;
    }
    if (type === 'execution_trace') return `Trace · ${String(receipt.phase ?? 'updated').replaceAll('_', ' ')}`;
    const status = typeof receipt.status === 'string' ? receipt.status.replaceAll('_', ' ') : type.replaceAll('_', ' ');
    const reason = typeof receipt.reason === 'string' ? ` · ${receipt.reason.replaceAll('_', ' ')}` : '';
    return `${status}${reason}`;
  };
  const completePhase = (phaseName: string) => {
    if (!campaign) return;
    if (phaseName === 'Evaluation') setRoadmapStage(campaign.id, 'performance');
    else if (phaseName === 'Performance account') setRoadmapStage(campaign.id, 'post-payout');
    else resetPostPayoutCycle(campaign.id);
  };
  const completeThroughStep = (phaseName: string, index: number, stepCount: number) => {
    if (!campaign) return;
    const selectedStage =
      phaseName === 'Evaluation'
        ? 'evaluation'
        : phaseName === 'Performance account'
          ? 'performance'
          : 'post-payout';
    setRoadmapStep(campaign.id, selectedStage, index + 1);
    if (index + 1 >= stepCount) completePhase(phaseName);
    else if (stage !== selectedStage) setRoadmapStage(campaign.id, selectedStage);
  };
  return (
    <>
      <section
        className={cn(
          'shrink-0 border-t border-line bg-surface transition-[height] duration-150',
          collapsed ? 'h-9' : 'h-[184px]'
        )}
      >
        <div className="flex h-9 items-center justify-between border-b border-line px-3">
          <div className="flex items-center gap-2">
            <Link2 className="size-3.5 text-accent" />
            <span className="section-kicker">Execution & plan</span>
            <span className="border border-line bg-canvas px-2 py-0.5 font-mono text-[9px] text-slate-500">
              {limitOrderStatus === "confirmed"
                ? "WORKING"
                : limitOrderStatus === "modifying"
                  ? "MODIFYING"
                  : "IDLE"}
            </span>
            {safetyClosed ? (
              <span title={liveBridge.lastMessage} className="border border-rose-400/35 bg-rose-400/10 px-2 py-0.5 font-mono text-[9px] text-rose-300">
                SAFETY CLOSED
              </span>
            ) : fillStatus && (
              <span title="Broker-confirmed Ironbeam fill receipt" className="border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] text-emerald-300">
                HEDGE {fillStatus}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {campaign && <IconButton label="Open campaign journal" onClick={()=>setJournalOpen(true)}><CalendarDays className="size-3.5" /></IconButton>}
            <IconButton
              label={collapsed ? 'Expand execution panel' : 'Collapse execution panel'}
              onClick={onToggle}
            >
              {collapsed ? (
                <PanelBottomOpen className="size-3.5" />
              ) : (
                <PanelBottomClose className="size-3.5" />
              )}
            </IconButton>
          </div>
        </div>
        {!collapsed && (
          <div className="grid h-[145px] grid-cols-1">
            <div className="overflow-hidden p-3">
              <div className="flex items-center justify-between">
                <div className="section-kicker">Optimal trade timeline</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-blue-300">{enginePhase ?? 'ENGINE NOT LOADED'}</span>
                  <IconButton label="Open execution history" onClick={() => setExecutionHistoryOpen(true)}>
                    <Clock3 className="size-3.5" />
                  </IconButton>
                  {enginePlan && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTimelinePhase(stage === 'evaluation' ? 'Evaluation' : stage === 'post-payout' ? 'Post-payout' : 'Performance account');
                        setFullTimelineOpen(true);
                      }}
                      className="border border-blue-400/30 px-2 py-1 text-[8px] font-semibold uppercase tracking-wider text-blue-300 hover:bg-blue-400/10"
                    >
                      See full timeline
                    </button>
                  )}
                </div>
              </div>
              {safetyClosed ? (
                <div className="mt-2 border border-rose-400/30 bg-rose-400/[0.07] px-2 py-1 font-mono text-[9px] text-rose-200">
                  <span className="font-semibold">Safety close log · </span>{liveBridge.lastMessage}
                </div>
              ) : null}
              {enginePlan && engineObjective && (
                <div className="mt-2 grid grid-cols-[148px_1fr] gap-3">
                  <div>
                    <div className="text-[8px] uppercase tracking-wider text-slate-600">
                      Next objective
                    </div>
                    <div className="mt-1 font-mono text-base font-semibold text-emerald-300">
                      +{formatEngineMoney(engineObjective.targetProfit)}
                    </div>
                    <div className="mt-1 font-mono text-[8px] text-slate-500">
                        Win: hedge -{formatEngineMoney(engineObjective.targetProfit * engineObjective.hedgeRatioConfigured)}
                        <br />
                        Loss: hedge +{formatEngineMoney(engineObjective.stopLoss * engineObjective.hedgeRatioConfigured)}
                    </div>
                    <div className="mt-1 text-[8px] text-slate-500">
                      Purpose <span className="ml-1 text-blue-300">{engineObjective.purpose.replaceAll('_', ' ')}</span>
                    </div>
                  </div>
                  <div className="grid content-start grid-cols-2 gap-x-3 gap-y-1">
                    {engineSteps.slice(0, 6).map((step, index) => (
                      <div
                        key={`${index}-${step.action.targetProfit}`}
                        className={cn(
                          'flex min-w-0 items-center gap-1.5 text-[8px]',
                          index === 0 ? 'text-slate-100' : 'text-slate-600'
                        )}
                      >
                        {index === 0 ? (
                          <CircleDot className="size-2.5 shrink-0 text-blue-400" />
                        ) : (
                          <Circle className="size-2.5 shrink-0" />
                        )}
                        <span className="truncate">Day {engineSession!.state.currentDayNumber + index}</span>
                        <span className="ml-auto font-mono">+{formatEngineMoney(step.action.targetProfit)}</span>
                      </div>
                    ))}
                    {enginePlan.metrics.projectedPayout > 0 && engineSteps.length < 6 && (
                      <div className="flex min-w-0 items-center gap-1.5 text-[8px] text-emerald-400">
                        <Check className="size-2.5 shrink-0" />
                        <span>Payout</span>
                        <span className="ml-auto font-mono">+{formatEngineMoney(enginePlan.metrics.projectedPayout)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {!enginePlan && (
                <div className="mt-5 flex items-start gap-2 text-[9px] text-amber-300">
                  <span className="min-w-0 flex-1">{engineLoadError ?? 'Save or update a workspace in Campaign Engine to load its timeline.'}</span>
                  {engineLoadError && <button type="button" aria-label="Dismiss campaign engine error" title="Dismiss" onClick={() => setEngineLoadError(null)} className="-mt-0.5 grid size-5 shrink-0 place-items-center text-amber-300/70 hover:bg-amber-500/15 hover:text-amber-100"><X className="size-3" /></button>}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 text-[8px] text-slate-600">
                <ShieldCheck className="size-3" />
                {engineObjective
                  ? `${(engineObjective.hedgeRatioConfigured * 100).toFixed(2)}% configured engine hedge · ${(engineObjective.hedgeRatioEquilibrium * 100).toFixed(2)}% equilibrium`
                  : 'Waiting for an active engine recommendation'}
              </div>
            </div>
          </div>
        )}
      </section>
      {journalOpen&&campaign&&<CampaignJournalModal campaign={campaign} onClose={()=>setJournalOpen(false)} />}
      {executionHistoryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Execution history"
          className="fixed inset-0 z-[110] grid place-items-center bg-black/70 p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setExecutionHistoryOpen(false);
          }}
        >
          <div className="w-full max-w-4xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <div className="section-kicker">Execution receipts</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">Ironbeam execution history</div>
              </div>
              <IconButton label="Close execution history" onClick={() => setExecutionHistoryOpen(false)}>
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              {fillStatus && (
                <div className="flex items-center justify-between border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 font-mono text-[10px] text-emerald-200">
                  <span>Latest broker receipt · {fillStatus}{fillQuantity !== null ? ` · ${fillQuantity} ${fillSymbol ?? ''}` : ''}{fillPrice !== null ? ` @ ${tracePrice(fillPrice)}` : ''}</span>
                  {fillObservedAt && <span className="text-emerald-300/70">{new Date(fillObservedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
                </div>
              )}
              {executionTrace && (
                <div className="mt-3 border border-blue-400/20 bg-blue-400/[0.05] px-3 py-2 font-mono text-[10px] leading-5 text-blue-100">
                  <div className="font-semibold text-blue-200">Latest prop-to-hedge trace</div>
                  <div>MNQ observed {tracePrice(traceProp?.t0?.averageFillPrice)} → extension {elapsed(traceAt(traceProp?.t0), traceAt(traceProp?.t1))}</div>
                  {['MNQ', 'NNQ'].map((root) => {
                    const leg = traceLegs?.[root];
                    const quote = leg?.quoteUsed as Record<string, unknown> | undefined;
                    const fill = leg?.t4 as Record<string, unknown> | undefined;
                    return <div key={root}>{root} · sent {tracePrice(leg?.limitPrice)} (BBO {tracePrice(quote?.bid)}/{tracePrice(quote?.ask)}) · fill {tracePrice(fill?.averageFillPrice)} · extension → send {elapsed(traceAt(traceProp?.t1), traceAt(leg?.t2 as Record<string, unknown> | undefined))} · send → ack {elapsed(traceAt(leg?.t2 as Record<string, unknown> | undefined), traceAt(leg?.t3 as Record<string, unknown> | undefined))} · send → receipt {elapsed(traceAt(leg?.t2 as Record<string, unknown> | undefined), traceAt(fill))}</div>;
                  })}
                </div>
              )}
              <div className="mt-4 section-kicker">Session event stream</div>
              {executionHistory.length ? (
                <div className="mt-2 divide-y divide-line border border-line">
                  {executionHistory.map((receipt, index) => {
                    const timestamp = typeof receipt.observedAt === 'number' ? receipt.observedAt : typeof receipt.receivedAt === 'number' ? receipt.receivedAt : null;
                    return (
                      <div key={`${String(receipt.type)}-${String(receipt.status)}-${String(receipt.phase)}-${String(receipt.observedAt)}-${index}`} className="flex items-center justify-between gap-4 px-3 py-2 font-mono text-[10px]">
                        <span className="min-w-0 truncate text-slate-200">{receiptSummary(receipt)}</span>
                        <span className="shrink-0 text-slate-500">{timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 border border-dashed border-line px-3 py-5 text-center text-[10px] text-slate-500">No execution receipts have arrived in this app session yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {fullTimelineOpen && engineSession && enginePlan && false && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full optimal trade timeline"
          className="campaign-roadmap-overlay fixed inset-0 z-[100] grid place-items-center bg-black/70 p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFullTimelineOpen(false);
          }}
        >
          <div className="w-full max-w-4xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <div className="section-kicker">Campaign engine timeline</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">
                  {engineSession!.workspaceTitle ?? engineSession!.rules.accountName}
                </div>
                <div className="mt-1 font-mono text-[9px] text-blue-300">
                  {enginePhase} · Balance {formatEngineMoney(engineSession!.state.balance)}
                </div>
              </div>
              <IconButton label="Close full timeline" onClick={() => setFullTimelineOpen(false)}>
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              {engineSteps.length === 0 ? (
                <div className="border border-line bg-canvas p-5 text-sm text-slate-400">
                  The engine has no additional trade days on this path.
                </div>
              ) : (
                <div className="border border-line bg-canvas">
                  {engineSteps.map((step, index) => {
                    const ratio = step.action.hedgeRatio;
                    const trailLocked = !step.state.trailLocked && step.nextState.trailLocked;
                    const passedEval = step.state.phase === 'EVALUATION' && step.nextState.phase !== 'EVALUATION';
                    return (
                      <div key={`${index}-${step.action.targetProfit}`} className="grid grid-cols-[72px_1fr_132px] gap-4 border-b border-line p-3 last:border-b-0">
                        <div>
                          <div className="font-mono text-[10px] text-blue-300">DAY {step.state.currentDayNumber}</div>
                          <div className="mt-1 text-[8px] uppercase tracking-wider text-slate-600">{step.state.phase.replaceAll('_', ' ')}</div>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="font-mono text-[11px] font-semibold text-emerald-300">Prop +{formatEngineMoney(step.action.targetProfit)}</span>
                            <span className="font-mono text-[9px] text-rose-300">Stop -{formatEngineMoney(step.action.stopLoss)}</span>
                            <span className="font-mono text-[9px] text-slate-400">Hedge {(ratio * 100).toFixed(2)}%</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[8px]">
                            <span className="text-rose-300">Prop wins → hedge -{formatEngineMoney(step.action.targetProfit * ratio)}</span>
                            <span className="text-emerald-300">Prop loses → hedge +{formatEngineMoney(step.action.stopLoss * ratio)}</span>
                          </div>
                          <div className="mt-2 text-[8px] uppercase tracking-wider text-slate-500">
                            {step.action.purpose.replaceAll('_', ' ')}
                            {trailLocked && <span className="ml-2 text-emerald-300">· Trail locked</span>}
                            {passedEval && <span className="ml-2 text-emerald-300">· Evaluation passed</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] uppercase tracking-wider text-slate-600">Resulting balance</div>
                          <div className="mt-1 font-mono text-[11px] text-slate-200">{formatEngineMoney(step.nextState.balance)}</div>
                          <div className="mt-2 text-[8px] text-slate-500">MLL {formatEngineMoney(step.nextState.currentMllFloor)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {enginePlan!.metrics.projectedPayout > 0 && (
                    <div className="flex items-center justify-between bg-emerald-400/[0.06] p-3">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        <Check className="size-3" /> Projected net payout
                      </div>
                      <div className="font-mono text-sm font-semibold text-emerald-300">+{formatEngineMoney(enginePlan!.metrics.projectedPayout)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="border-t border-line px-4 py-3 text-[9px] leading-4 text-slate-500">
              This is the active Campaign Engine path. Targets, stops, qualifying-day rules, consistency, payout conversion and profit split are calculated by the same saved engine state; changing or selecting a path in Campaign Engine refreshes this timeline.
            </div>
          </div>
        </div>
      )}
      {fullTimelineOpen && campaign && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full optimal trade timeline"
          className="campaign-roadmap-overlay fixed inset-0 z-[100] grid place-items-center bg-black/70 p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFullTimelineOpen(false);
          }}
        >
          <div className="campaign-roadmap-modal w-full max-w-3xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <div className="section-kicker">Campaign roadmap</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">{campaign.name}</div>
              </div>
              <IconButton label="Close full timeline" onClick={() => setFullTimelineOpen(false)}>
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="flex gap-2 border-b border-line px-4 py-3" role="tablist" aria-label="Timeline phase">
              {(['Evaluation', 'Performance account', 'Post-payout'] as const).map((phaseName) => (
                <button
                  key={phaseName}
                  type="button"
                  role="tab"
                  aria-selected={selectedTimelinePhase === phaseName}
                  onClick={() => setSelectedTimelinePhase(phaseName)}
                  className={cn(
                    'border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider transition',
                    selectedTimelinePhase === phaseName
                      ? 'border-blue-400 bg-blue-400/10 text-blue-200'
                      : 'border-line text-slate-500 hover:text-slate-200'
                  )}
                >
                  {phaseName === 'Performance account' ? 'PA / Funded' : phaseName === 'Post-payout' ? 'Payout cycle' : 'Evaluation'}
                </button>
              ))}
            </div>
            <div className="flex gap-4 overflow-x-auto p-4">
              {[selectedTimelinePlan].filter(Boolean).map((phase) => (
                <div
                  key={phase!.phase}
                  className={cn(
                    'min-w-[360px] flex-1 border bg-canvas transition-all',
                    (stage === 'performance' && phase!.phase === 'Evaluation') ||
                      (stage === 'post-payout' &&
                        (phase!.phase === 'Evaluation' || phase!.phase === 'Performance account'))
                      ? 'border-emerald-400/60 bg-emerald-400/[0.06] shadow-[0_0_24px_rgba(52,211,153,0.14)]'
                      : 'border-line'
                  )}
                >
                  <div className="flex items-center justify-between border-b border-line px-3 py-2">
                    <div className="text-[9px] uppercase tracking-[0.16em] text-blue-300">
                      {phase!.phase}
                    </div>
                    {((stage === 'evaluation' && phase!.phase === 'Evaluation') ||
                      (stage === 'performance' && phase!.phase === 'Performance account') ||
                      (stage === 'post-payout' && phase!.phase === 'Post-payout')) && (
                      <button
                        type="button"
                        onClick={() => completePhase(phase!.phase)}
                        className="border border-blue-400/30 px-2 py-1 text-[8px] font-semibold uppercase tracking-wider text-blue-300 hover:bg-blue-400/10"
                      >
                        {phase!.phase === 'Post-payout' ? 'Reset cycle' : 'Complete phase'}
                      </button>
                    )}
                  </div>
                  <div className="p-3">
                    {phase!.steps.map((step, index) => {
                      const result = outcomes[phaseOffset(phase!.phase) + index];
                      return (
                        <div
                          key={`${phase!.phase}-${step.label}`}
                          className="relative flex gap-3 pb-4 last:pb-0"
                        >
                          {index < phase!.steps.length - 1 && (
                            <span className="absolute left-[5px] top-3 h-full w-px bg-line" />
                          )}
                          <button
                            type="button"
                            aria-label={`Mark ${step.label} complete`}
                            title="Mark complete through this step"
                            onClick={() =>
                              completeThroughStep(phase!.phase, index, phase!.steps.length)
                            }
                            className={cn(
                              'relative z-10 mt-0.5 grid size-3 shrink-0 place-items-center rounded-full border bg-canvas transition hover:scale-125 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400/50',
                              step.status === 'current'
                                ? 'border-blue-400'
                                : step.status === 'complete'
                                  ? 'border-emerald-400 bg-emerald-400/10'
                                  : 'border-slate-600'
                            )}
                          >
                            {step.status === 'complete' && (
                              <Check className="size-2 text-emerald-400" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-200">
                                {step.label}
                              </span>
                              {step.target !== null && (
                                <span className="flex gap-3 font-mono text-[10px]">
                                  <span className="text-emerald-300">TP {money(step.target)}</span>
                                  {result && <span className="text-rose-300">SL -${result.failureLoss.toLocaleString('en-US')}</span>}
                                </span>
                              )}
                            </div>
                            {result && (
                              <>
                                <div className="mt-1 grid grid-cols-2 gap-x-2 font-mono text-[8px]">
                                  <span className="text-rose-300">
                                    Prop wins → Hedge -$
                                    {result.hedgeLossOnWin.toLocaleString('en-US', {
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                  <span className="text-emerald-300">
                                    Prop loses → Hedge +$
                                    {result.hedgeProfitOnLoss.toLocaleString('en-US', {
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                  <span className="text-blue-300">
                                    Combined win +$
                                    {result.combinedOnWin.toLocaleString('en-US', {
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                  <span className="text-slate-500">
                                    Ratio {result.executableRatio.toFixed(1)}%
                                  </span>
                                </div>
                                {step.type !== 'post-payout-base-hit' && (
                                  <div className="mt-1 text-[8px] text-amber-300/70">
                                    Recovery carried into this step: $
                                    {result.requiredRecovery.toLocaleString('en-US', {
                                      maximumFractionDigits: 2,
                                    })}
                                    {result.activationFeeIncluded > 0 && (
                                      <span className="ml-1 text-slate-500">
                                        · Includes $
                                        {result.activationFeeIncluded.toLocaleString('en-US', {
                                          maximumFractionDigits: 2,
                                        })}{' '}
                                        activation fee
                                      </span>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                            <div className="mt-1 flex justify-between text-[8px] text-slate-500">
                              <span>{step.purpose}</span>
                              {step.failure !== null && (
                                <span className="font-mono text-rose-300">
                                  Failure boundary: -${step.failure.toLocaleString('en-US')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-4 py-3 text-[9px] leading-4 text-slate-500">
              Evaluation hedge losses roll into the Performance Account recovery requirement. Any
              activation fee is added once the evaluation is passed, so the first PA payout recovers
              that fee with the existing basis. No-activation-fee accounts add $0. Post-payout
              cycles reset recovery to zero and use the ratio derived from the withdrawable balance
              percentage × trader payout split, plus a 1.5-point execution margin.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function TerminalPage() {
  const left = useAppStore((s) => s.terminalLeftCollapsed);
  const bottom = useAppStore((s) => s.executionPanelCollapsed);
  const toggleLeft = useAppStore((s) => s.toggleTerminalLeft);
  const toggleBottom = useAppStore((s) => s.toggleExecutionPanel);
  const campaigns = useAppStore((s) => s.campaigns);
  const hydrated = useAppStore((s) => s.campaignsHydrated);
  const [riskPromptOpen,setRiskPromptOpen]=useState(false);
  useEffect(()=>{const show=()=>setRiskPromptOpen(true);window.addEventListener('hedge-os:request-trading-risk-consent',show);return()=>window.removeEventListener('hedge-os:request-trading-risk-consent',show);},[]);
  if (hydrated && campaigns.length === 0) return <Navigate to="/campaigns" replace />;
  return (
    <div className="terminal-workspace flex h-full min-h-[640px] flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <ContextSidebar collapsed={left} onToggle={toggleLeft} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ChartWorkspace />
          <ExecutionPanel collapsed={bottom} onToggle={toggleBottom} />
        </div>
        <OrderTicket />
      </div>
      {riskPromptOpen&&<LegalDocumentDialog documentId="risk" requireConsent onClose={()=>setRiskPromptOpen(false)}/>}
    </div>
  );
}
