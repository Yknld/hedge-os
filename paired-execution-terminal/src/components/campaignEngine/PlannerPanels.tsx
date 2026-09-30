import type { AccountRules, CampaignRecommendation, CampaignState } from '../../lib/campaignEngine/types';
import { getDistanceToMll, getRemainingEvalTarget, isPayoutEligible, phaseRules } from '../../lib/campaignEngine/rules';
import { money, rate, nextExplanation } from '../../lib/campaignEngine/planner';
import { Panel } from '../ui/Panel';

export function CampaignSummaryCards({state:s,rules:r,plan:p}:{state:CampaignState;rules:AccountRules;plan:CampaignRecommendation}) {
  const cards=s.phase==='PAYOUT_CYCLE' ? [
    ['PA balance',money(s.balance),'Synthetic account equity'],['MLL cushion',money(getDistanceToMll(s,r)),s.trailLocked?'Trail locked':'Trail active'],
    ['Qualifying days',`${s.qualifyingDaysCompleted} / ${r.funded.minimumProfitDays?.requiredDays??0}`,'Winning-day counter'],
    p.metrics.optimizationObjective==='MAXIMIN_CASH'
      ? ['Lowest final cash',money(p.metrics.minimumTerminalCash),p.metrics.outcomeCoverageComplete?'Across resolved payout/failure paths':'Incomplete bounded search']
      : ['Projected net payout',money(p.metrics.projectedPayout),'On the selected success path']
  ] : [['PA balance',money(s.balance),s.phase==='EVALUATION'?`${money(getRemainingEvalTarget(s,r))} to pass`:'Synthetic account equity'],
    ['Drawdown left',money(getDistanceToMll(s,r)),s.trailLocked?'Trail locked':phaseRules(s,r).maxLoss.type.replaceAll('_',' ')],
    ['Unrecovered capital',money(s.unrecoveredRealBasis),`${rate(p.nextAction?.hedgeRatioEquilibrium??0)} equilibrium hedge`],
    ['Projected path',`${p.projectedPath.length} trade days`,`${money(p.metrics.peakWorkingCapital)} peak capital`]];
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([k,v,h])=><div key={k} className="border border-line bg-surface p-4"><div className="section-kicker">{k}</div><div className="my-2 font-mono text-xl">{v}</div><div className="text-xs text-muted">{h}</div></div>)}</div>;
}
export function NextTradeRecommendation({state:s,rules:r,plan:p}:{state:CampaignState;rules:AccountRules;plan:CampaignRecommendation}) {
  const a=p.nextAction;
  return <section className="border border-blue-400/40 bg-surface p-5"><div className="flex justify-between text-xs"><h2 className="section-kicker">Next trade</h2><span className="text-muted">{s.phase.replaceAll('_',' ')} · {s.phase==='PAYOUT_CYCLE'?`Payout #${s.payoutNumber+1} · `:''}Day {s.currentDayNumber}</span></div>
    {a?<><div className="mt-4 grid grid-cols-3 gap-4"><div><div className="text-xs text-muted">TP · PROFIT</div><div className="mt-2 font-mono text-3xl text-blue-200">+{money(a.targetProfit)}</div></div><div><div className="text-xs text-muted">SL · {a.stopLoss<getDistanceToMll(s,r)?'DLL':'MLL'}</div><div className="mt-3 font-mono text-xl text-rose-200">{money(-a.stopLoss)}</div></div><div><div className="text-xs text-muted">HEDGE</div><div className="mt-3 font-mono text-xl">{rate(a.hedgeRatioConfigured)}</div></div></div>
    <p className="mt-4 text-xs tracking-wider text-blue-300">{a.purpose.replaceAll('_',' ')}</p>
    {a.hedgeRatioConfigured!==a.hedgeRatioEquilibrium&&<p className="mt-2 text-xs text-muted">Equilibrium {rate(a.hedgeRatioEquilibrium)} · Configured {rate(a.hedgeRatioConfigured)}</p>}</>:<p className="mt-4 text-sm">{s.phase==='PASSED_EVAL'?'Evaluation passed — activate funded to continue.':isPayoutEligible(s,r)?'Payout ready — no trade needed.':'No supported next trade in this state.'}</p>}
    <EngineExplanation state={s} rules={r} plan={p}/>
  </section>;
}
export function EngineExplanation({state,rules,plan}:{state:CampaignState;rules:AccountRules;plan:CampaignRecommendation}) {
  return <div className="mt-4 border-t border-line pt-3"><h3 className="text-xs font-semibold">Why this objective?</h3><p className="mt-2 text-xs leading-5 text-muted">{nextExplanation(state,rules,plan)}</p></div>;
}
export function OutcomeBranchCard({title,branch:b,rules:r,cashObjective=false}:{title:string;branch:CampaignRecommendation['tpBranch'];rules:AccountRules;cashObjective?:boolean}) {
  return <Panel title={title} eyebrow="One completed trade + end of day"><div className="space-y-2 p-4 text-xs">{b?<>{[
    ['Balance',money(b.resultingState.balance)],['MLL remaining',money(getDistanceToMll(b.resultingState,r))],['Real cash impact',money(b.realCashImpact)],
    ...(cashObjective?[]:[['Unrecovered basis',money(b.resultingState.unrecoveredRealBasis)]]),['Next target',money(b.nextRecommendedAction?.targetProfit)],
    ['Status',b.resultingState.phase==='FAILED'?'Account failed':isPayoutEligible(b.resultingState,r)?'Payout eligible':b.resultingState.trailLocked?'Trail locked':'Trail active'],
  ].map(([k,v])=><div className="flex justify-between gap-3" key={k}><span className="text-muted">{k}</span><b className="font-mono">{v}</b></div>)}</>:<p className="text-muted">No trade branch at this event.</p>}</div></Panel>;
}
export function ProjectedPathTimeline({state:s,plan:p}:{state:CampaignState;plan:CampaignRecommendation}) {
  return <Panel title="Projected path timeline" eyebrow="All targets hit" collapsible defaultOpen={false}><ol className="flex gap-3 overflow-x-auto p-4 text-xs"><li className="min-w-32 border-l-2 border-slate-600 pl-3">Start<div className="mt-2 font-mono">{money(s.balance)}</div></li>{p.projectedPath.map((step,i)=><li key={i} className="min-w-40 border-l-2 border-blue-400 pl-3"><div>Day {i+1}</div><div className="mt-2 font-mono text-emerald-300">TP +{money(step.action.targetProfit)}</div><div className="font-mono text-rose-300">SL {money(-step.action.stopLoss)}</div><div className="mt-2">{rate(step.action.hedgeRatio)} hedge</div><div className="mt-2 text-muted">{money(step.nextState.balance)}</div>{!step.state.trailLocked&&step.nextState.trailLocked&&<div className="mt-2 text-emerald-300">Trail locks</div>}{step.nextState.phase==='PASSED_EVAL'&&<div className="mt-2 text-emerald-300">★ Evaluation passed</div>}</li>)}{p.metrics.projectedPayout>0&&<li className="min-w-40 border-l-2 border-emerald-400 pl-3">★ Payout #{s.payoutNumber+1}<div className="mt-2 font-mono text-emerald-300">+{money(p.metrics.projectedPayout)} net</div></li>}</ol></Panel>;
}
