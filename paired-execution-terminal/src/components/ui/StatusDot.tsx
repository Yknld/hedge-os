import { cn } from "../../lib/cn";
type Status = "online" | "offline" | "warning" | "idle";
export function StatusDot({ status = "offline", pulse = false }: { status?: Status; pulse?: boolean }) {
  const colors: Record<Status,string> = { online:"bg-positive", offline:"bg-slate-600", warning:"bg-amber-400", idle:"bg-blue-400" };
  return <span aria-label={status} className={cn("inline-block size-1.5 rounded-full", colors[status], pulse && "animate-pulse")} />;
}
