import { useEffect, useRef, useState } from 'react';
import type { EngineSession } from '../../lib/campaignEngine/persistence';
import type { CampaignState, AccountRules } from '../../lib/campaignEngine/types';
import { PLANNER_PRESETS } from '../../lib/campaignEngine/presets';
import { createState, normalizePayoutCycleState, reconcileBalanceEdit, validateState } from '../../lib/campaignEngine/state';
import { optimizeCampaign } from '../../lib/campaignEngine/optimizer';
import { getBufferBalance,getWithdrawableSurplus,getPayoutTargetBalance,getRemainingEvalTarget,getRemainingDllRoom,getCurrentMaxContracts,getMaximumAvailablePayout,phaseRules } from '../../lib/campaignEngine/rules';
import { stateFields,money,rate,payoutCapLabel,payoutUnits } from '../../lib/campaignEngine/planner';
import { CustomRuleBuilder,NumberField } from './CustomRuleBuilder';
import { Button } from '../ui/Button';

export function StateBuilderDrawer({session,onClose,onApply}:{session:EngineSession;onClose:()=>void;onApply:(s:EngineSession)=>Promise<void>}) {
  const [draft,setDraft]=useState(()=>({...structuredClone(session),state:normalizePayoutCycleState(structuredClone(session.state),session.rules)})),[custom,setCustom]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const drawer=useRef<HTMLDivElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;drawer.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const nodes=drawer.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};},[onClose]);
  const {state:s,rules:r}=draft,pr=phaseRules(s,r),p=r.funded.payout;
  const update=(key:keyof CampaignState,value:unknown)=>setDraft(d=>({...d,state:key==='balance' ? reconcileBalanceEdit(d.state,d.rules,value as number):{...d.state,[key]:value}}));
  const load=(rules:AccountRules,state:CampaignState)=>setDraft(d=>{
    const phase=d.state.phase;
    // Account selection follows phase selection, so retain a funded/cycle choice.
    const next=state.phase!==phase&&(phase==='FUNDED'||phase==='PAYOUT_CYCLE')
      ? {...createState(rules,state.campaignId,'FUNDED'),phase}:structuredClone(state);
    return {...d,workspaceId:undefined,workspaceTitle:undefined,rules:structuredClone(rules),state:normalizePayoutCycleState(next,rules),selectedPlan:undefined};
  });
  const setRules=(rules:AccountRules)=>setDraft(d=>({...d,rules,state:{...d.state,startingBalance:rules.startingBalance}}));
  const submit=async()=>{setError('');try{
    // Reject malformed user-entered numbers before serialization (JSON turns NaN into null).
    const check=(x:unknown):void=>{if(typeof x==='number'&&(!Number.isFinite(x)))throw new Error('Complete all numeric fields with valid numbers.');if(x&&typeof x==='object')Object.values(x).forEach(check);};check(draft.rules);check(draft.state);
    const normalizedRules={...r,funded:{...r.funded,minimumProfitDays:r.funded.minimumProfitDays?{...r.funded.minimumProfitDays,minimumProfitPerDay:r.funded.minimumProfitDays.minimumProfitPerDay??0}:undefined}};
    const nonnegative=(n:number|undefined,label:string,integer=false)=>{if(n!==undefined&&(n<0||(integer&&!Number.isInteger(n))))throw new Error(`${label} must be a nonnegative ${integer?'whole number':'amount'}.`);};
    nonnegative(p.minimumPayout,'Minimum payout');nonnegative(p.defaultCap,'Payout cap');p.capsByPayoutNumber?.forEach(n=>nonnegative(n,'Payout cap'));
    nonnegative(p.requiredDays,'Payout days',true);nonnegative(r.evaluation?.minimumTradingDays,'Evaluation days',true);nonnegative(r.funded.minimumProfitDays?.requiredDays,'Qualifying days',true);
    for(const tier of r.funded.scalingPlan??[]){if(!Number.isInteger(tier.maxContracts)||tier.maxContracts<1)throw new Error('Scaling contracts must be a positive whole number.');}
    const state={...s,currentMaxContracts:getCurrentMaxContracts(s,normalizedRules),peakWorkingCapital:Math.max(s.peakWorkingCapital,-s.realizedRealCash)};
    validateState(state,normalizedRules);optimizeCampaign(state,normalizedRules,draft.options);setSaving(true);await onApply({...draft,rules:normalizedRules,state,selectedPlan:undefined});onClose();
  }catch(e){setError(String(e));}finally{setSaving(false);}};
  return <div className="fixed inset-0 z-[100] flex justify-end bg-black/60"><div ref={drawer} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="state-builder-title" className="flex h-full w-full max-w-2xl flex-col border-l border-line bg-surface shadow-2xl">
    <header className="flex items-center justify-between border-b border-line p-5"><div><div className="section-kicker">Campaign planner</div><h2 id="state-builder-title" className="mt-1 text-lg">Edit current state</h2></div><Button onClick={onClose}>Close</Button></header>
    <form id="state-builder-form" className="flex-1 space-y-5 overflow-y-auto p-5" onSubmit={e=>{e.preventDefault();void submit();}}>
      <p className="text-xs text-muted">Describe where the account is now. Changes affect this planning workspace, not your live campaign ledger.</p>
      <fieldset><legend className="mb-2 section-kicker">Current phase</legend><div className="flex gap-2">{(['EVALUATION','FUNDED','PAYOUT_CYCLE'] as const).map(phase=><Button key={phase} disabled={phase==='EVALUATION'&&!r.evaluation?.enabled} aria-pressed={s.phase===phase} variant={s.phase===phase?'primary':'secondary'} onClick={()=>{if(phase!==s.phase){const fresh=createState(r,s.campaignId,phase==='EVALUATION'?'EVALUATION':'FUNDED',s.unrecoveredRealBasis);const changed={...fresh,phase,realizedRealCash:s.realizedRealCash,initialRealBasis:s.initialRealBasis,peakWorkingCapital:s.peakWorkingCapital};setDraft(d=>({...d,state:normalizePayoutCycleState(changed,r)}));}}}>{phase.replaceAll('_',' ')}</Button>)}</div><p className="mt-2 text-xs text-muted">Choose your phase first. The questions below follow that phase. Changing phase resets its balance and counters; enter your actual values below.</p></fieldset>
      <div className="grid grid-cols-2 gap-3"><label className="text-xs text-muted">Account source<select className="field-input mt-1 w-full" value={custom?'custom':'preset'} onChange={e=>setCustom(e.target.value==='custom')}><option value="preset">Preset account</option><option value="custom">Custom account</option></select></label>
      <label className="text-xs text-muted">Provider<select className="field-input mt-1 w-full" value={r.provider} onChange={e=>{const x=PLANNER_PRESETS.find(x=>x.rules.provider===e.target.value);if(x)load(x.rules,x.state);}}>{[...new Set([r.provider,...PLANNER_PRESETS.map(x=>x.rules.provider)])].map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="text-xs text-muted">Account type / payout plan<select aria-label="Preset account" className="field-input mt-1 w-full" value="" onChange={e=>{const x=PLANNER_PRESETS[Number(e.target.value)];load(x.rules,x.state);}}><option value="">{r.accountName}</option>{PLANNER_PRESETS.map((x,i)=>x.rules.provider===r.provider?<option key={i} value={i}>{x.name}</option>:null)}</select></label>
      <label className="text-xs text-muted">Account size<select className="field-input mt-1 w-full" value={r.startingBalance} onChange={e=>{if(custom)setRules({...r,startingBalance:Number(e.target.value)});else {const x=PLANNER_PRESETS.find(x=>x.rules.provider===r.provider&&x.rules.startingBalance===Number(e.target.value));if(x)load(x.rules,x.state);}}}>{[...new Set(custom?[r.startingBalance,25000,50000,100000,150000]:[r.startingBalance,...PLANNER_PRESETS.filter(x=>x.rules.provider===r.provider).map(x=>x.rules.startingBalance)])].map(n=><option key={n} value={n}>{money(n)}</option>)}</select></label></div>
      <p className="text-xs text-muted">Presets reuse the local account catalog. Review current provider rules before calculating the path.</p>
      {!custom?<Button onClick={()=>setCustom(true)}>Customize rules</Button>:<CustomRuleBuilder rules={r} onChange={setRules}/>}
      <div className="grid grid-cols-2 gap-3">{stateFields(s,r).map(f=><NumberField key={f.key} label={f.label} value={(s[f.key] as number|undefined)??0} onChange={n=>update(f.key,n)}/>)}
      {pr.maxLoss.type!=='STATIC'&&s.phase!=='PAYOUT_CYCLE'&&<label className="text-xs text-muted">Trail status<select className="field-input mt-1 w-full" value={s.trailLocked?'locked':'trailing'} onChange={e=>update('trailLocked',e.target.value==='locked')}><option value="trailing">Trailing</option><option value="locked">Locked</option></select></label>}</div>
      <div className="space-y-2 border border-line p-3 text-xs text-muted">
        <p>Account: {r.accountName} · {money(r.startingBalance)}</p>
        <p>Evaluation price: {money(r.pricing?.currentPrice ?? r.evaluationFee)}{r.pricing?.resetFee!==undefined?` · Reset: ${money(r.pricing.resetFee)}`:''}{r.activationFee===0?' · Free activation':''}</p>
        {r.pricing?.promotionalPrice!==undefined&&<p>Current DLL-on promotion: {money(r.pricing.promotionalPrice)} · Promotional reset: {money(r.pricing.promotionalResetFee ?? r.pricing.resetFee ?? 0)}</p>}
        {r.pricing?.sourceAsOf&&<p>Pricing captured: {r.pricing.sourceAsOf}</p>}
        {s.phase==='EVALUATION'&&<p>Profit target remaining: {money(getRemainingEvalTarget(s,r))}</p>}
        {pr.dailyLossLimit?.enabled&&<p>Daily loss room: {money(getRemainingDllRoom(s,r))}</p>}
        {pr.dailyLossLimit?.dynamicDescription&&<p>DLL rule note: {pr.dailyLossLimit.dynamicDescription}</p>}
        <p>Current maximum contracts (scaling applied): {getCurrentMaxContracts(s,r)}</p>
        {pr.consistency?.enabled&&<p>Consistency limit: {rate(pr.consistency.maxLargestDayFraction)}</p>}
        {s.phase==='PAYOUT_CYCLE'&&pr.maxLoss.type!=='STATIC'&&<p>Trail status: Locked from the completed first-payout phase; the MLL floor no longer trails.</p>}
        {s.phase!=='EVALUATION'&&<>{r.funded.payoutProfitTarget!==undefined&&<p>Payout profit target: {money(r.funded.payoutProfitTarget)}</p>}<p>Payout cap: {payoutCapLabel(s,r)} {payoutUnits(r)} · Available before eligibility checks: {money(getMaximumAvailablePayout(s,r))} {payoutUnits(r)}</p>{r.funded.minimumProfitDays&&<p>Winning day: {money(r.funded.minimumProfitDays.minimumProfitPerDay)} · Required days: {r.funded.minimumProfitDays.requiredDays}</p>}
        {p.model==='BUFFERED_SURPLUS'&&<><p>Protected buffer: {p.bufferedSurplus?.bufferIsProtected?money(getBufferBalance(r)):'Not protected'}</p><p>Current surplus: {money(getWithdrawableSurplus(s,r))} · Distance to buffer: {money(Math.max(0,getBufferBalance(r)-s.balance))}</p><p>Minimum payout profit gap: {money(Math.max(0,getPayoutTargetBalance(s,r)-s.balance))} (consistency and days checked separately)</p></>}</>}
      </div>{error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
    </form><footer className="flex justify-end gap-3 border-t border-line p-4"><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" type="submit" form="state-builder-form" disabled={saving}>{saving?'Saving…':'Calculate path'}</Button></footer>
  </div></div>;
}
