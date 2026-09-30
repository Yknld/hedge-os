import type { AccountRules } from '../../lib/campaignEngine/types';
import { Button } from '../ui/Button';

export function NumberField({label,value,onChange,percent=false}:{label:string;value:number|undefined;onChange:(n:number)=>void;percent?:boolean}) {
  return <label className="block text-xs text-muted">{label}{percent?' (%)':''}<input type="number" step="any" required className="field-input mt-1 w-full" value={value===undefined||!Number.isFinite(value)?'':percent?Number((value*100).toFixed(8)):value} onChange={e=>onChange(e.target.value===''?NaN:Number(e.target.value)/(percent?100:1))}/></label>;
}
export function CustomRuleBuilder({rules:r,onChange}:{rules:AccountRules;onChange:(r:AccountRules)=>void}) {
  const set=(path:string,value:unknown)=>{const next=structuredClone(r);let target=next as unknown as Record<string,unknown>;const keys=path.split('.');for(const k of keys.slice(0,-1)){target[k]??={};target=target[k] as Record<string,unknown>;}target[keys.at(-1)!]=value;onChange(next);};
  const num=(label:string,path:string,value:number|undefined,percent=false)=><NumberField label={label} value={value} percent={percent} onChange={n=>set(path,n)}/>;
  const toggle=(label:string,path:string,value:boolean)=><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value} onChange={e=>set(path,e.target.checked)}/>{label}</label>;
  const select=(label:string,path:string,value:string,choices:string[])=><label className="text-xs text-muted">{label}<select className="field-input mt-1 w-full" value={value} onChange={e=>set(path,e.target.value==='LEGACY_WINDOW'?undefined:e.target.value)}>{choices.map(c=><option key={c} value={c}>{c.replaceAll('_',' ')}</option>)}</select></label>;
  const phase=(key:'evaluation'|'funded')=>{const p=r[key];if(!p)return null;return <fieldset className="space-y-3 border border-line p-3"><legend className="section-kicker">{key}</legend><div className="grid grid-cols-2 gap-3">
    {key==='evaluation'&&num('Profit target','evaluation.profitTarget',r.evaluation?.profitTarget)}
    {num('Maximum contracts',`${key}.maxContracts`,p.maxContracts)}
    {select('Drawdown type',`${key}.maxLoss.type`,p.maxLoss.type,['STATIC','EOD_TRAILING','INTRADAY_TRAILING'])}
    {num('Drawdown amount',`${key}.maxLoss.amount`,p.maxLoss.amount)}
    {p.maxLoss.type!=='STATIC'&&toggle('Trail lock enabled',`${key}.maxLoss.locks`,p.maxLoss.locks)}
    {p.maxLoss.locks&&<>{num('Lock trigger balance',`${key}.maxLoss.lockTriggerBalance`,p.maxLoss.lockTriggerBalance)}{num('Locked floor',`${key}.maxLoss.lockedFloor`,p.maxLoss.lockedFloor)}</>}
    {toggle('Daily loss limit enabled',`${key}.dailyLossLimit.enabled`,p.dailyLossLimit?.enabled??false)}
    {p.dailyLossLimit?.enabled&&num('Daily loss amount',`${key}.dailyLossLimit.amount`,p.dailyLossLimit.amount)}
    {toggle('Consistency enabled',`${key}.consistency.enabled`,p.consistency?.enabled??false)}
    {p.consistency?.enabled&&<>{num('Consistency limit',`${key}.consistency.maxLargestDayFraction`,p.consistency.maxLargestDayFraction,true)}{select('Consistency denominator',`${key}.consistency.denominator`,p.consistency.denominator??'LEGACY_WINDOW',['LEGACY_WINDOW','TOTAL_ACCOUNT_PROFIT','CURRENT_PAYOUT_CYCLE_PROFIT','PROFIT_SINCE_LAST_PAYOUT','WITHDRAWABLE_PROFIT'])}</>}
    {key==='evaluation'&&num('Minimum trading days','evaluation.minimumTradingDays',r.evaluation?.minimumTradingDays??0)}
    </div>{p.maxLoss.type==='INTRADAY_TRAILING'&&<p className="text-xs text-amber-200">Unlocked intraday trails cannot be planned without intratrade price paths. The existing engine will not recommend a trade.</p>}</fieldset>;};
  const p=r.funded.payout;
  return <div className="space-y-4"><fieldset className="grid grid-cols-2 gap-3 border border-line p-3"><legend className="section-kicker">Account rules</legend>
    {num('Starting balance','startingBalance',r.startingBalance)}{num('Evaluation fee','evaluationFee',r.evaluationFee)}{num('Activation fee','activationFee',r.activationFee)}
    <label className="text-xs text-muted">Account name<input className="field-input mt-1 w-full" value={r.accountName} onChange={e=>set('accountName',e.target.value)}/></label>
    <label className="text-xs"><input type="checkbox" checked={Boolean(r.evaluation?.enabled)} onChange={e=>set('evaluation',e.target.checked?{enabled:true,profitTarget:3000,maxLoss:structuredClone(r.funded.maxLoss),maxContracts:r.funded.maxContracts}:undefined)}/> Evaluation enabled</label>
  </fieldset>{r.evaluation?.enabled&&phase('evaluation')}{phase('funded')}
  <fieldset className="space-y-3 border border-line p-3"><legend className="section-kicker">Funded scaling plan</legend>{(r.funded.scalingPlan??[]).map((t,i)=><div key={i} className="grid grid-cols-3 gap-2"><NumberField label="From profit" value={t.minimumProfit} onChange={v=>set(`funded.scalingPlan.${i}.minimumProfit`,v)}/><NumberField label="Max contracts" value={t.maxContracts} onChange={v=>set(`funded.scalingPlan.${i}.maxContracts`,v)}/><Button onClick={()=>set('funded.scalingPlan',r.funded.scalingPlan!.filter((_,j)=>j!==i))}>Remove tier</Button></div>)}<Button onClick={()=>set('funded.scalingPlan',[...(r.funded.scalingPlan??[]),{minimumProfit:0,maxContracts:1}])}>Add scaling tier</Button><p className="text-xs text-muted">Each tier applies from its minimum profit until the next tier (existing upper bounds are retained).</p></fieldset>
  <fieldset className="space-y-3 border border-line p-3"><legend className="section-kicker">Payout</legend><div className="grid grid-cols-2 gap-3">
    <label className="text-xs text-muted">Payout model<select className="field-input mt-1 w-full" value={p.model??'PROFIT_CONVERSION'} onChange={e=>onChange({...r,funded:{...r.funded,payout:{...p,model:e.target.value as typeof p.model,bufferedSurplus:p.bufferedSurplus??{bufferAboveStartingBalance:2100,bufferIsProtected:true,payoutReducesBalance:true}}}})}><option>PROFIT_CONVERSION</option><option>BUFFERED_SURPLUS</option></select></label>
    {select('Payout frequency','funded.payout.frequency',p.frequency,['DAILY','N_DAYS'])}
    {p.frequency==='N_DAYS'&&<>{num('Payout interval days','funded.payout.requiredDays',p.requiredDays??1)}{num('Interval minimum profit/day','funded.payout.minimumProfitPerDay',p.minimumProfitPerDay??0)}</>}
    {num('Qualifying days required','funded.minimumProfitDays.requiredDays',r.funded.minimumProfitDays?.requiredDays??0)}
    {(r.funded.minimumProfitDays?.requiredDays??0)>0&&num('Minimum winning day','funded.minimumProfitDays.minimumProfitPerDay',r.funded.minimumProfitDays?.minimumProfitPerDay??0)}
    {num('Trader profit share','funded.payout.profitShare',p.profitShare,true)}
    {p.model!=='BUFFERED_SURPLUS'&&num('Balance conversion rate','funded.payout.payoutConversionRate',p.payoutConversionRate??1,true)}
    {num(`Minimum payout (${p.model==='BUFFERED_SURPLUS'?'net':'gross'})`,'funded.payout.minimumPayout',p.minimumPayout??0)}
    <label className="text-xs"><input type="checkbox" checked={p.defaultCap!==undefined} onChange={e=>set('funded.payout.defaultCap',e.target.checked?1000:undefined)}/> Default payout cap enabled</label>
    {p.defaultCap!==undefined&&num('Default payout cap','funded.payout.defaultCap',p.defaultCap)}
    {p.model==='BUFFERED_SURPLUS'&&<><NumberField label="Buffer balance" value={p.bufferedSurplus?.bufferBalance??r.startingBalance+(p.bufferedSurplus?.bufferAboveStartingBalance??0)} onChange={v=>set('funded.payout.bufferedSurplus',{...p.bufferedSurplus,bufferBalance:v,bufferAboveStartingBalance:undefined})}/>{toggle('Buffer is protected','funded.payout.bufferedSurplus.bufferIsProtected',p.bufferedSurplus?.bufferIsProtected??true)}{toggle('Payout reduces PA balance','funded.payout.bufferedSurplus.payoutReducesBalance',p.bufferedSurplus?.payoutReducesBalance??true)}</>}
    {toggle('Reset qualifying days after payout','funded.payout.qualifyingDaysResetAfterPayout',p.qualifyingDaysResetAfterPayout)}
    {toggle('Reset cycle profit after payout','funded.payout.cycleProfitResets',p.cycleProfitResets??false)}
    {r.funded.consistency?.enabled&&toggle('Reset consistency after payout','funded.consistency.resetsAfterPayout',r.funded.consistency.resetsAfterPayout??p.consistencyResetsAfterPayout??false)}
  </div><div className="space-y-2">{(p.capsByPayoutNumber??[]).map((cap,i)=><div key={i} className="flex items-end gap-2"><NumberField label={`Payout #${i+1} cap`} value={cap} onChange={v=>set(`funded.payout.capsByPayoutNumber.${i}`,v)}/><Button onClick={()=>set('funded.payout.capsByPayoutNumber',p.capsByPayoutNumber!.filter((_,j)=>i!==j))}>Remove</Button></div>)}<Button onClick={()=>set('funded.payout.capsByPayoutNumber',[...(p.capsByPayoutNumber??[]),p.defaultCap??1000])}>Add payout cap</Button></div></fieldset></div>;
}
