import {
  Banknote,
  Check,
  ChevronDown,
  Flag,
  Gauge,
  Layers3,
  Play,
  Plus,
  Receipt,
  ShieldAlert,
  Target,
  TrendingUp,
  Trash2,
  RefreshCw,
  WalletCards,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/cn';
import { campaignJournalMetrics, useAppStore, type Campaign, type CampaignCloseReason, type DrawdownType } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { estimateHedgeBalance, PROP_ACCOUNT_TYPES } from '../data/propAccountTypes';
import { minimumHedgeRequirement, sessionFromCampaign } from '../lib/campaignEngine/adapter';
import { PLANNER_PRESETS } from '../lib/campaignEngine/presets';
import { saveEngineSession } from '../lib/campaignEngine/persistence';
import { reconcileBalanceEdit } from '../lib/campaignEngine/state';
import { optimizeCampaign } from '../lib/campaignEngine/optimizer';

const money = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const percent = (value: number) => `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
const phaseLabel = (name: string) => (/evaluation/i.test(name) ? 'Evaluation' : 'PA');
const accountPlanLabel = (account: (typeof PROP_ACCOUNT_TYPES)[number]) => {
  if (account.productFamily === 'FLEX') return 'LucidFlex';
  if (account.productFamily === 'PRO') return 'LucidPro';
  if (account.productFamily === 'TRADEIFY_GROWTH_DAILY') return 'Growth Daily';
  if (account.productFamily === 'TRADEIFY_GROWTH_FLEX') return 'Growth Flex';
  return 'EOD Trail';
};
const accountVariantLabel = (account: (typeof PROP_ACCOUNT_TYPES)[number]) => {
  if (account.brand === 'Lucid Trading') return account.dailyLossLimit > 0 ? 'DLL On' : 'DLL Off';
  if (account.brand === 'Apex Trader Funding') return account.activationFee === 0 ? 'No Activation Fee' : 'Standard';
  return 'Standard rules';
};

function statusStyle(status: Campaign['status']) {
  if (status === 'active') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'passed') return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
  if (status === 'closed') return 'border-slate-600 bg-slate-800/50 text-slate-400';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
}

function CampaignCard({
  campaign,
  selected,
  active,
  onSelect,
  onOpen,
}: {
  campaign: Campaign;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const phase = campaign.phases[campaign.currentPhase];
  const journal=campaignJournalMetrics(campaign);
  const phaseProfit = Math.max(0, journal.currentBalance - campaign.accountSize);
  const progress = phase.profitTarget > 0 ? (phaseProfit / phase.profitTarget) * 100 : 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onOpen}
      title="Double-click to start trading this campaign"
      className={cn(
        'w-full border p-3 text-left transition-colors',
        selected
          ? 'border-blue-400/60 bg-blue-400/[0.08]'
          : 'border-line bg-surface hover:border-slate-600 hover:bg-raised'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-100">{campaign.name}</div>
          <div className="mt-1 truncate font-mono text-[9px] text-muted">
            {campaign.accountTypeName} · {money(campaign.accountSize)} · ×
            {campaign.accountQuantity ?? 1}
          </div>
        </div>
        <span
          className={cn(
            'border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider',
            statusStyle(campaign.status)
          )}
        >
          {campaign.status}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-[9px] text-muted">
        <span>{phaseLabel(phase.name)}</span>
        <span>{percent(progress)}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden bg-line">
        <div className="h-full bg-accent" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-[9px]">
        <span className="text-slate-400">{money(journal.currentBalance)}</span>
        {active && (
          <span className="flex items-center gap-1 text-emerald-300">
            <Check className="size-3" />
            Terminal active
          </span>
        )}
      </div>
    </button>
  );
}

function RuleMetric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Target;
}) {
  return (
    <div className="border border-line bg-canvas p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-muted" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">
          {label}
        </span>
      </div>
      <div className="mt-3 font-mono text-lg font-semibold text-slate-100">{value}</div>
      <div className="mt-1 text-[9px] text-slate-600">{detail}</div>
    </div>
  );
}


function CreateCampaign({ onClose }: { onClose: () => void }) {
  const addCampaign = useAppStore((state) => state.addCampaign);
  const providers = useMemo(() => [...new Set(PROP_ACCOUNT_TYPES.map((item) => item.brand))], []);
  const [provider, setProvider] = useState('custom');
  const [accountPlan, setAccountPlan] = useState('custom');
  const [presetBalance, setPresetBalance] = useState('50000');
  const [accountVariant, setAccountVariant] = useState('custom');
  const [name, setName] = useState('New MNQ campaign');
  const [accountQuantity, setAccountQuantity] = useState('1');
  const [accountSize, setAccountSize] = useState('50000');
  const [phaseCount, setPhaseCount] = useState('2');
  const [profitTarget, setProfitTarget] = useState('3000');
  const [maxDrawdown, setMaxDrawdown] = useState('2000');
  const [dailyLossLimit, setDailyLossLimit] = useState('1000');
  const [maxContracts, setMaxContracts] = useState('10');
  const [paMaxContracts, setPaMaxContracts] = useState('10');
  const [consistencyLimit, setConsistencyLimit] = useState('50');
  const [accountTypeId, setAccountTypeId] = useState('custom');
  const [programPrice, setProgramPrice] = useState('0');
  const [billingType, setBillingType] = useState('One-time');
  const [drawdownType, setDrawdownType] = useState<DrawdownType>('end-of-day');
  const [minTradingDays, setMinTradingDays] = useState('1');
  const [minWinningDays, setMinWinningDays] = useState('0');
  const [paDrawdown, setPaDrawdown] = useState('2000');
  const [paDrawdownType, setPaDrawdownType] = useState<DrawdownType>('end-of-day');
  const [paDailyLoss, setPaDailyLoss] = useState('1000');
  const [bufferLock, setBufferLock] = useState('2100');
  const [payoutWinningDays, setPayoutWinningDays] = useState('5');
  const [winningDayProfit, setWinningDayProfit] = useState('150');
  const [payoutConsistency, setPayoutConsistency] = useState('40');
  const [payoutCap, setPayoutCap] = useState('4000');
  const [withdrawableBalancePercent, setWithdrawableBalancePercent] = useState('50');
  const [payoutSplitPercent, setPayoutSplitPercent] = useState('90');
  const [activationFee, setActivationFee] = useState('0');
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [error, setError] = useState('');
  const field = 'field-input font-mono';
  const applyAccountType = (value: string) => {
    setAccountTypeId(value);
    const account = PROP_ACCOUNT_TYPES.find((item) => item.id === value);
    if (!account) return;
    setProvider(account.brand);
    setAccountPlan(accountPlanLabel(account));
    setPresetBalance(String(account.balance));
    setAccountVariant(accountVariantLabel(account));
    setName(`${account.brand} ${account.name}`);
    setAccountSize(String(account.balance));
    setProgramPrice(String(account.price));
    setBillingType(account.billing);
    setProfitTarget(String(account.evalTarget));
    setMaxDrawdown(String(account.evalMaxLoss));
    setDrawdownType(account.drawdownType);
    setDailyLossLimit(String(account.dailyLossLimit));
    setConsistencyLimit(String(account.consistency));
    setMaxContracts(String(account.evalMaxContracts));
    setPaMaxContracts(String(account.paMaxContracts));
    setMinTradingDays(String(account.minEvalDays));
    setMinWinningDays('0');
    setPaDrawdown(String(account.paMaxLoss));
    setBufferLock(String(account.bufferLock));
    setPaDrawdownType(account.fundedDrawdownType ?? account.drawdownType);
    setPaDailyLoss(String(account.fundedDailyLossLimit ?? 0));
    setPayoutWinningDays(String(account.minPayoutDays));
    setWinningDayProfit(String(account.minWinningProfit));
    setPayoutConsistency(String(account.payoutConsistency));
    setPayoutCap(String(account.payoutCap));
    setWithdrawableBalancePercent(String(account.withdrawableBalancePercent));
    setPayoutSplitPercent(String(account.payoutSplitPercent));
    setActivationFee(String(account.activationFee));
  };
  const applyProvider = (value: string) => {
    setProvider(value);
    if (value === 'custom') {
      setAccountTypeId('custom');
      setAccountPlan('custom');
      setAccountVariant('custom');
      return;
    }
    const first = PROP_ACCOUNT_TYPES.find((item) => item.brand === value);
    if (first) applyAccountType(first.id);
  };
  const matchingAccounts = (next: { provider?: string; plan?: string; balance?: string; variant?: string }) => {
    const wantedProvider = next.provider ?? provider;
    const wantedPlan = next.plan ?? accountPlan;
    const wantedBalance = Number(next.balance ?? presetBalance);
    const wantedVariant = next.variant ?? accountVariant;
    const rows = PROP_ACCOUNT_TYPES.filter((item) => item.brand === wantedProvider);
    return rows.find((item) => accountPlanLabel(item) === wantedPlan && item.balance === wantedBalance && accountVariantLabel(item) === wantedVariant)
      ?? rows.find((item) => accountPlanLabel(item) === wantedPlan && item.balance === wantedBalance)
      ?? rows.find((item) => accountPlanLabel(item) === wantedPlan)
      ?? rows[0];
  };
  const selectFacet = (next: { plan?: string; balance?: string; variant?: string }) => {
    const match = matchingAccounts(next);
    if (match) applyAccountType(match.id);
  };
  const providerAccounts = PROP_ACCOUNT_TYPES.filter((item) => item.brand === provider);
  const planOptions = [...new Set(providerAccounts.map(accountPlanLabel))];
  const balanceOptions = [...new Set(providerAccounts.filter((item) => accountPlanLabel(item) === accountPlan).map((item) => item.balance))];
  const variantOptions = [...new Set(providerAccounts.filter((item) => accountPlanLabel(item) === accountPlan && item.balance === Number(presetBalance)).map(accountVariantLabel))];
  const hedgeRequirement = useMemo(() => {
    const copies=Math.max(1,Math.round(Number(accountQuantity)||1));
    const preset=PLANNER_PRESETS.find((item)=>item.rules.id===accountTypeId);
    if (!preset) return {
      evaluationHedgeCost:0,
      firstPayoutHedgeCost:0,
      total:Math.round(estimateHedgeBalance(Number(accountSize)||0))*copies,
    };
    try {
      const requirement=minimumHedgeRequirement(preset.rules);
      return {
        evaluationHedgeCost:requirement.evaluationHedgeCost*copies,
        firstPayoutHedgeCost:requirement.firstPayoutHedgeCost*copies,
        total:requirement.total*copies,
      };
    } catch {
      return {
        evaluationHedgeCost:0,
        firstPayoutHedgeCost:0,
        total:Math.round(estimateHedgeBalance(Number(accountSize)||0))*copies,
      };
    }
  },[accountTypeId,accountQuantity,accountSize]);
  const submit = async () => {
    const size = Number(accountSize),
      copies = Number(accountQuantity),
      phases = Number(phaseCount),
      target = Number(profitTarget),
      drawdown = Number(maxDrawdown),
      daily = Number(dailyLossLimit),
      contracts = Number(maxContracts),
      paContracts = Number(paMaxContracts),
      consistency = Number(consistencyLimit);
    if (!name.trim()) return setError('Campaign name is required.');
    if (
      ![size, copies, phases, target, drawdown, contracts, paContracts].every(
        (value) => Number.isFinite(value) && value > 0
      )
    )
      return setError(
        'Balance, account quantity, phases, target, drawdown, and contract limit must be positive numbers.'
      );
    if (!Number.isInteger(copies)) return setError('Account quantity must be a whole number.');
    const optionalValues = [
      daily,
      consistency,
      Number(minTradingDays),
      Number(minWinningDays),
      Number(paDrawdown),
      Number(bufferLock),
      Number(paDailyLoss),
      Number(payoutWinningDays),
      Number(winningDayProfit),
      Number(payoutConsistency),
      Number(payoutCap),
      Number(withdrawableBalancePercent),
      Number(payoutSplitPercent),
      Number(activationFee),
    ];
    if (!optionalValues.every((value) => Number.isFinite(value) && value >= 0))
      return setError('Optional limits must be zero or a positive number.');
    if (
      [Number(withdrawableBalancePercent), Number(payoutSplitPercent)].some((value) => value > 100)
    )
      return setError('Payout percentages cannot exceed 100%.');
    const count = Math.max(1, Math.min(5, Math.round(phases)));
    const selectedAccount = PROP_ACCOUNT_TYPES.find((item) => item.id === accountTypeId);
    const id=addCampaign({
      name: name.trim(),
      accountSize: size,
      accountQuantity: copies,
      accountTypeName: selectedAccount
        ? `${selectedAccount.brand} · ${selectedAccount.name}`
        : 'Custom account',
      programPrice: Number(programPrice),
      billingType,
      estimatedHedgeBalance: hedgeRequirement.total,
      evaluationSpend: Number(programPrice) * copies,
      hedgingSpend: 0,
      payoutsReceived: 0,
      totalPaProfit: 0,
      maxContracts: Math.round(contracts),
      consistencyLimit: consistency,
      dailyLossLimit: daily,
      evaluationRules: {
        profitTarget: target,
        maxDrawdown: drawdown,
        drawdownType,
        dailyLossLimit: daily || null,
        minimumTradingDays: Number(minTradingDays),
        minimumWinningDays: Number(minWinningDays),
        consistencyLimit: consistency || null,
        maxContracts: Math.round(contracts),
      },
      performanceRules: {
        maxDrawdown: Number(paDrawdown),
        bufferLock: Number(bufferLock),
        drawdownType: paDrawdownType,
        dailyLossLimit: Number(paDailyLoss) || null,
        minimumTradingDaysForPayout: Number(payoutWinningDays),
        minimumWinningDaysForPayout: Number(payoutWinningDays),
        minimumWinningDayProfit: Number(winningDayProfit),
        payoutConsistencyLimit: Number(payoutConsistency) || null,
        payoutCap: Number(payoutCap) || null,
        withdrawableBalancePercent: Number(withdrawableBalancePercent),
        payoutSplitPercent: Number(payoutSplitPercent),
        activationFee: Number(activationFee),
        activationDeadlineDays: null,
        maxContracts: Math.round(paContracts),
      },
      phases: Array.from({ length: count }, (_, index) => ({
        name: index === count - 1 ? 'Performance account' : `Evaluation ${index + 1}`,
        profitTarget: target,
        maxDrawdown: drawdown,
      })),
    });
    const created=useAppStore.getState().campaigns.find((item)=>item.id===id);
    if (created) {
      const session=sessionFromCampaign(created);
      optimizeCampaign(session.state,session.rules,session.options);
      await saveEngineSession(session);
      useAppStore.getState().setActiveCampaign(id);
    }
    onClose();
  };
  return (
    <Panel
      title="Create campaign"
      eyebrow="Setup"
      actions={
        <button
          type="button"
          onClick={onClose}
          aria-label="Close campaign setup"
          className="text-muted hover:text-white"
        >
          <X className="size-4" />
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="col-span-2 grid grid-cols-4 gap-2 border border-line bg-canvas p-3">
          <div>
          <label className="field-label">Provider</label>
          <select
            aria-label="Provider"
            className={field}
            value={provider}
            onChange={(event) => applyProvider(event.target.value)}
          >
            <option value="custom">Custom provider</option>
            {providers.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          </div>
          <div>
          <label className="field-label">Account</label>
          <select
            aria-label="Account plan"
            className={field}
            value={accountPlan}
            disabled={provider === 'custom'}
            onChange={(event) => selectFacet({ plan: event.target.value })}
          >
            {provider === 'custom' && <option value="custom">Custom</option>}
            {planOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          </div>
          <div>
          <label className="field-label">Balance</label>
          <select aria-label="Account balance" className={field} value={presetBalance} disabled={provider === 'custom'} onChange={(event) => selectFacet({ balance: event.target.value })}>
            {provider === 'custom' && <option value="50000">Custom</option>}
            {balanceOptions.map((item) => <option key={item} value={item}>{money(item)}</option>)}
          </select>
          </div>
          <div>
          <label className="field-label">DLL</label>
          <select aria-label="DLL" className={field} value={accountVariant} disabled={provider === 'custom' || variantOptions.length < 2} onChange={(event) => selectFacet({ variant: event.target.value })}>
            {provider === 'custom' && <option value="custom">Custom</option>}
            {variantOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          </div>
        </div>
        <div className="col-span-2">
          <label className="field-label">Campaign name</label>
          <input className={field} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="field-label">Account quantity · copy trading</label>
          <input
            aria-label="Account quantity"
            className={field}
            inputMode="numeric"
            value={accountQuantity}
            onChange={(event) => setAccountQuantity(event.target.value)}
          />
          <p className="mt-1 text-[9px] text-muted">
            Orders are copied to every account. Prop and hedge execution scale as one synchronized
            group.
          </p>
        </div>
        {provider === 'custom' && <div className="col-span-2">
          <label className="field-label">Account size</label>
          <input
            className={field}
            inputMode="numeric"
            value={accountSize}
            onChange={(event) => setAccountSize(event.target.value)}
          />
        </div>}
        <div>
          <label className="field-label">Program price</label>
          <input
            className={field}
            inputMode="decimal"
            value={programPrice}
            onChange={(event) => setProgramPrice(event.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Billing type</label>
          <select
            className={field}
            value={billingType}
            onChange={(event) => setBillingType(event.target.value)}
          >
            <option value="Monthly">Monthly</option>
            <option value="One-time">One-time</option>
          </select>
        </div>
        <div className="col-span-2 border border-blue-400/25 bg-blue-400/[0.06] p-3">
          <div className="field-label">Engine minimum hedge balance</div>
          <div className="mt-1 font-mono text-lg font-semibold text-blue-300">
            {money(hedgeRequirement.total)}
          </div>
          <p className="mt-1 text-[9px] text-muted">
            Evaluation hedge losses {money(hedgeRequirement.evaluationHedgeCost)} + first-payout hedge losses {money(hedgeRequirement.firstPayoutHedgeCost)} for {Math.max(1, Math.round(Number(accountQuantity) || 1))} copied account{Math.max(1, Math.round(Number(accountQuantity) || 1)) === 1 ? '' : 's'}.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={evaluationOpen}
          onClick={() => setEvaluationOpen((open) => !open)}
          className="col-span-2 mt-2 flex h-10 items-center justify-between border border-line bg-canvas px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-300 hover:bg-raised"
        >
          <span>Evaluation rules</span>
          <ChevronDown
            className={cn('size-4 transition-transform', evaluationOpen && 'rotate-180')}
          />
        </button>
        {evaluationOpen && (
          <>
            <div>
              <label className="field-label">Number of phases</label>
              <input
                className={field}
                inputMode="numeric"
                value={phaseCount}
                onChange={(event) => setPhaseCount(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Profit target / phase</label>
              <input
                className={field}
                inputMode="decimal"
                value={profitTarget}
                onChange={(event) => setProfitTarget(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Maximum drawdown</label>
              <input
                className={field}
                inputMode="decimal"
                value={maxDrawdown}
                onChange={(event) => setMaxDrawdown(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Daily loss limit</label>
              <input
                className={field}
                inputMode="decimal"
                value={dailyLossLimit}
                onChange={(event) => setDailyLossLimit(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Maximum evaluation contracts</label>
              <input
                className={field}
                inputMode="numeric"
                value={maxContracts}
                onChange={(event) => setMaxContracts(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Consistency limit · %</label>
              <input
                className={field}
                inputMode="decimal"
                value={consistencyLimit}
                onChange={(event) => setConsistencyLimit(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Trailing drawdown type</label>
              <select
                className={field}
                value={drawdownType}
                onChange={(event) => setDrawdownType(event.target.value as DrawdownType)}
              >
                <option value="end-of-day">End of day</option>
                <option value="intraday-trailing">Intraday trailing</option>
                <option value="static">Static</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="field-label">Minimum trading days</label>
              <input
                className={field}
                inputMode="numeric"
                value={minTradingDays}
                onChange={(event) => setMinTradingDays(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Minimum winning days</label>
              <input
                className={field}
                inputMode="numeric"
                value={minWinningDays}
                onChange={(event) => setMinWinningDays(event.target.value)}
              />
            </div>
          </>
        )}
        <button
          type="button"
          aria-expanded={performanceOpen}
          onClick={() => setPerformanceOpen((open) => !open)}
          className="col-span-2 mt-2 flex h-10 items-center justify-between border border-line bg-canvas px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300 hover:bg-raised"
        >
          <span>Performance account & payout rules</span>
          <ChevronDown
            className={cn('size-4 transition-transform', performanceOpen && 'rotate-180')}
          />
        </button>
        {performanceOpen && (
          <>
            <div>
              <label className="field-label">PA maximum drawdown</label>
              <input
                className={field}
                inputMode="decimal"
                value={paDrawdown}
                onChange={(event) => setPaDrawdown(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Buffer lock</label>
              <input
                className={field}
                inputMode="decimal"
                value={bufferLock}
                onChange={(event) => setBufferLock(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">PA trailing drawdown type</label>
              <select
                className={field}
                value={paDrawdownType}
                onChange={(event) => setPaDrawdownType(event.target.value as DrawdownType)}
              >
                <option value="end-of-day">End of day</option>
                <option value="intraday-trailing">Intraday trailing</option>
                <option value="static">Static</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="field-label">PA daily loss limit · 0 for none</label>
              <input
                className={field}
                inputMode="decimal"
                value={paDailyLoss}
                onChange={(event) => setPaDailyLoss(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Maximum PA contracts</label>
              <input
                className={field}
                inputMode="numeric"
                value={paMaxContracts}
                onChange={(event) => setPaMaxContracts(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Winning days before payout</label>
              <input
                className={field}
                inputMode="numeric"
                value={payoutWinningDays}
                onChange={(event) => setPayoutWinningDays(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Minimum profit per winning day</label>
              <input
                className={field}
                inputMode="decimal"
                value={winningDayProfit}
                onChange={(event) => setWinningDayProfit(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Payout consistency · % · 0 for none</label>
              <input
                className={field}
                inputMode="decimal"
                value={payoutConsistency}
                onChange={(event) => setPayoutConsistency(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Payout cap · 0 for none</label>
              <input
                className={field}
                inputMode="decimal"
                value={payoutCap}
                onChange={(event) => setPayoutCap(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Balance available to withdraw · %</label>
              <input
                className={field}
                inputMode="decimal"
                value={withdrawableBalancePercent}
                onChange={(event) => setWithdrawableBalancePercent(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Trader payout split · %</label>
              <input
                className={field}
                inputMode="decimal"
                value={payoutSplitPercent}
                onChange={(event) => setPayoutSplitPercent(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Activation fee · 0 for free</label>
              <input
                className={field}
                inputMode="decimal"
                value={activationFee}
                onChange={(event) => setActivationFee(event.target.value)}
              />
            </div>
          </>
        )}
        {error && (
          <div className="col-span-2 border border-rose-500/30 bg-rose-500/10 p-2 text-[10px] text-rose-300">
            {error}
          </div>
        )}
        <div className="col-span-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()}>
            <Plus className="size-3.5" />
            Create campaign
          </Button>
        </div>
      </div>
    </Panel>
  );
}

export function CampaignsPage() {
  const campaigns = useAppStore((state) => state.campaigns);
  const activeCampaignId = useAppStore((state) => state.activeCampaignId);
  const setActiveCampaign = useAppStore((state) => state.setActiveCampaign);
  const deleteCampaign = useAppStore((state) => state.deleteCampaign);
  const closeCampaign = useAppStore((state) => state.closeCampaign);
  const livePropUnrealizedPnl = useAppStore((state) => state.livePropUnrealizedPnl);
  const livePropUpdatedAt = useAppStore((state) => state.livePropUpdatedAt);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(searchParams.get('campaign') ?? activeCampaignId);
  const [creating, setCreating] = useState(false);
  const [closedExpanded, setClosedExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeReason, setCloseReason] = useState<CampaignCloseReason>('final-payout');
  const [finalNetResult, setFinalNetResult] = useState('0');
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateError, setRecalculateError] = useState('');
  const [recalculateState, setRecalculateState] = useState({
    phase: 'EVALUATION', tradingDays: '0', profitableDays: '0', qualifyingDays: '0',
    currentMllFloor: '0', largestWinningDay: '0', payoutNumber: '0',
  });
  const openCampaigns = campaigns.filter((campaign) => campaign.status !== 'closed');
  const closedCampaigns = campaigns.filter((campaign) => campaign.status === 'closed');
  const selected = openCampaigns.find((campaign) => campaign.id === selectedId) ?? openCampaigns[0];
  const selectedStage =
    selected?.roadmapStage ??
    (/evaluation/i.test(selected?.phases[selected.currentPhase]?.name ?? '')
      ? 'evaluation'
      : 'performance');
  const selectedPhase =
    selected?.phases[selectedStage === 'evaluation' ? 0 : selected.phases.length - 1];
  const phase = selectedPhase
    ? {
        ...selectedPhase,
        name:
          selectedStage === 'evaluation'
            ? 'Evaluation'
            : selectedStage === 'post-payout'
              ? 'Post-payout'
              : 'PA',
      }
    : undefined;
  const selectedJournal=selected?campaignJournalMetrics(selected):null;
  const profit = selectedJournal && selected ? selectedJournal.currentBalance - selected.accountSize : 0;
  const progress = phase && phase.profitTarget > 0 ? (profit / phase.profitTarget) * 100 : 0;
  const consistency = profit > 0 && selected ? (selected.bestDayProfit / profit) * 100 : 0;
  const financials = useMemo(
    () =>
      campaigns.reduce(
        (totals, campaign) => ({
          evaluationSpend: totals.evaluationSpend + campaignJournalMetrics(campaign).evaluationSpend,
          hedgingSpend: totals.hedgingSpend + campaignJournalMetrics(campaign).hedgingSpend,
          payoutsReceived: totals.payoutsReceived + campaignJournalMetrics(campaign).payoutsReceived,
          totalPaProfit: totals.totalPaProfit + campaignJournalMetrics(campaign).totalPaProfit,
        }),
        { evaluationSpend: 0, hedgingSpend: 0, payoutsReceived: 0, totalPaProfit: 0 }
      ),
    [campaigns]
  );
  const realizedNet =
    financials.payoutsReceived - financials.evaluationSpend - financials.hedgingSpend;
  const openRecalculation = () => {
    if (!selected) return;
    const session=sessionFromCampaign(selected);
    setRecalculateState({
      phase: session.state.phase,
      tradingDays: String(session.state.tradingDaysCompleted),
      profitableDays: String(session.state.profitableDaysCompleted),
      qualifyingDays: String(session.state.qualifyingDaysCompleted),
      currentMllFloor: String(session.state.currentMllFloor),
      largestWinningDay: String(selected.bestDayProfit),
      payoutNumber: String(session.state.payoutNumber),
    });
    setRecalculateError('');
    setRecalculating(true);
  };
  const recalculateOptimalPath = async () => {
    if (!selected) return;
    try {
      const session=sessionFromCampaign(selected);
      const integers=['tradingDays','profitableDays','qualifyingDays','payoutNumber'] as const;
      for (const key of integers) {
        const value=Number(recalculateState[key]);
        if (!Number.isInteger(value)||value<0) throw new Error('Day counts and payout number must be nonnegative whole numbers.');
      }
      const floor=Number(recalculateState.currentMllFloor), largest=Number(recalculateState.largestWinningDay);
      if (![floor,largest].every(Number.isFinite)||largest<0) throw new Error('Enter valid MLL and best-day values.');
      let state={...session.state,phase:recalculateState.phase as typeof session.state.phase};
      state=reconcileBalanceEdit(state,session.rules,selected.currentBalance);
      state={...state,
        currentMllFloor:floor,
        tradingDaysCompleted:Number(recalculateState.tradingDays),
        cycleTradingDays:Number(recalculateState.tradingDays),
        profitableDaysCompleted:Number(recalculateState.profitableDays),
        qualifyingDaysCompleted:Number(recalculateState.qualifyingDays),
        payoutQualifyingDays:Number(recalculateState.qualifyingDays),
        largestWinningDay:largest,
        consistencyLargestDay:largest,
        payoutNumber:Number(recalculateState.payoutNumber),
        trailLocked:recalculateState.phase==='PAYOUT_CYCLE'||session.rules.funded.maxLoss.type==='STATIC'||floor>=(session.rules.funded.maxLoss.lockedFloor??Infinity),
      };
      const updated={...session,state,selectedPlan:undefined};
      optimizeCampaign(updated.state,updated.rules,updated.options);
      await saveEngineSession(updated);
      setActiveCampaign(selected.id);
      setRecalculating(false);
    } catch (error) {
      setRecalculateError(error instanceof Error?error.message:String(error));
    }
  };
  if (!selected || !phase)
    return (
      <div className="campaigns-workspace mx-auto w-full max-w-[1500px] p-4">
        <div className="mb-4">
          <div className="section-kicker">Portfolio workflow</div>
          <h1 className="mt-1 text-base font-semibold text-slate-100">Campaigns</h1>
          <p className="mt-1 text-xs text-muted">
            Configure prop-account rules, track phase progress, and choose the campaign attached to
            the terminal.
          </p>
        </div>
        {creating ? (
          <CreateCampaign onClose={() => setCreating(false)} />
        ) : (
          <div className="grid min-h-64 place-items-center border border-dashed border-line bg-surface">
            <div className="text-center">
              <Flag className="mx-auto size-6 text-slate-600" />
              <div className="mt-3 text-sm font-semibold text-slate-300">No open campaigns</div>
              <p className="mt-1 text-[10px] text-muted">
                Create an account campaign to begin tracking its rules.
              </p>
              <Button className="mt-4" variant="primary" onClick={() => setCreating(true)}>
                <Plus className="size-3.5" />
                New campaign
              </Button>
              {closedCampaigns.length > 0 && <div className="mt-5 border-t border-line pt-4 text-left">{closedCampaigns.map((campaign) => <div key={campaign.id} className="mt-2 flex items-center justify-between gap-6 border border-line bg-canvas p-3"><div><div className="text-xs text-slate-300">{campaign.name}</div><div className="mt-1 text-[9px] uppercase text-slate-600">{campaign.closeReason?.replaceAll('-', ' ')}</div></div><div className={cn('font-mono text-xs',(campaign.finalNetResult??0)>=0?'text-positive':'text-negative')}>{(campaign.finalNetResult??0)>=0?'+':''}{money(campaign.finalNetResult??0)} net</div></div>)}</div>}
            </div>
          </div>
        )}
      </div>
    );

  return (
    <div className="campaigns-workspace mx-auto w-full max-w-[1500px] p-4">
      <div className="mb-4">
        <div className="section-kicker">Portfolio workflow</div>
        <h1 className="mt-1 text-base font-semibold text-slate-100">Campaigns</h1>
        <p className="mt-1 text-xs text-muted">
          Configure prop-account rules, track phase progress, and choose the campaign attached to
          the terminal.
        </p>
      </div>
      {creating && (
        <div className="mb-4">
          <CreateCampaign onClose={() => setCreating(false)} />
        </div>
      )}
      <div className="mb-3 grid grid-cols-5 gap-3">
        <RuleMetric
          label="Eval spend"
          value={money(financials.evaluationSpend)}
          detail="Account and evaluation fees"
          icon={Receipt}
        />
        <RuleMetric
          label="Hedge spend"
          value={money(financials.hedgingSpend)}
          detail="Cumulative hedge losses and costs"
          icon={WalletCards}
        />
        <RuleMetric
          label="PA profit"
          value={money(financials.totalPaProfit)}
          detail="Gross profit across PAs"
          icon={TrendingUp}
        />
        <RuleMetric
          label="Payouts"
          value={money(financials.payoutsReceived)}
          detail="Cash received"
          icon={Banknote}
        />
        <RuleMetric
          label="Realized net"
          value={`${realizedNet < 0 ? '-' : ''}${money(Math.abs(realizedNet))}`}
          detail="Payouts less tracked costs"
          icon={Gauge}
        />
      </div>
      <div className="grid grid-cols-[310px_minmax(0,1fr)] gap-3">
        <aside className="space-y-2">
          <Button className="w-full" variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            New campaign
          </Button>
          {openCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              selected={campaign.id === selected.id}
              active={campaign.id === activeCampaignId}
              onSelect={() => {
                setSelectedId(campaign.id);
                setSearchParams({ campaign: campaign.id });
              }}
              onOpen={() => {
                setActiveCampaign(campaign.id);
                navigate('/');
              }}
            />
          ))}
          {closedCampaigns.length > 0 && (
            <div className="border border-line bg-surface">
              <button type="button" onClick={() => setClosedExpanded((value) => !value)} className="flex w-full items-center justify-between px-3 py-2 text-left">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Closed campaigns</span>
                <span className="font-mono text-[9px] text-slate-500">{closedCampaigns.length} {closedExpanded ? '−' : '+'}</span>
              </button>
              {closedExpanded && <div className="space-y-2 border-t border-line p-2">{closedCampaigns.map((campaign) => (
                <div key={campaign.id} className="border border-line bg-canvas p-3">
                  <div className="truncate text-[10px] font-semibold text-slate-300">{campaign.name}</div>
                  <div className="mt-1 text-[8px] uppercase tracking-wider text-slate-600">{campaign.closeReason?.replaceAll('-', ' ') ?? 'Closed'}</div>
                  <div className={cn('mt-2 font-mono text-xs', (campaign.finalNetResult ?? 0) >= 0 ? 'text-positive' : 'text-negative')}>
                    {(campaign.finalNetResult ?? 0) >= 0 ? '+' : ''}{money(campaign.finalNetResult ?? 0)} net
                  </div>
                </div>
              ))}</div>}
            </div>
          )}
        </aside>
        <div className="campaign-detail-sections flex flex-col gap-3">
          <div className="grid grid-cols-5 gap-3">
            <RuleMetric
              label="Profit target"
              value={money(phase.profitTarget)}
              detail={`${percent(progress)} complete · prop trade fees are added to each order`}
              icon={Target}
            />
            <RuleMetric
              label="Max drawdown"
              value={money(phase.maxDrawdown)}
              detail="Per-account trailing limit"
              icon={ShieldAlert}
            />
            <RuleMetric
              label="Contract limit"
              value={`${selected.maxContracts} × ${selected.accountQuantity ?? 1}`}
              detail={`${selected.maxContracts * (selected.accountQuantity ?? 1)} aggregate exposure`}
              icon={Layers3}
            />
            <RuleMetric
              label="Consistency"
              value={`${selected.consistencyLimit}%`}
              detail={`${percent(consistency)} current best day`}
              icon={Gauge}
            />
            <RuleMetric
              label="Hedge estimate"
              value={money(selected.estimatedHedgeBalance)}
              detail="Aggregate starting estimate"
              icon={WalletCards}
            />
          </div>
          <div className="order-3 grid grid-cols-2 items-start gap-3">
            <Panel title="Evaluation rules" eyebrow="Qualification" collapsible defaultOpen={false}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 text-[10px]">
                <div>
                  <div className="text-muted">Profit target</div>
                  <div className="mt-1 font-mono text-slate-200">
                    {money(selected.evaluationRules.profitTarget)}
                  </div>
                </div>
                <div>
                  <div className="text-muted">Drawdown</div>
                  <div className="mt-1 font-mono text-slate-200">
                    {money(selected.evaluationRules.maxDrawdown)} ·{' '}
                    {selected.evaluationRules.drawdownType}
                  </div>
                </div>
                <div>
                  <div className="text-muted">Daily loss</div>
                  <div className="mt-1 font-mono text-slate-200">
                    {selected.evaluationRules.dailyLossLimit
                      ? money(selected.evaluationRules.dailyLossLimit)
                      : 'None'}
                  </div>
                </div>
                <div>
                  <div className="text-muted">Minimum days</div>
                  <div className="mt-1 font-mono text-slate-200">
                    {selected.evaluationRules.minimumTradingDays} trading ·{' '}
                    {selected.evaluationRules.minimumWinningDays} winning
                  </div>
                </div>
              </div>
            </Panel>
            <Panel title="Performance account rules" eyebrow="Payout" collapsible defaultOpen={false}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 text-[10px]">
                <div>
                  <div className="text-muted">Buffer lock</div>
                  <div className="mt-1 font-mono text-slate-200">
                    {money(
                      selected.performanceRules.bufferLock ??
                        selected.performanceRules.maxDrawdown + 100
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-muted">Winning day minimum</div>
                  <div className="mt-1 font-mono text-slate-200">
                    {money(selected.performanceRules.minimumWinningDayProfit)}
                  </div>
                </div>
                <div>
                  <div className="text-muted">Payout cap</div>
                  <div className="mt-1 font-mono text-slate-200">
                    {selected.performanceRules.payoutCap
                      ? money(selected.performanceRules.payoutCap)
                      : 'None'}
                  </div>
                </div>
                <div>
                  <div className="text-muted">Payout economics</div>
                  <div className="mt-1 font-mono text-slate-200">
                    {selected.performanceRules.withdrawableBalancePercent ?? 50}% withdrawable ·{' '}
                    {selected.performanceRules.payoutSplitPercent ?? 90}% trader split
                  </div>
                </div>
                <div>
                  <div className="text-muted">Activation</div>
                  <div className="mt-1 font-mono text-slate-200">
                    {selected.performanceRules.activationFee
                      ? money(selected.performanceRules.activationFee)
                      : 'Free'}
                  </div>
                </div>
              </div>
            </Panel>
          </div>
          <div className="border border-line bg-canvas px-4 py-3 text-[10px] text-muted">Campaign values are calculated from the journal. Open the calendar in Execution &amp; plan to record balances, P&amp;L, fees, and purchase cost.</div>
          <div className="order-1 grid grid-cols-[1fr_320px] gap-3">
            <Panel title="Current phase" eyebrow={phase.name} collapsible className="panel-gradient h-full">
              <div className="p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10px] text-muted">Balance</div>
                    <div className="mt-1 font-mono text-2xl font-semibold text-slate-100">
                      {money(selectedJournal?.currentBalance??selected.accountSize)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted">Phase P&L</div>
                    <div
                      className={cn(
                        'mt-1 font-mono text-lg',
                        profit >= 0 ? 'text-positive' : 'text-negative'
                      )}
                    >
                      {profit >= 0 ? '+' : ''}
                      {money(profit)}
                    </div>
                  </div>
                </div>
                <div className="mt-5 h-2 overflow-hidden bg-line">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[9px] text-muted">
                  <span>{money(Math.max(0, profit))} earned</span>
                  <span>{money(phase.profitTarget)} target</span>
                </div>
                <div className="mt-5 grid grid-cols-4 gap-3 border-t border-line pt-4">
                  <div>
                    <div className="text-[9px] text-muted">Open trade P&amp;L · TV</div>
                    <div className={cn('mt-1 font-mono text-xs', activeCampaignId===selected.id && livePropUnrealizedPnl!==null ? livePropUnrealizedPnl>=0?'text-positive':'text-negative':'text-slate-500')}>
                      {activeCampaignId===selected.id && livePropUnrealizedPnl!==null ? `${livePropUnrealizedPnl>=0?'+':''}${money(livePropUnrealizedPnl)}` : '—'}
                    </div>
                    {activeCampaignId===selected.id && livePropUpdatedAt && <div className="mt-1 text-[7px] uppercase tracking-wider text-emerald-400">Live source</div>}
                  </div>
                  <div>
                    <div className="text-[9px] text-muted">Daily loss limit</div>
                    <div className="mt-1 font-mono text-xs text-slate-300">
                      {money(selected.dailyLossLimit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted">Best day</div>
                    <div className="mt-1 font-mono text-xs text-slate-300">
                      {money(selected.bestDayProfit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted">Remaining target</div>
                    <div className="mt-1 font-mono text-xs text-slate-300">
                      {money(Math.max(0, phase.profitTarget - profit))}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
            <Panel title="Account & actions" eyebrow="Campaign" collapsible className="panel-gradient h-full">
              <div className="p-4">
                <div className="flex items-center gap-3 border border-line bg-canvas p-3">
                  <WalletCards className="size-4 text-accent" />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      {selected.accountTypeName}
                    </div>
                    <div className="mt-0.5 text-[9px] text-muted">
                      {selected.accountQuantity ?? 1} account
                      {(selected.accountQuantity ?? 1) === 1 ? '' : 's'} ·{' '}
                      {money(selected.accountSize)} each · {money(selected.programPrice)} each
                    </div>
                  </div>
                </div>
                <Button
                  className="mt-3 w-full"
                  variant="primary"
                  onClick={() => {
                    setActiveCampaign(selected.id);
                    navigate('/');
                  }}
                >
                  <Play className="size-3.5" />
                  Start trading campaign
                </Button>
                <Button className="mt-2 w-full" onClick={openRecalculation}>
                  <RefreshCw className="size-3.5" />
                  Recalculate optimal path
                </Button>
                <Button
                  className="mt-2 w-full"
                  onClick={() => { setCloseReason('final-payout'); setFinalNetResult(String(selected.payoutsReceived-selected.evaluationSpend-selected.hedgingSpend)); setClosing(true); }}
                >
                  <Flag className="size-3.5" />
                  Close campaign
                </Button>
                <Button
                  className="mt-2 w-full"
                  variant="danger"
                  onClick={() => {
                    if (window.confirm(`Delete ${selected.name}? This cannot be undone.`))
                      deleteCampaign(selected.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Delete campaign
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      </div>
      {closing && selected && (
        <div role="dialog" aria-modal="true" aria-label="Close campaign" className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setClosing(false); }}>
          <form className="w-full max-w-md border border-line bg-surface shadow-2xl" onSubmit={(event) => {
            event.preventDefault();
            const result=Number(finalNetResult);
            if (!Number.isFinite(result)) return;
            const closedId=selected.id;
            closeCampaign(closedId,closeReason,result);
            const next=openCampaigns.find((campaign) => campaign.id !== closedId);
            setSelectedId(next?.id ?? '');
            if (next) setSearchParams({campaign:next.id}); else setSearchParams({});
            setClosing(false);
          }}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><div><div className="section-kicker">Archive campaign</div><div className="mt-1 text-sm font-semibold text-slate-100">{selected.name}</div></div><button type="button" aria-label="Cancel closing campaign" onClick={() => setClosing(false)}><X className="size-4 text-slate-400"/></button></div>
            <div className="space-y-4 p-4">
              <label className="block text-xs text-muted">Reason<select className="field-input mt-1 w-full" value={closeReason} onChange={(event) => setCloseReason(event.target.value as CampaignCloseReason)}><option value="final-payout">Reached final payout</option><option value="max-loss">Hit maximum loss</option><option value="manual">Closed manually</option></select></label>
              <label className="block text-xs text-muted">Final net profit or loss<input aria-label="Final net profit or loss" className="field-input mt-1 w-full" type="number" step="0.01" value={finalNetResult} onChange={(event) => setFinalNetResult(event.target.value)} /><span className="mt-1 block text-[9px] text-slate-600">Use a negative number for a loss.</span></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-line p-4"><Button type="button" onClick={() => setClosing(false)}>Cancel</Button><Button type="submit" variant="primary">Close and archive</Button></div>
          </form>
        </div>
      )}
      {recalculating && selected && (
        <div role="dialog" aria-modal="true" aria-label="Recalculate optimal path" className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4" onMouseDown={(event)=>{if(event.target===event.currentTarget)setRecalculating(false);}}>
          <form className="w-full max-w-xl border border-line bg-surface shadow-2xl" onSubmit={(event)=>{event.preventDefault();void recalculateOptimalPath();}}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><div><div className="section-kicker">Campaign engine</div><div className="mt-1 text-sm font-semibold text-slate-100">Recalculate optimal path</div></div><button type="button" aria-label="Cancel recalculation" onClick={()=>setRecalculating(false)}><X className="size-4 text-slate-400"/></button></div>
            <div className="p-4">
              <div className="mb-4 border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-[10px] text-slate-400">Balance <span className="font-mono text-emerald-300">{money(selected.currentBalance)}</span> and account rules are filled automatically from the active campaign and TradingView source.</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted">Current phase<select className="field-input mt-1 w-full" value={recalculateState.phase} onChange={(event)=>setRecalculateState((state)=>({...state,phase:event.target.value}))}><option value="EVALUATION">Evaluation</option><option value="FUNDED">PA / funded</option><option value="PAYOUT_CYCLE">Payout cycle</option></select></label>
                <label className="text-xs text-muted">Current MLL balance<input className="field-input mt-1 w-full font-mono" inputMode="decimal" value={recalculateState.currentMllFloor} onChange={(event)=>setRecalculateState((state)=>({...state,currentMllFloor:event.target.value}))}/></label>
                <label className="text-xs text-muted">Trading days completed<input className="field-input mt-1 w-full font-mono" inputMode="numeric" value={recalculateState.tradingDays} onChange={(event)=>setRecalculateState((state)=>({...state,tradingDays:event.target.value}))}/></label>
                <label className="text-xs text-muted">Profitable days completed<input className="field-input mt-1 w-full font-mono" inputMode="numeric" value={recalculateState.profitableDays} onChange={(event)=>setRecalculateState((state)=>({...state,profitableDays:event.target.value}))}/></label>
                <label className="text-xs text-muted">Qualifying payout days<input className="field-input mt-1 w-full font-mono" inputMode="numeric" value={recalculateState.qualifyingDays} onChange={(event)=>setRecalculateState((state)=>({...state,qualifyingDays:event.target.value}))}/></label>
                <label className="text-xs text-muted">Largest winning day<input className="field-input mt-1 w-full font-mono" inputMode="decimal" value={recalculateState.largestWinningDay} onChange={(event)=>setRecalculateState((state)=>({...state,largestWinningDay:event.target.value}))}/></label>
                <label className="text-xs text-muted">Completed payouts<input className="field-input mt-1 w-full font-mono" inputMode="numeric" value={recalculateState.payoutNumber} onChange={(event)=>setRecalculateState((state)=>({...state,payoutNumber:event.target.value}))}/></label>
              </div>
              {recalculateError&&<p role="alert" className="mt-3 text-xs text-rose-300">{recalculateError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-line p-4"><Button type="button" onClick={()=>setRecalculating(false)}>Cancel</Button><Button type="submit" variant="primary"><RefreshCw className="size-3.5"/>Recalculate path</Button></div>
          </form>
        </div>
      )}
    </div>
  );
}
