import type { HTMLAttributes, ReactNode } from "react";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

interface PanelProps extends HTMLAttributes<HTMLElement> { title?: string; eyebrow?: string; actions?: ReactNode; collapsible?: boolean; defaultOpen?: boolean; }
export function Panel({ title, eyebrow, actions, className, children, collapsible = false, defaultOpen = true, ...props }: PanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const currentPhaseHeader = title === "Current phase" && eyebrow;
  return (
    <section className={cn("border border-line bg-surface", className)} {...props}>
      {(title || eyebrow || actions) && <header className="flex h-11 items-center justify-between border-b border-line px-3.5">
        {collapsible ? <button type="button" className="flex h-full min-w-0 flex-1 items-center justify-between gap-3 text-left" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen(!open)}><span>{eyebrow && <span className="section-kicker block">{eyebrow}</span>}<span className="block text-xs font-semibold text-slate-200">{title}</span></span><ChevronDown className={cn('size-4 text-muted', open && 'rotate-180')} /></button> : <div>{currentPhaseHeader ? <><div className="section-kicker">Current phase</div><h2 className="text-xs font-semibold text-slate-200">{eyebrow}</h2></> : <>{eyebrow && <div className="section-kicker">{eyebrow}</div>}{title && <h2 className="text-xs font-semibold text-slate-200">{title}</h2>}</>}</div>}
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </header>}
      {collapsible ? <div id={contentId} hidden={!open}>{children}</div> : children}
    </section>
  );
}
