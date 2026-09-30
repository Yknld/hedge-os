import type { CampaignAction, CampaignRecommendation } from '../../lib/campaignEngine/types';
import { money } from '../../lib/campaignEngine/planner';
import { Panel } from '../ui/Panel';
export function PathExplorer({plan,selected,onSelect}:{plan:CampaignRecommendation;selected:CampaignAction|null;onSelect:(a:CampaignAction|null)=>void}) {
  const others=plan.alternatives.filter(x=>x.action.targetProfit!==plan.nextAction?.targetProfit).slice(0,4);
  return <Panel title="Path explorer" eyebrow="Inspect before choosing"><div className="grid gap-2 p-4 md:grid-cols-3 lg:grid-cols-5">
    <PathAlternativeCard label="Recommended" target={plan.nextAction?.targetProfit} selected={!selected} onClick={()=>onSelect(null)} detail={`${plan.projectedPath.map(p=>money(p.action.targetProfit)).join(' → ')} · ${money(plan.metrics.peakWorkingCapital)} peak`}/>
    {others.map(({action})=><PathAlternativeCard key={action.targetProfit} label={action.purpose==='TRAIL_LOCK'?'Trail lock first':action.targetProfit<(plan.nextAction?.targetProfit??0)?'Lower first target':'Higher first target'} target={action.targetProfit} selected={selected?.targetProfit===action.targetProfit} onClick={()=>onSelect(action)} detail="Preview recalculated continuation"/>)}
  </div></Panel>;
}
export function PathAlternativeCard({label,target,selected,onClick,detail}:{label:string;target:number|undefined;selected:boolean;onClick:()=>void;detail:string}) {
  return <button aria-pressed={selected} onClick={onClick} className={`border p-3 text-left text-xs ${selected?'border-blue-400 bg-blue-400/10':'border-line bg-canvas hover:border-slate-500'}`}><div className="text-blue-200">{label}</div><div className="my-2 font-mono text-lg">{money(target)}</div><p className="text-muted">{detail}</p></button>;
}
