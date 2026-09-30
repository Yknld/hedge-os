import type { CampaignRecommendation } from '../../lib/campaignEngine/types';
import type { EngineSession } from '../../lib/campaignEngine/persistence';
import { Button } from '../ui/Button';
export function AdvancedEnginePanel({editor,onEdit,onApply,plan,session,busy}:{editor:string;onEdit:(v:string)=>void;onApply:()=>void;plan:CampaignRecommendation|null;session:EngineSession;busy:boolean}) {
  const json=(x:unknown)=><pre className="mt-3 max-h-96 overflow-auto text-[10px] text-muted">{JSON.stringify(x,null,2)}</pre>;
  return <div className="space-y-3">
    <details className="border border-line p-4" open><summary>Raw rules & state JSON</summary><p className="my-3 text-xs text-muted">Rates are fractions (0.40 = 40%). Apply validates and saves this workspace.</p><textarea aria-label="Engine rules and state JSON" spellCheck={false} className="h-80 w-full border border-line bg-canvas p-3 font-mono text-xs text-slate-300" value={editor} onChange={e=>onEdit(e.target.value)}/><Button disabled={busy} onClick={onApply}>Apply rules & state</Button></details>
    <details className="border border-line p-4"><summary>Recommendation debug JSON</summary>{json(plan)}</details>
    <details className="border border-line p-4"><summary>Alternatives / ranking</summary>{json(plan?.alternatives)}</details>
    <details className="border border-line p-4"><summary>Search metrics</summary>{json(plan?.metrics)}</details>
    <details className="border border-line p-4"><summary>Engine warnings</summary>{plan?.warnings.map(w=><p className="mt-3 text-xs text-amber-200" key={w}>{w}</p>)}</details>
    <details className="border border-line p-4"><summary>Saved transitions ({session.history.length})</summary>{session.history.slice().reverse().map(t=><details className="mt-2 border border-line p-2 text-xs" key={t.id}><summary>{t.timestamp} · {t.campaignId} · {t.outcome}</summary>{json(t)}</details>)}</details>
  </div>;
}
