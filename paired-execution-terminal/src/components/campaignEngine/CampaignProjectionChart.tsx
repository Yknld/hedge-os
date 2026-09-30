import { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries, LineStyle, createSeriesMarkers, type Time } from 'lightweight-charts';
import type { ProjectionPoint } from '../../lib/campaignEngine/planner';
import { money } from '../../lib/campaignEngine/planner';
import { Button } from '../ui/Button';

export function CampaignProjectionChart({points}:{points:ProjectionPoint[]}) {
  const host=useRef<HTMLDivElement>(null);
  const [mode,setMode]=useState('Both'),[failures,setFailures]=useState(false);
  const ivory=document.documentElement.dataset.theme==='ivory';
  useEffect(()=>{
    if(!host.current) return;
    const labels=new Map(points.map((p,i)=>[i+1,p.label]));
    const chart=createChart(host.current,{autoSize:true,height:270,layout:{background:{color:ivory?'#fffdf8':'#0c0c0c'},textColor:ivory?'#625d55':'#a0a0a0',fontSize:11},
      grid:{vertLines:{color:ivory?'#e4ded4':'#242424'},horzLines:{color:ivory?'#e4ded4':'#242424'}},
      // Reserve space above the bottom-left attribution for series value labels.
      leftPriceScale:{visible:mode!=='PA Equity',borderColor:ivory?'#d5cec2':'#303030',scaleMargins:{top:0.18,bottom:0.25}},rightPriceScale:{visible:mode!=='Real Cash',borderColor:ivory?'#d5cec2':'#303030',scaleMargins:{top:0.18,bottom:0.25}},
      timeScale:{tickMarkFormatter:(t:Time)=>labels.get(Number(t))??'',borderColor:ivory?'#d5cec2':'#303030'},localization:{timeFormatter:(t:Time)=>labels.get(Number(t))??'',priceFormatter:money}});
    const time=(i:number)=>(i+1) as Time;
    if(mode!=='Real Cash') {
      const equity=chart.addSeries(LineSeries,{color:ivory?'#2563a0':'#60a5fa',priceScaleId:'right',title:'PA equity',priceLineVisible:false});
      equity.setData(points.map((p,i)=>({time:time(i),value:p.equity})));
      createSeriesMarkers(equity,points.flatMap((p,i)=>p.marker?[{time:time(i),position:'aboveBar' as const,color:ivory?'#2563a0':'#93c5fd',shape:'circle' as const,size:0,text:p.marker}]:[]));
    }
    if(mode!=='PA Equity') {
      const cash=chart.addSeries(LineSeries,{color:ivory?'#087452':'#34d399',priceScaleId:'left',title:'Real cash',priceLineVisible:false});
      cash.setData(points.map((p,i)=>({time:time(i),value:p.cash})));
      if(mode==='Real Cash') createSeriesMarkers(cash,points.flatMap((p,i)=>p.marker?[{time:time(i),position:'aboveBar' as const,color:ivory?'#087452':'#6ee7b7',shape:'circle' as const,size:0,text:p.marker}]:[]));
      if(failures) points.forEach((p,i)=>{if(p.failureCash===undefined||i===0)return;
        const branch=chart.addSeries(LineSeries,{color:ivory?'#7542a0':'#c084fc88',priceScaleId:'left',lineStyle:LineStyle.Dashed,lineWidth:1,priceLineVisible:false,lastValueVisible:false});
        branch.setData([{time:time(i-1),value:points[i-1].cash},{time:time(i),value:p.failureCash}]);
      });
    }
    chart.timeScale().fitContent();
    return ()=>chart.remove();
  },[points,mode,failures,ivory]);
  return <section className="border border-line bg-surface p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="section-kicker">Campaign P&L projection</h2><div className="flex gap-1">{['PA Equity','Real Cash','Both'].map(v=><Button key={v} aria-pressed={mode===v} variant={mode===v?'primary':'secondary'} onClick={()=>setMode(v)}>{v}</Button>)}</div></div>
    <div ref={host} aria-label="Projected PA equity and real cash chart" role="img" />
    <div className="mt-3 flex flex-wrap justify-between gap-3 text-xs text-muted"><span><span className="text-blue-300">PA equity · right axis</span> / <span className="text-emerald-300">Real cash · left axis</span></span><label><input type="checkbox" checked={failures} onChange={e=>setFailures(e.target.checked)}/> Include immediate loss outcomes</label></div>
    <p className="mt-2 text-xs text-muted">All-target projection, not a probability forecast. Dashed cash branches show one immediate loss; a DLL loss may be nonterminal. PA equity is not withdrawable cash. Purchase costs are already reflected in Start.</p>
    <details className="mt-3 text-xs text-muted"><summary>Projection values & event markers</summary><table className="mt-2 w-full text-left"><thead><tr><th>Step</th><th>PA equity</th><th>Real cash</th><th>Event</th></tr></thead><tbody>{points.map((p,i)=><tr key={i}><td>{p.label}</td><td>{money(p.equity)}</td><td>{money(p.cash)}</td><td>{p.marker??'—'}</td></tr>)}</tbody></table></details>
  </section>;
}
