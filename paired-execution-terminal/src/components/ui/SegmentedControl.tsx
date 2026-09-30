import { cn } from "../../lib/cn";
interface Option<T extends string> { label:string; value:T; }
interface Props<T extends string> { options:Option<T>[]; value:T; onChange:(value:T)=>void; label?:string; className?:string; }
export function SegmentedControl<T extends string>({ options,value,onChange,label,className }:Props<T>) {
  return <div role="group" aria-label={label} className={cn("inline-flex border border-line bg-canvas p-0.5",className)}>{options.map(option=><button key={option.value} type="button" aria-pressed={value===option.value} onClick={()=>onChange(option.value)} className={cn("h-6 flex-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",value===option.value?"bg-slate-700 text-white":"text-muted hover:text-slate-200")}>{option.label}</button>)}</div>;
}
