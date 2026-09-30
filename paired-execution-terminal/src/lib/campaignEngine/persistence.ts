import { invoke } from '@tauri-apps/api/core';
import type { AccountRules, CampaignState, CampaignAction, OptimizerOptions, TransitionRecord } from './types';
export interface EngineSession { workspaceId?: string; workspaceTitle?: string; updatedAt?: string; rules: AccountRules; state: CampaignState; options: OptimizerOptions; history: TransitionRecord[]; selectedPlan?: { action: CampaignAction; stateKey: string } }
const tauri = () => Boolean((window as unknown as {__TAURI_INTERNALS__?: unknown}).__TAURI_INTERNALS__);
const key = 'hedge-os:campaign-engine:v1';
const savedKey = 'hedge-os:campaign-engine:saved:v1';
export function migrateEngineSession(session: EngineSession): EngineSession {
  const isTradeifyGrowth = /^tradeify-(25000|50000|100000|150000)-growth-(daily|flex)$/.test(session.rules.id);
  const conversion = session.rules.funded.payout.payoutConversionRate;
  // Early Tradeify presets treated all funded profit as withdrawable. Growth
  // accounts only convert 50% of profit, then apply the 90/10 trader split.
  const needsTradeifyMigration = isTradeifyGrowth && (conversion == null || conversion === 1);
  const needsFeeMigration = !session.rules.feeConfig || session.rules.feeConfig.propTargetBufferPct === 1 / 31;
  if (needsTradeifyMigration || needsFeeMigration) {
    return {
      ...session,
      selectedPlan: needsTradeifyMigration ? undefined : session.selectedPlan,
      state: {
        ...session.state,
        grossPropPnL: session.state.grossPropPnL ?? session.state.cumulativePhaseProfit,
        estimatedPropFees: session.state.estimatedPropFees ?? 0,
        netPropPnL: session.state.netPropPnL ?? session.state.cumulativePhaseProfit,
        estimatedLiveFees: session.state.estimatedLiveFees ?? 0,
      },
      rules: {
        ...session.rules,
        feeConfig: { ...(session.rules.feeConfig ?? { enabled: true, liveRecoveryFeeBufferPct: 0.04 }), propTargetBufferPct: 0 },
        funded: {
          ...session.rules.funded,
          payout: {
            ...session.rules.funded.payout,
            payoutConversionRate: needsTradeifyMigration ? 0.5 : session.rules.funded.payout.payoutConversionRate,
            profitShare: needsTradeifyMigration ? 0.9 : session.rules.funded.payout.profitShare,
          },
        },
      },
    };
  }
  return session;
}
export async function loadEngineSession(): Promise<EngineSession | null> {
  const loaded = tauri()
    ? await invoke<EngineSession | null>('load_engine_session')
    : (() => { const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) as EngineSession : null; })();
  if (!loaded) return null;
  const migrated = migrateEngineSession(loaded);
  if (migrated !== loaded) {
    if (tauri()) await invoke('save_engine_session', { session: migrated });
    else localStorage.setItem(key, JSON.stringify(migrated));
  }
  return migrated;
}
export async function saveEngineSession(session: EngineSession) {
  const migrated = migrateEngineSession(session);
  if (tauri()) await invoke('save_engine_session',{session:migrated});
  else localStorage.setItem(key,JSON.stringify(migrated));
  window.dispatchEvent(new CustomEvent('hedge-os:campaign-engine-updated', { detail: migrated }));
}
export async function listEngineWorkspaces(): Promise<EngineSession[]> {
  if (tauri()) return (await invoke<EngineSession[]>('list_engine_workspaces')).map(migrateEngineSession);
  const raw=localStorage.getItem(savedKey);
  if (!raw) return [];
  const loaded=JSON.parse(raw) as EngineSession[];
  const migrated=loaded.map(migrateEngineSession);
  if (migrated.some((item,index)=>item!==loaded[index])) localStorage.setItem(savedKey,JSON.stringify(migrated));
  return migrated;
}
export async function saveNamedEngineWorkspace(session: EngineSession, title: string): Promise<EngineSession> {
  const workspaceTitle=title.trim(); if(!workspaceTitle) throw new Error('Enter a workspace name before saving.');
  const saved={...session,workspaceId:session.workspaceId??crypto.randomUUID(),workspaceTitle,updatedAt:new Date().toISOString()};
  if(tauri()) await invoke('save_named_engine_workspace',{workspaceId:saved.workspaceId,session:saved});
  else { const all=await listEngineWorkspaces(), next=[saved,...all.filter(x=>x.workspaceId!==saved.workspaceId)]; localStorage.setItem(savedKey,JSON.stringify(next)); }
  await saveEngineSession(saved); return saved;
}
