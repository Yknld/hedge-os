import { cn } from "../../lib/cn";
interface NumericValueProps { value: string | number; label?: string; tone?: "neutral"|"positive"|"negative"; suffix?: string; className?: string; }
export function NumericValue({ value, label, tone="neutral", suffix, className }: NumericValueProps) {
  const tones={neutral:"text-slate-100",positive:"text-positive",negative:"text-negative"};
  return <div className={className}>{label && <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{label}</div>}<div className={cn("font-mono text-sm font-medium tabular-nums",tones[tone])}>{value}{suffix && <span className="ml-1 text-[10px] text-muted">{suffix}</span>}</div></div>;
}
