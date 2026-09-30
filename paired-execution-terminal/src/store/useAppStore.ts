import { create } from 'zustand';
import {
  appendLedgerEntry,
  loadPersistedActiveCampaign,
  loadPersistedCampaigns,
  persistActiveCampaign,
  persistCampaign,
  removePersistedCampaign,
  seedPersistedCampaign,
} from '../lib/database';

export type Environment = 'sim' | 'live';
export type TerminalView = 'prop' | 'hedge';
export type TradingInstrument = 'NQ' | 'MNQ' | 'MBT';
export type ExitInputMode = 'dollars' | 'price';
export type OrderDirection = 'long' | 'short';
export type HedgeMode = 'auto' | 'manual';
export type LimitOrderStatus = 'idle' | 'draft' | 'confirmed' | 'modifying';
export type CampaignStatus = 'active' | 'paused' | 'passed' | 'closed';
export type CampaignCloseReason = 'max-loss' | 'final-payout' | 'manual';
export type RoadmapStage = 'evaluation' | 'performance' | 'post-payout';

export interface CampaignPhase {
  name: string;
  profitTarget: number;
  maxDrawdown: number;
}

export interface CampaignJournalEntry {
  id: string;
  date: string;
  balance: number;
  realizedPnl: number;
  /** Legacy combined field. New entries use the two account-specific fields. */
  propRealizedPnl?: number;
  propFees?: number;
  liveRealizedPnl?: number;
  /** Manually recorded live hedge account balance. */
  hedgeBalance?: number;
  /** Capital intentionally allocated to the hedge account. */
  allocatedHedgeCapital?: number;
  fees: number;
  note?: string;
  recordedAt: string;
  purchaseCost?: number;
  payoutReceived?: number;
}

export type DrawdownType = 'none' | 'end-of-day' | 'intraday-trailing' | 'static';
export interface EvaluationRules {
  profitTarget: number;
  maxDrawdown: number;
  drawdownType: DrawdownType;
  dailyLossLimit: number | null;
  minimumTradingDays: number;
  minimumWinningDays: number;
  consistencyLimit: number | null;
  maxContracts: number;
}
export interface PerformanceAccountRules {
  maxDrawdown: number;
  bufferLock?: number;
  drawdownType: DrawdownType;
  dailyLossLimit: number | null;
  minimumTradingDaysForPayout: number;
  minimumWinningDaysForPayout: number;
  minimumWinningDayProfit: number;
  payoutConsistencyLimit: number | null;
  payoutCap: number | null;
  withdrawableBalancePercent?: number;
  payoutSplitPercent?: number;
  activationFee: number;
  activationDeadlineDays: number | null;
  maxContracts: number;
}

export interface Campaign {
  id: string;
  name: string;
  accountSize: number;
  accountQuantity?: number;
  status: CampaignStatus;
  currentPhase: number;
  phases: CampaignPhase[];
  maxContracts: number;
  consistencyLimit: number;
  dailyLossLimit: number;
  currentBalance: number;
  bestDayProfit: number;
  accountTypeName: string;
  programPrice: number;
  billingType: string;
  estimatedHedgeBalance: number;
  evaluationSpend: number;
  hedgingSpend: number;
  payoutsReceived: number;
  totalPaProfit: number;
  evaluationRules: EvaluationRules;
  performanceRules: PerformanceAccountRules;
  roadmapStage?: RoadmapStage;
  roadmapStep?: Partial<Record<RoadmapStage, number>>;
  postPayoutCycle?: number;
  closedAt?: string;
  closeReason?: CampaignCloseReason;
  finalNetResult?: number;
  journal?: CampaignJournalEntry[];
  purchaseDate?: string;
  cashSpentOnAccount?: number;
}

/** The journal is the financial record. Legacy campaign fields are retained
 * only as persisted compatibility caches, never as a display calculation. */
export function campaignJournalMetrics(campaign: Campaign) {
  const entries=[...(campaign.journal??[])].sort((a,b)=>a.date.localeCompare(b.date)||a.recordedAt.localeCompare(b.recordedAt));
  const propPnl=(entry:CampaignJournalEntry)=>Number(entry.propRealizedPnl??entry.realizedPnl??0)-Number(entry.propFees??0);
  const livePnl=(entry:CampaignJournalEntry)=>Number(entry.liveRealizedPnl??0);
  return {
    currentBalance: campaign.accountSize+entries.reduce((sum,entry)=>sum+propPnl(entry)-Number(entry.payoutReceived??0),0),
    totalPaProfit: entries.reduce((sum,entry)=>sum+propPnl(entry),0),
    totalLiveProfit: entries.reduce((sum,entry)=>sum+livePnl(entry),0),
    currentHedgeBalance:campaign.estimatedHedgeBalance+entries.reduce((sum,entry)=>sum+livePnl(entry)-entry.fees,0),
    allocatedHedgeCapital:campaign.estimatedHedgeBalance,
    hedgingSpend: entries.reduce((sum,entry)=>sum+entry.fees,0),
    evaluationSpend: entries.reduce((sum,entry)=>sum+Number(entry.purchaseCost??0),0),
    payoutsReceived: entries.reduce((sum,entry)=>sum+Number(entry.payoutReceived??0),0),
    bestDayProfit: Math.max(0,...entries.map(propPnl)),
    entryCount: entries.length,
  };
}

function seedJournalFromCampaign(campaign: Campaign): Campaign {
  if(campaign.journal?.length)return campaign;
  const date=campaign.purchaseDate??new Date().toISOString().slice(0,10);
  return {...campaign,journal:[{
    id:`${campaign.id}-journal-opening`,date,balance:campaign.currentBalance,
    realizedPnl:campaign.totalPaProfit,fees:campaign.hedgingSpend,
    purchaseCost:campaign.cashSpentOnAccount??campaign.evaluationSpend,
    payoutReceived:campaign.payoutsReceived,recordedAt:new Date().toISOString(),note:'Opening campaign record',
  }]};
}

interface AppState {
  campaignObjective: {campaignId:string;targetProfit:number;stopLoss:number;hedgeRatioPercent:number;purpose:string;maxContracts:number} | null;
  setCampaignObjective: (objective: AppState['campaignObjective']) => void;
  environment: Environment;
  terminalView: TerminalView;
  tradingInstrument: TradingInstrument;
  sidebarCollapsed: boolean;
  terminalLeftCollapsed: boolean;
  executionPanelCollapsed: boolean;
  orderDirection: OrderDirection;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  exitInputMode: ExitInputMode;
  propQuantity: number;
  hedgeMode: HedgeMode;
  manualHedgeRatio: number;
  autoHedgeRatio: number;
  hedgeRequiredRecovery: number;
  hedgeFrictionAllowance: number;
  hedgeDesiredFailureProfit: number;
  limitOrderStatus: LimitOrderStatus;
  confirmedEntryPrice: number | null;
  campaigns: Campaign[];
  campaignsHydrated: boolean;
  activeCampaignId: string;
  livePropUnrealizedPnl: number | null;
  livePropUpdatedAt: number | null;
  setEnvironment: (environment: Environment) => void;
  setTerminalView: (terminalView: TerminalView) => void;
  setTradingInstrument: (tradingInstrument: TradingInstrument) => void;
  toggleSidebar: () => void;
  toggleTerminalLeft: () => void;
  toggleExecutionPanel: () => void;
  setOrderDirection: (orderDirection: OrderDirection) => void;
  setEntryPrice: (entryPrice: number) => void;
  setTakeProfit: (takeProfit: number) => void;
  setStopLoss: (stopLoss: number) => void;
  setExitInputMode: (exitInputMode: ExitInputMode) => void;
  setPropQuantity: (propQuantity: number) => void;
  setHedgeMode: (hedgeMode: HedgeMode) => void;
  setManualHedgeRatio: (manualHedgeRatio: number) => void;
  setAutoHedgeRatio: (autoHedgeRatio: number) => void;
  setHedgeRequiredRecovery: (value: number) => void;
  setHedgeFrictionAllowance: (value: number) => void;
  setHedgeDesiredFailureProfit: (value: number) => void;
  setLimitOrderStatus: (limitOrderStatus: LimitOrderStatus) => void;
  setConfirmedEntryPrice: (confirmedEntryPrice: number | null) => void;
  addCampaign: (
    campaign: Omit<Campaign, 'id' | 'status' | 'currentPhase' | 'currentBalance' | 'bestDayProfit'>
  ) => string;
  setActiveCampaign: (campaignId: string) => void;
  setCampaignPhase: (campaignId: string, phase: number) => void;
  setCampaignStatus: (campaignId: string, status: CampaignStatus) => void;
  setCampaignRoadmapStage: (campaignId: string, stage: RoadmapStage) => void;
  setCampaignRoadmapStep: (campaignId: string, stage: RoadmapStage, step: number) => void;
  resetPostPayoutCycle: (campaignId: string) => void;
  deleteCampaign: (campaignId: string) => void;
  closeCampaign: (campaignId: string, reason: CampaignCloseReason, finalNetResult: number) => void;
  updateCampaignFinancials: (
    campaignId: string,
    values: Pick<Campaign, 'evaluationSpend' | 'hedgingSpend' | 'payoutsReceived' | 'totalPaProfit'>
  ) => void;
  recordCampaignJournalEntry: (campaignId: string, entry: Omit<CampaignJournalEntry, 'id' | 'recordedAt'>) => void;
  setCampaignPurchase: (campaignId: string, purchaseDate: string, cashSpentOnAccount: number) => void;
  hydrateCampaigns: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  campaignObjective: null,
  setCampaignObjective: (campaignObjective) => {
    if(campaignObjective && ['confirmed','modifying'].includes(get().limitOrderStatus)) throw new Error('Finish the working order before loading a planner draft.');
    set(campaignObjective?{campaignObjective,limitOrderStatus:'draft',confirmedEntryPrice:null}:{campaignObjective});
  },
  environment: 'sim',
  terminalView: 'prop',
  // NQ remains supported for legacy/provider compatibility; new prop arms are MNQ.
  tradingInstrument: 'MNQ',
  sidebarCollapsed: false,
  terminalLeftCollapsed: false,
  executionPanelCollapsed: false,
  orderDirection: 'long',
  entryPrice: 25000,
  takeProfit: 25020,
  stopLoss: 24980,
  exitInputMode: 'dollars',
  propQuantity: 3,
  hedgeMode: 'auto',
  manualHedgeRatio: 46,
  autoHedgeRatio: 0,
  hedgeRequiredRecovery: 0,
  hedgeFrictionAllowance: 0,
  hedgeDesiredFailureProfit: 0,
  limitOrderStatus: 'draft',
  confirmedEntryPrice: null,
  campaigns: [
    {
      id: 'campaign-mnq-50k',
      name: 'MNQ 50K Qualification',
      accountSize: 50000,
      accountQuantity: 1,
      status: 'active',
      currentPhase: 0,
      phases: [
        { name: 'Evaluation', profitTarget: 3000, maxDrawdown: 2000 },
        { name: 'Funded', profitTarget: 5000, maxDrawdown: 2000 },
        { name: 'Payout', profitTarget: 1500, maxDrawdown: 2000 },
      ],
      maxContracts: 10,
      consistencyLimit: 50,
      dailyLossLimit: 1000,
      currentBalance: 51824,
      bestDayProfit: 612,
      accountTypeName: 'Topstep · 50K No Activation Fee',
      programPrice: 85,
      billingType: 'Monthly',
      estimatedHedgeBalance: 1600,
      evaluationSpend: 85,
      hedgingSpend: 320,
      payoutsReceived: 0,
      totalPaProfit: 1824,
      evaluationRules: {
        profitTarget: 3000,
        maxDrawdown: 2000,
        drawdownType: 'end-of-day',
        dailyLossLimit: 1000,
        minimumTradingDays: 1,
        minimumWinningDays: 0,
        consistencyLimit: 50,
        maxContracts: 10,
      },
      performanceRules: {
        maxDrawdown: 2000,
        bufferLock: 2100,
        drawdownType: 'end-of-day',
        dailyLossLimit: 1000,
        minimumTradingDaysForPayout: 5,
        minimumWinningDaysForPayout: 5,
        minimumWinningDayProfit: 150,
        payoutConsistencyLimit: 40,
        payoutCap: 4000,
        withdrawableBalancePercent: 50,
        payoutSplitPercent: 90,
        activationFee: 0,
        activationDeadlineDays: 7,
        maxContracts: 10,
      },
    },
  ],
  activeCampaignId: 'campaign-mnq-50k',
  livePropUnrealizedPnl: null,
  livePropUpdatedAt: null,
  campaignsHydrated: false,
  setEnvironment: (environment) => set({ environment }),
  setTerminalView: (terminalView) => set({ terminalView }),
  setTradingInstrument: (tradingInstrument) => set({ tradingInstrument: tradingInstrument === 'MBT' ? 'NQ' : tradingInstrument }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleTerminalLeft: () =>
    set((state) => ({ terminalLeftCollapsed: !state.terminalLeftCollapsed })),
  toggleExecutionPanel: () =>
    set((state) => ({ executionPanelCollapsed: !state.executionPanelCollapsed })),
  setOrderDirection: (orderDirection) => set({ orderDirection }),
  setEntryPrice: (entryPrice) =>
    set((state) => {
      if (state.exitInputMode !== 'dollars') return { entryPrice };
      const delta = entryPrice - state.entryPrice;
      return {
        entryPrice,
        takeProfit: state.takeProfit + delta,
        stopLoss: state.stopLoss + delta,
      };
    }),
  setTakeProfit: (takeProfit) => set({ takeProfit }),
  setStopLoss: (stopLoss) => set({ stopLoss }),
  setExitInputMode: (exitInputMode) => set({ exitInputMode }),
  setPropQuantity: (propQuantity) => set({ propQuantity }),
  setHedgeMode: (hedgeMode) => set({ hedgeMode }),
  setManualHedgeRatio: (manualHedgeRatio) => set({ manualHedgeRatio }),
  setAutoHedgeRatio: (autoHedgeRatio) => set({ autoHedgeRatio }),
  setHedgeRequiredRecovery: (hedgeRequiredRecovery) => set({ hedgeRequiredRecovery }),
  setHedgeFrictionAllowance: (hedgeFrictionAllowance) => set({ hedgeFrictionAllowance }),
  setHedgeDesiredFailureProfit: (hedgeDesiredFailureProfit) => set({ hedgeDesiredFailureProfit }),
  // Never mutate a live legacy NQ order. Once it is no longer working, return
  // the terminal to the MNQ-prop / MNQ+NNQ-hedge architecture automatically.
  setLimitOrderStatus: (limitOrderStatus) => set((state) => ({
    limitOrderStatus,
    ...(limitOrderStatus === 'confirmed' || limitOrderStatus === 'modifying' || state.tradingInstrument === 'MNQ'
      ? {}
      : { tradingInstrument: 'MNQ' as const }),
  })),
  setConfirmedEntryPrice: (confirmedEntryPrice) => set({ confirmedEntryPrice }),
  addCampaign: (campaign) => {
    const id = `campaign-${Date.now()}`;
    set((state) => {
      const created = seedJournalFromCampaign({
        ...campaign,
        id,
        status: 'active' as const,
        currentPhase: 0,
        currentBalance: campaign.accountSize,
        bestDayProfit: 0,
      });
      const campaigns = [...state.campaigns, created];
      void seedPersistedCampaign(created, campaigns).catch(console.error);
      return { campaigns };
    });
    return id;
  },
  setActiveCampaign: (activeCampaignId) =>
    set((state) => {
      if (!state.campaigns.some((item) => item.id === activeCampaignId && item.status !== 'closed')) return {};
      void persistActiveCampaign(activeCampaignId).catch(console.error);
      return { activeCampaignId };
    }),
  setCampaignPhase: (campaignId, currentPhase) =>
    set((state) => {
      const campaigns = state.campaigns.map((campaign) =>
        campaign.id === campaignId
          ? {
              ...campaign,
              currentPhase: Math.max(0, Math.min(currentPhase, campaign.phases.length - 1)),
            }
          : campaign
      );
      const changed = campaigns.find((campaign) => campaign.id === campaignId);
      if (changed) void persistCampaign(changed, campaigns).catch(console.error);
      return { campaigns };
    }),
  setCampaignStatus: (campaignId, status) =>
    set((state) => {
      const campaigns = state.campaigns.map((campaign) =>
        campaign.id === campaignId ? { ...campaign, status } : campaign
      );
      const changed = campaigns.find((campaign) => campaign.id === campaignId);
      if (changed) void persistCampaign(changed, campaigns).catch(console.error);
      return { campaigns };
    }),
  setCampaignRoadmapStage: (campaignId, roadmapStage) =>
    set((state) => {
      const campaigns = state.campaigns.map((campaign) =>
        campaign.id === campaignId ? { ...campaign, roadmapStage } : campaign
      );
      const changed = campaigns.find((campaign) => campaign.id === campaignId);
      if (changed) void persistCampaign(changed, campaigns).catch(console.error);
      return { campaigns };
    }),
  setCampaignRoadmapStep: (campaignId, stage, step) =>
    set((state) => {
      const campaigns = state.campaigns.map((campaign) =>
        campaign.id === campaignId
          ? { ...campaign, roadmapStep: { ...campaign.roadmapStep, [stage]: Math.max(0, step) } }
          : campaign
      );
      const changed = campaigns.find((campaign) => campaign.id === campaignId);
      if (changed) void persistCampaign(changed, campaigns).catch(console.error);
      return { campaigns };
    }),
  resetPostPayoutCycle: (campaignId) =>
    set((state) => {
      const campaigns = state.campaigns.map((campaign) =>
        campaign.id === campaignId
          ? {
              ...campaign,
              roadmapStage: 'post-payout' as const,
              roadmapStep: { ...campaign.roadmapStep, 'post-payout': 0 },
              postPayoutCycle: (campaign.postPayoutCycle ?? 1) + 1,
            }
          : campaign
      );
      const changed = campaigns.find((campaign) => campaign.id === campaignId);
      if (changed) void persistCampaign(changed, campaigns).catch(console.error);
      return { campaigns };
    }),
  deleteCampaign: (campaignId) =>
    set((state) => {
      const campaigns = state.campaigns.filter((campaign) => campaign.id !== campaignId);
      const activeCampaignId =
        state.activeCampaignId === campaignId
          ? campaigns.find((campaign) => campaign.status !== 'closed')?.id ?? ''
          : state.activeCampaignId;
      void removePersistedCampaign(campaignId, campaigns).catch(console.error);
      void persistActiveCampaign(activeCampaignId).catch(console.error);
      return {
        campaigns,
        activeCampaignId,
      };
    }),
  closeCampaign: (campaignId, closeReason, finalNetResult) =>
    set((state) => {
      if (!Number.isFinite(finalNetResult)) return {};
      const campaigns = state.campaigns.map((campaign) => campaign.id === campaignId
        ? { ...campaign, status: 'closed' as const, closeReason, finalNetResult, closedAt: new Date().toISOString() }
        : campaign);
      const changed = campaigns.find((campaign) => campaign.id === campaignId);
      const nextActive = state.activeCampaignId === campaignId
        ? campaigns.find((campaign) => campaign.status !== 'closed')?.id ?? ''
        : state.activeCampaignId;
      if (changed) void persistCampaign(changed, campaigns).catch(console.error);
      void persistActiveCampaign(nextActive).catch(console.error);
      return { campaigns, activeCampaignId: nextActive };
    }),
  updateCampaignFinancials: (campaignId, values) =>
    set((state) => {
      const previous = state.campaigns.find((campaign) => campaign.id === campaignId);
      const campaigns = state.campaigns.map((campaign) =>
        campaign.id === campaignId ? { ...campaign, ...values } : campaign
      );
      const changed = campaigns.find((campaign) => campaign.id === campaignId);
      if (previous && changed) {
        void Promise.all([
          appendLedgerEntry(
            campaignId,
            'evaluation_spend',
            values.evaluationSpend - previous.evaluationSpend,
            'Financial tracker adjustment'
          ),
          appendLedgerEntry(
            campaignId,
            'hedging_spend',
            values.hedgingSpend - previous.hedgingSpend,
            'Financial tracker adjustment'
          ),
          appendLedgerEntry(
            campaignId,
            'pa_profit',
            values.totalPaProfit - previous.totalPaProfit,
            'Financial tracker adjustment'
          ),
          appendLedgerEntry(
            campaignId,
            'payout_received',
            values.payoutsReceived - previous.payoutsReceived,
            'Financial tracker adjustment'
          ),
          persistCampaign(changed, campaigns),
        ]).catch(console.error);
      }
      return { campaigns };
    }),
  recordCampaignJournalEntry: (campaignId, entry) =>
    set((state) => {
      if(!Number.isFinite(entry.realizedPnl)||!Number.isFinite(entry.propRealizedPnl??entry.realizedPnl)||!Number.isFinite(entry.liveRealizedPnl??0)||!Number.isFinite(entry.propFees??0)||(entry.propFees??0)<0||!Number.isFinite(entry.fees)||entry.fees<0)return {};
      const previous=state.campaigns.find(campaign=>campaign.id===campaignId);
      if(!previous)return {};
      const journal=previous.journal??[];
      const existing=journal.find(item=>item.date===entry.date);
      const nextEntry: CampaignJournalEntry={
        ...existing,
        ...entry,
        hedgeBalance:Number.isFinite(entry.hedgeBalance)?entry.hedgeBalance:(existing?.hedgeBalance??campaignJournalMetrics(previous).currentHedgeBalance),
        allocatedHedgeCapital:Number.isFinite(entry.allocatedHedgeCapital)?entry.allocatedHedgeCapital:(existing?.allocatedHedgeCapital??campaignJournalMetrics(previous).allocatedHedgeCapital),
        id:existing?.id??crypto.randomUUID(),recordedAt:new Date().toISOString(),
      };
      const nextJournal=(existing?journal.map(item=>item.id===existing.id?nextEntry:item):[nextEntry,...journal]).sort((a,b)=>a.date.localeCompare(b.date));
      let propBalance=previous.accountSize,hedgeBalance=previous.estimatedHedgeBalance;
      for(const day of nextJournal){
        propBalance+=Number(day.propRealizedPnl??day.realizedPnl)-Number(day.propFees??0)-Number(day.payoutReceived??0);
        hedgeBalance+=Number(day.liveRealizedPnl??0)-day.fees;
        const index=nextJournal.indexOf(day);
        nextJournal[index]={...day,balance:propBalance,hedgeBalance,allocatedHedgeCapital:previous.estimatedHedgeBalance};
      }
      const pnlDelta=Number(nextEntry.propRealizedPnl??nextEntry.realizedPnl)-Number(nextEntry.propFees??0)-Number(existing?.propRealizedPnl??existing?.realizedPnl??0)+Number(existing?.propFees??0);
      const feeDelta=nextEntry.fees-(existing?.fees??0);
      const nextMetrics=campaignJournalMetrics({...previous,journal:nextJournal});
      const campaigns=state.campaigns.map(campaign=>campaign.id===campaignId?{
        ...campaign,journal:nextJournal,
        // Compatibility caches mirror the journal; UI calculations derive from
        // campaignJournalMetrics rather than these values.
        currentBalance:nextMetrics.currentBalance,
        totalPaProfit:nextMetrics.totalPaProfit,
        hedgingSpend:nextMetrics.hedgingSpend,
        bestDayProfit:nextMetrics.bestDayProfit,
      }:campaign);
      const changed=campaigns.find(campaign=>campaign.id===campaignId)!;
      void Promise.all([
        pnlDelta?appendLedgerEntry(campaignId,'pa_profit',pnlDelta,`Journal entry ${entry.date}`):Promise.resolve(),
        feeDelta?appendLedgerEntry(campaignId,'hedging_spend',feeDelta,`Journal fees ${entry.date}`):Promise.resolve(),
        persistCampaign(changed,campaigns),
      ]).catch(console.error);
      return {campaigns};
    }),
  setCampaignPurchase: (campaignId, purchaseDate, cashSpentOnAccount) =>
    set((state) => {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)||!Number.isFinite(cashSpentOnAccount)||cashSpentOnAccount<0)return {};
      const campaigns=state.campaigns.map(campaign=>{
        if(campaign.id!==campaignId)return campaign;
        const journal=campaign.journal??[];
        const existing=journal.find(entry=>entry.date===purchaseDate);
        const base:CampaignJournalEntry=existing??{id:crypto.randomUUID(),date:purchaseDate,balance:campaignJournalMetrics(campaign).currentBalance,realizedPnl:0,fees:0,recordedAt:new Date().toISOString()};
        const next={...base,purchaseCost:cashSpentOnAccount,recordedAt:new Date().toISOString()};
        return {...campaign,purchaseDate,cashSpentOnAccount,journal:existing?journal.map(entry=>entry.id===existing.id?next:entry):[...journal,next]};
      });
      const changed=campaigns.find(campaign=>campaign.id===campaignId);
      if(changed)void Promise.all([
        cashSpentOnAccount?appendLedgerEntry(campaignId,'evaluation_spend',cashSpentOnAccount,`Account purchase ${purchaseDate}`):Promise.resolve(),
        persistCampaign(changed,campaigns),
      ]).catch(console.error);
      return {campaigns};
    }),
  hydrateCampaigns: async () => {
    try {
      const [persisted, persistedActive] = await Promise.all([
        loadPersistedCampaigns(),
        loadPersistedActiveCampaign(),
      ]);
      if (persisted) {
        // Earlier Lucid presets accidentally copied the PA payout-day count
        // into evaluation. Preserve every user value except that known legacy
        // preset error.
        const campaigns = persisted.map((campaign) => seedJournalFromCampaign(
          campaign.accountTypeName.startsWith('Lucid Trading') && campaign.evaluationRules.minimumTradingDays === 5
            ? {...campaign,evaluationRules:{...campaign.evaluationRules,minimumTradingDays:0}}
            : campaign
        ));
        set({
          campaigns,
          activeCampaignId:
            persistedActive && campaigns.some((campaign) => campaign.id === persistedActive && campaign.status !== 'closed')
              ? persistedActive
              : (campaigns.find((campaign) => campaign.status !== 'closed')?.id ?? ''),
          campaignsHydrated: true,
        });
        for (const campaign of campaigns)
          if (persisted.find(item=>item.id===campaign.id)?.evaluationRules.minimumTradingDays !== campaign.evaluationRules.minimumTradingDays || !persisted.find(item=>item.id===campaign.id)?.journal?.length)
            await persistCampaign(campaign,campaigns);
      }
      else {
        const campaigns = get().campaigns;
        for (const campaign of campaigns) await seedPersistedCampaign(campaign, campaigns);
        set({ campaignsHydrated: true });
      }
    } catch (error) {
      console.error('Failed to load campaign database', error);
      set({ campaignsHydrated: true });
    }
  },
}));
