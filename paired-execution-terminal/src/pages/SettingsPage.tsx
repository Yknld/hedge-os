import { ExternalLink, FileText, Link2, Monitor, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { subscribeTradingViewBridge, syncExtensionTheme, type TradingViewBridgeState } from "../lib/tradingViewBridge";
import { LegalDocumentDialog } from "../components/legal/LegalDocumentDialog";
import { hasTermsConsent, hasTradingRiskConsent, type LegalDocumentId } from "../lib/legal";

// Temporary local customer portal. Replace this one value with the deployed
// landing-page account URL when that portal goes live.
const accountPortalUrl = 'http://localhost:3000/account';

function AdapterStatus({ name, ready, description }: { name: string; ready: boolean; description: string }) {
  return <div className="flex items-start gap-3">
    <Link2 className="mt-0.5 size-4 shrink-0 text-muted" />
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-200">{name}</div>
        <span className={`shrink-0 border px-2 py-1 font-mono text-[9px] ${ready ? 'border-emerald-500/30 text-emerald-300' : 'border-line text-slate-500'}`}>{ready ? 'READY' : 'NOT READY'}</span>
      </div>
      <div className="mt-1 text-[10px] text-muted">{description}</div>
    </div>
  </div>;
}

export function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = (location.state as { from?: string } | null)?.from;
  const [bridge,setBridge]=useState<TradingViewBridgeState>({relayConnected:false,extensionConnected:false,tradingViewReady:false,tradingViewSymbol:null,lastMessage:'Bridge disconnected'});
  const [mismatchSeconds,setMismatchSeconds]=useState(()=>localStorage.getItem('hedge-os:leg-mismatch-seconds')??'5');
  const [hedgeTimeoutMs,setHedgeTimeoutMs]=useState(()=>localStorage.getItem('hedge-os:hedge-completion-timeout-ms')??'5000');
  const [hedgeGuardPoints,setHedgeGuardPoints]=useState(()=>localStorage.getItem('hedge-os:hedge-catastrophic-guard-points')??'5');
  const [hedgeCompletionPercent,setHedgeCompletionPercent]=useState(()=>localStorage.getItem('hedge-os:hedge-completion-threshold-percent')??'98');
  const [contractLimitGuard,setContractLimitGuard]=useState(()=>localStorage.getItem('hedge-os:contract-limit-guard')!=='off');
  const [theme,setTheme]=useState<'charcoal'|'ivory'>(()=>localStorage.getItem('hedge-os:theme')==='ivory'?'ivory':'charcoal');
  const [legalDocument,setLegalDocument]=useState<LegalDocumentId|null>(null);
  const [termsAccepted,setTermsAccepted]=useState(()=>hasTermsConsent());
  const [riskAccepted,setRiskAccepted]=useState(()=>hasTradingRiskConsent());
  useEffect(()=>subscribeTradingViewBridge(setBridge),[]);
  useEffect(()=>{document.documentElement.dataset.theme=theme==='ivory'?'ivory':'';localStorage.setItem('hedge-os:theme',theme);syncExtensionTheme();},[theme]);
  return <div className="settings-workspace mx-auto w-full max-w-5xl p-4">
    <div className="mb-4 flex items-start justify-between">
      <div>
        <div className="section-kicker">Application</div>
        <h2 className="mt-1 text-base font-semibold text-slate-100">Settings</h2>
        <p className="mt-1 text-xs text-muted">Local display and workspace preferences.</p>
      </div>
      <button type="button" onClick={() => navigate(returnTo && returnTo !== "/settings" ? returnTo : "/campaigns", { replace: true })} aria-label="Close settings" title="Close settings" className="grid size-8 place-items-center border border-line bg-raised text-slate-400 transition-colors hover:border-slate-500 hover:text-white">
        <X className="size-4"/>
      </button>
    </div>
    <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
      <div className="space-y-3">
      <Panel title="Appearance" eyebrow="Display">
        <div className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <Monitor className="mt-0.5 size-4 text-muted"/>
            <div className="flex-1"><div className="text-xs text-slate-200">Theme</div><div className="mt-1 text-[10px] text-muted">{theme==='ivory'?'Warm ivory surfaces with soft stone borders.':'Neutral charcoal surfaces with subtle gray borders.'}</div></div>
            <div role="group" aria-label="Theme" className="inline-flex shrink-0 border border-line bg-canvas p-0.5">
              <button type="button" aria-pressed={theme==='charcoal'} onClick={()=>setTheme('charcoal')} className={`px-2 py-1 font-mono text-[10px] transition-colors ${theme==='charcoal'?'bg-raised text-slate-100':'text-muted hover:text-slate-200'}`}>CHARCOAL</button>
              <button type="button" aria-pressed={theme==='ivory'} onClick={()=>setTheme('ivory')} className={`px-2 py-1 font-mono text-[10px] transition-colors ${theme==='ivory'?'bg-raised text-slate-100':'text-muted hover:text-slate-200'}`}>IVORY</button>
            </div>
          </div>
        </div>
      </Panel>
      <Panel title="Campaign state machine" eyebrow="Campaign engine">
        <div className="p-4">
          <p className="text-xs leading-5 text-muted">Inspect account rules and current state, calculate the next target and hedge ratio, and simulate TP, loss, and payout paths.</p>
          <Button className="mt-4" onClick={() => navigate('/settings/campaign-engine')}>Open Campaign Engine</Button>
        </div>
      </Panel>
      <Panel title="Legal documents" eyebrow="Privacy & terms">
        <div className="divide-y divide-line">
          <div className="flex gap-3 p-4"><FileText className="mt-0.5 size-4 shrink-0 text-muted"/><div><div className="text-xs text-slate-200">Privacy policy</div><p className="mt-1 text-[10px] leading-4 text-muted">Data, extension access, local processing, retention, and third-party platforms.</p><Button className="mt-3" onClick={()=>setLegalDocument('privacy')}>Read policy</Button></div></div>
          <div className={`flex gap-3 p-4 ${termsAccepted?'':'animate-pulse bg-amber-500/[0.06]'}`}><FileText className={`mt-0.5 size-4 shrink-0 ${termsAccepted?'text-muted':'text-amber-300'}`}/><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div className="text-xs text-slate-200">Terms of service</div><span className={`border px-1.5 py-0.5 font-mono text-[8px] ${termsAccepted?'border-emerald-500/30 text-emerald-300':'border-amber-500/40 text-amber-300'}`}>{termsAccepted?'ACCEPTED':'ACTION REQUIRED'}</span></div><p className="mt-1 text-[10px] leading-4 text-muted">Service scope, third-party platforms, user responsibility, and liability terms.</p><Button className="mt-3" onClick={()=>setLegalDocument('terms')}>{termsAccepted?'Review terms':'Review & agree'}</Button></div></div>
          <div className={`flex gap-3 p-4 ${riskAccepted?'':'animate-pulse bg-rose-500/[0.07]'}`}><ShieldAlert className={`mt-0.5 size-4 shrink-0 ${riskAccepted?'text-muted':'text-rose-300'}`}/><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div className="text-xs text-slate-200">Trading risk acknowledgment</div><span className={`border px-1.5 py-0.5 font-mono text-[8px] ${riskAccepted?'border-emerald-500/30 text-emerald-300':'border-rose-500/40 text-rose-300'}`}>{riskAccepted?'ACCEPTED':'ACTION REQUIRED'}</span></div><p className="mt-1 text-[10px] leading-4 text-muted">Required before a live order pair can be armed.</p><Button className="mt-3" onClick={()=>setLegalDocument('risk')}>{riskAccepted?'Review acknowledgment':'Review & acknowledge'}</Button></div></div>
        </div>
      </Panel>
      </div>
      <div className="space-y-3">
      <Panel title="Account" eyebrow="Workspace">
        <div className="flex items-center justify-between gap-4 p-4">
          <div><div className="text-xs text-slate-200">Manage account</div><p className="mt-1 mb-0 text-[10px] leading-4 text-muted">Subscription, downloads, and account details will live in the customer portal.</p></div>
          <a href={accountPortalUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 shrink-0 items-center gap-2 border border-line bg-raised px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800">Manage <ExternalLink className="size-3"/></a>
        </div>
      </Panel>
      <Panel title="Data & execution" eyebrow="Integrations" className="h-full">
        <div className="space-y-4 p-4">
          <AdapterStatus name="TradingView prop adapter" ready={bridge.tradingViewReady} description={bridge.tradingViewReady ? 'Prop connection is ready.' : bridge.extensionConnected ? 'Extension connected; TradingView is not ready.' : 'Extension disconnected.'} />
          <div className="border-t border-line pt-4">
            <AdapterStatus name="Ironbeam hedge adapter" ready={Boolean(bridge.ironbeamReady)} description={bridge.ironbeamReady ? 'Hedge connections are ready.' : bridge.ironbeamError ?? (bridge.ironbeamDetected ? 'Ironbeam detected; waiting for hedge connections to be ready.' : 'Open trade.ironbeam.com to connect the hedge account.')} />
          </div>
          <label className="block border-t border-line pt-4 text-xs text-muted">Leg mismatch timeout · seconds<input className="field-input mt-1 font-mono" inputMode="numeric" value={mismatchSeconds} onChange={(event)=>setMismatchSeconds(event.target.value)} onBlur={()=>{const value=Math.max(1,Math.min(30,Math.round(Number(mismatchSeconds)||5)));setMismatchSeconds(String(value));localStorage.setItem('hedge-os:leg-mismatch-seconds',String(value));}}/><span className="mt-1 block text-[9px]">Starts only after the first leg fills. Range: 1–30 seconds.</span></label>
          <label className="block border-t border-line pt-4 text-xs text-muted">Hedge completion timeout · milliseconds<input className="field-input mt-1 font-mono" inputMode="numeric" value={hedgeTimeoutMs} onChange={(event)=>setHedgeTimeoutMs(event.target.value)} onBlur={()=>{const value=Math.max(500,Math.min(10000,Math.round(Number(hedgeTimeoutMs)||5000)));setHedgeTimeoutMs(String(value));localStorage.setItem('hedge-os:hedge-completion-timeout-ms',String(value));}}/><span className="mt-1 block text-[9px]">Reconciliation starts after an actual MNQ prop fill. Default: 5,000 ms. Range: 500–10,000 ms.</span></label>
          <label className="block border-t border-line pt-4 text-xs text-muted">Catastrophic hedge guard · points<input className="field-input mt-1 font-mono" inputMode="decimal" value={hedgeGuardPoints} onChange={(event)=>setHedgeGuardPoints(event.target.value)} onBlur={()=>{const value=Math.max(1,Math.min(20,Number(hedgeGuardPoints)||5));const normalized=String(Number(value.toFixed(2)));setHedgeGuardPoints(normalized);localStorage.setItem('hedge-os:hedge-catastrophic-guard-points',normalized);}}/><span className="mt-1 block text-[9px]">Places broker-side MNQ/NNQ exits this many points beyond the prop TP/SL. Hedge OS still exits first when the prop closes. Range: 1–20 points.</span></label>
          <label className="block text-xs text-muted">Directional hedge completion · percent<input className="field-input mt-1 font-mono" inputMode="decimal" value={hedgeCompletionPercent} onChange={(event)=>setHedgeCompletionPercent(event.target.value)} onBlur={()=>{const value=Math.max(1,Math.min(100,Number(hedgeCompletionPercent)||98));const normalized=String(Number(value.toFixed(2)));setHedgeCompletionPercent(normalized);localStorage.setItem('hedge-os:hedge-completion-threshold-percent',normalized);}}/><span className="mt-1 block text-[9px]">98% counts only live exposure aligned with the required hedge direction.</span></label>
          <label className="flex cursor-pointer items-start gap-3 border-t border-line pt-4">
            <input type="checkbox" checked={contractLimitGuard} onChange={(event)=>{const enabled=event.target.checked;setContractLimitGuard(enabled);localStorage.setItem('hedge-os:contract-limit-guard',enabled?'on':'off');}} className="mt-0.5 size-3.5 accent-blue-400"/>
            <span><span className="block text-xs text-slate-200">Provider contract-limit guard</span><span className="mt-1 block text-[10px] leading-4 text-muted">Blocks an order that exceeds the active account’s evaluation or funded scaling tier. Turn off only after independently confirming that provider rules changed.</span></span>
          </label>
        </div>
      </Panel>
      </div>
    </div>
    {legalDocument&&<LegalDocumentDialog documentId={legalDocument} requireConsent={legalDocument==='terms'||legalDocument==='risk'} onAccepted={()=>{if(legalDocument==='terms')setTermsAccepted(true);if(legalDocument==='risk')setRiskAccepted(true);}} onClose={()=>setLegalDocument(null)}/>} 
  </div>;
}
