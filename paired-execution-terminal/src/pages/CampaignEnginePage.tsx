import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StateBuilderDrawer } from '../components/campaignEngine/StateBuilderDrawer';
import { CampaignProjectionChart } from '../components/campaignEngine/CampaignProjectionChart';
import { CampaignSummaryCards, NextTradeRecommendation, OutcomeBranchCard, ProjectedPathTimeline } from '../components/campaignEngine/PlannerPanels';
import { PathExplorer } from '../components/campaignEngine/PathExplorer';
import { projectionData, previewAlternative, terminalObjective } from '../lib/campaignEngine/planner';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../store/useAppStore';
import { EXAMPLES } from '../lib/campaignEngine/examples';
import { optimizeCampaign } from '../lib/campaignEngine/optimizer';
import { transition, activateFunded, validateState, normalizePayoutCycleState, OPTIMIZER_VERSION } from '../lib/campaignEngine/state';
import { applyPayout, getDistanceToMll, isPayoutEligible } from '../lib/campaignEngine/rules';
import { loadEngineSession, saveEngineSession, listEngineWorkspaces, saveNamedEngineWorkspace, type EngineSession } from '../lib/campaignEngine/persistence';
import type { CampaignAction, Outcome } from '../lib/campaignEngine/types';

const dollars=(n: number | null | undefined) => n == null ? '—' : n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const initial: EngineSession={rules:{...EXAMPLES[0].rules,feeConfig:{enabled:true,propTargetBufferPct:0,liveRecoveryFeeBufferPct:.04}},state:EXAMPLES[0].state,options:{objective:'FULL_PAYOUT',maxSearchDepth:6,maxStates:12000,maxCandidates:6},history:[]};
export function CampaignEnginePage() {
  const navigate=useNavigate();
  const [builder,setBuilder]=useState(false);
  const [preview,setPreview]=useState<CampaignAction|null>(null);
  const campaigns=useAppStore(s=>s.campaigns);
  const [session,setSession]=useState<EngineSession>(initial);
  const [savedWorkspaces,setSavedWorkspaces]=useState<EngineSession[]>([]),[workspaceTitle,setWorkspaceTitle]=useState('');
  const [error,setError]=useState(''); const [note,setNote]=useState(''); const [busy,setBusy]=useState(true);
  const sync=(s: EngineSession) => {const normalized={...s,state:normalizePayoutCycleState(s.state,s.rules)};setSession(normalized);setWorkspaceTitle(normalized.workspaceTitle??normalized.rules.accountName);setPreview(null);};
  useEffect(()=>{let active=true; Promise.all([loadEngineSession(),listEngineWorkspaces()]).then(async ([saved,list])=>{if(!active)return;setSavedWorkspaces(list);if(saved){const normalized={...saved,state:normalizePayoutCycleState(saved.state,saved.rules)};validateState(normalized.state,normalized.rules);sync(normalized);if(normalized.state!==saved.state)await saveEngineSession(normalized);}}).catch(e=>{if(active)setError(String(e));}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
  const calculation=useMemo(()=>{try{return {plan:optimizeCampaign(session.state,session.rules,session.options),error:''};}catch(e){return {plan:null,error:String(e)};}},[session]);
  const plan=calculation.plan, s=session.state;
  const selected=session.selectedPlan?.stateKey===JSON.stringify({state:s,rules:session.rules,options:session.options}) ? session.selectedPlan.action:null;
  const selectedCalculation=useMemo(()=>{try{return {plan:(preview??selected)?previewAlternative(s,session.rules,session.options,(preview??selected)!) : plan,error:''};}catch(e){return {plan:null,error:String(e)};}},[s,session.rules,session.options,preview,selected,plan]);
  const shown=selectedCalculation.plan;
  const points=useMemo(()=>shown?projectionData(s,session.rules,shown,session.options):[],[shown,s,session.rules,session.options]);
  const a=selected?{...selected,hedgeRatioConfigured:selected.hedgeRatio,hedgeRatioEquilibrium:plan?.nextAction?.hedgeRatioEquilibrium??0}:plan?.nextAction;
  const sendToTerminal=()=>{try{const store=useAppStore.getState();if(!a)throw new Error('No next trade.');
    if(!campaigns.some(c=>c.id===s.campaignId))throw new Error('Import a campaign snapshot first. Examples cannot be sent to an unrelated campaign.');
    if(store.limitOrderStatus==='confirmed'||store.limitOrderStatus==='modifying')throw new Error('Cancel or finish the existing order before loading a new draft.');
    store.setActiveCampaign(s.campaignId);store.setCampaignObjective(terminalObjective(s,session.rules,a,s.campaignId));navigate('/');
  }catch(e){setError(String(e));}};
  const commit=async(next: EngineSession) => {setBusy(true);setError('');try{await saveEngineSession(next);sync(next);setNote('Workspace and transition history saved.');}catch(e){setError(String(e));}finally{setBusy(false);}};
  const simulate=async(outcome: Outcome) => {
    try {
      const nextState=outcome==='ACTIVATE' ? activateFunded(s,session.rules) : outcome==='PAYOUT' ? applyPayout(s,session.rules) : a ? transition(s,session.rules,a,outcome,session.options):null;
      if(!nextState) return;
      await commit({...session,state:nextState,history:[...session.history,{id:crypto.randomUUID(),campaignId:s.campaignId,timestamp:new Date().toISOString(),previousState:s,action:outcome==='TP'||outcome==='SL' ? a!:null,outcome,nextState,optimizerVersion:OPTIMIZER_VERSION,rules:session.rules,options:session.options}]});
    }catch(e){setError(String(e));}
  };
  const phaseRules=s.phase==='EVALUATION'?session.rules.evaluation:session.rules.funded;
  const saveNamed=async()=>{setBusy(true);setError('');try{const saved=await saveNamedEngineWorkspace(session,workspaceTitle);sync(saved);setSavedWorkspaces(await listEngineWorkspaces());setNote(`Saved “${saved.workspaceTitle}”.`);}catch(e){setError(String(e));}finally{setBusy(false);}};
  return <div className="campaign-engine-workspace mx-auto max-w-6xl space-y-4 p-5">
    <div className="flex items-start justify-between"><div><div className="section-kicker">Campaign engine · v{OPTIMIZER_VERSION}</div><h1 className="mt-2 text-xl font-semibold">Campaign planner</h1><p className="mt-2 text-xs text-muted">Tell Hedge OS where your account is now. See what the next trade should accomplish. Per-account simulation.</p></div><Link className="border border-line px-3 py-2 text-xs text-muted" to="/settings">Back to Settings</Link></div>
    <div className="flex gap-2"><Button disabled={busy} variant="primary" onClick={()=>setBuilder(true)}>Edit current state</Button></div>
    <Panel title="Current account" eyebrow="Rules + current state" collapsible><div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ['Account',session.rules.accountName],['Provider',session.rules.provider],['Account size',dollars(session.rules.startingBalance)],['Current phase',s.phase.replaceAll('_',' ')],
        ['Current balance',dollars(s.balance)],['MLL room',dollars(getDistanceToMll(s,session.rules))],['Drawdown',phaseRules?`${dollars(phaseRules.maxLoss.amount)} · ${phaseRules.maxLoss.type.replaceAll('_',' ')}`:'—'],['Max contracts',String(phaseRules?.maxContracts??'—')],
        ['Daily loss',phaseRules?.dailyLossLimit?.enabled?dollars(phaseRules.dailyLossLimit.amount):'None'],['Consistency',phaseRules?.consistency?.enabled?`${(phaseRules.consistency.maxLargestDayFraction*100).toFixed(0)}%`:'None'],['Trading days',String(s.tradingDaysCompleted)],['Payout number',String(s.payoutNumber)]
      ].map(([label,value])=><div key={label} className="border border-line bg-black/10 p-3"><div className="text-[10px] uppercase tracking-widest text-muted">{label}</div><div className="mt-2 text-sm font-medium">{value}</div></div>)}</div>
      <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4"><label className="text-xs text-muted">Workspace name<input aria-label="Workspace name" className="field-input mt-1 block w-64" value={workspaceTitle} onChange={e=>setWorkspaceTitle(e.target.value)}/></label><Button disabled={busy} onClick={()=>void saveNamed()}>Save workspace</Button><label className="text-xs text-muted">Load saved<select aria-label="Load saved workspace" className="field-input mt-1 block w-64" disabled={busy||!savedWorkspaces.length} value="" onChange={e=>{const saved=savedWorkspaces.find(x=>x.workspaceId===e.target.value);if(saved){sync(saved);void saveEngineSession(saved);setNote(`Loaded “${saved.workspaceTitle}”.`);}}}><option value="">{savedWorkspaces.length?'Choose a workspace…':'No saved workspaces'}</option>{savedWorkspaces.map(x=><option key={x.workspaceId} value={x.workspaceId}>{x.workspaceTitle}</option>)}</select></label></div>
    </div></Panel>
    {(error || calculation.error) && <p role="alert" className="border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">{error || calculation.error}</p>}
    {note && <p role="status" className="text-xs text-blue-200">{note}</p>}
    {selectedCalculation.error&&<p role="alert" className="text-rose-300">{selectedCalculation.error}</p>}
    {shown&&<>
      <CampaignSummaryCards state={s} rules={session.rules} plan={shown}/>
      <NextTradeRecommendation state={s} rules={session.rules} plan={shown}/>
      <div className="flex flex-wrap items-center gap-3"><Button variant="primary" disabled={busy||!a||Boolean(preview)} onClick={sendToTerminal}>Use in trading terminal</Button><span className="text-xs text-muted">Draft only · choose entry, direction, quantity and timing in the terminal.</span></div>
      {shown.metrics.searchTruncated&&<p className="text-xs text-amber-200" title="The optimizer evaluates a bounded state graph. Recommendations are best among searched paths and are not guaranteed global optima.">⚠ Search bounded — best among searched paths, not a guaranteed global optimum.</p>}
      <div className="grid gap-3 md:grid-cols-2"><OutcomeBranchCard title="If target hits" branch={shown.tpBranch} rules={session.rules} cashObjective={shown.metrics.optimizationObjective==='MAXIMIN_CASH'}/><OutcomeBranchCard title="If loss boundary hits" branch={shown.lossBranch} rules={session.rules} cashObjective={shown.metrics.optimizationObjective==='MAXIMIN_CASH'}/></div>
      <CampaignProjectionChart points={points}/>
      {plan&&<PathExplorer plan={plan} selected={preview??selected} onSelect={setPreview}/>}
      <div className="flex flex-wrap items-center gap-3 text-xs"><span>{preview?'Preview only':selected?'User-selected first trade':'Recommended path'} · {shown.projectedPath.length} projected days · {dollars(shown.metrics.peakWorkingCapital)} peak capital · {dollars(shown.metrics.projectedPayout)} net payout</span>{preview&&<Button onClick={()=>void commit({...session,selectedPlan:{action:preview,stateKey:JSON.stringify({state:s,rules:session.rules,options:session.options})}})}>Use this path</Button>}{selected&&<Button onClick={()=>void commit({...session,selectedPlan:undefined})}>Restore recommendation</Button>}</div>
      <ProjectedPathTimeline state={s} plan={shown}/>
      <details className="engine-details border border-line text-xs"><summary>Simulation controls & assumptions</summary><div className="engine-details-body"><p className="mb-3 text-muted">These actions change the saved planning state only, not the campaign ledger or broker orders.</p><div className="flex flex-wrap gap-2">{a&&<><Button disabled={busy||Boolean(preview)} onClick={()=>void simulate('TP')}>Simulate TP day</Button><Button disabled={busy||Boolean(preview)} onClick={()=>void simulate('SL')}>Simulate SL / DLL day</Button></>}{s.phase==='PASSED_EVAL'&&<Button onClick={()=>void simulate('ACTIVATE')}>Activate funded</Button>}{isPayoutEligible(s,session.rules)&&<Button onClick={()=>void simulate('PAYOUT')}>Simulate payout</Button>}</div>{shown.warnings.map(w=><p className="mt-3 text-amber-200/80" key={w}>{w}</p>)}</div></details>
    </>}
    {builder&&<StateBuilderDrawer session={session} onClose={()=>setBuilder(false)} onApply={async next=>{await saveEngineSession(next);sync(next);setNote('State saved and path calculated.');}}/>}
  </div>;
}
