import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { label: string; children: ReactNode; }
export function IconButton({ label, className, children, type = "button", ...props }: IconButtonProps) {
  return <button type={type} aria-label={label} title={label} className={cn("grid size-8 place-items-center border border-transparent text-muted transition-colors hover:border-line hover:bg-raised hover:text-slate-100", className)} {...props}>{children}</button>;
}
