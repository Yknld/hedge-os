import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; }

export function Button({ className, variant = "secondary", type = "button", ...props }: ButtonProps) {
  const variants: Record<Variant, string> = {
    primary: "border-accent bg-accent text-slate-950 hover:bg-blue-300",
    secondary: "border-line bg-raised text-slate-200 hover:border-slate-500 hover:bg-slate-800",
    danger: "border-rose-800 bg-rose-950/60 text-rose-300 hover:bg-rose-900/70",
    ghost: "border-transparent bg-transparent text-muted hover:bg-raised hover:text-slate-100",
  };
  return <button type={type} className={cn("inline-flex h-8 items-center justify-center gap-2 border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40", variants[variant], className)} {...props} />;
}
