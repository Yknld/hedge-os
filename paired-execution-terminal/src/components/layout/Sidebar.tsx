import { ChevronLeft, CreditCard, Flag, Settings, TerminalSquare } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useAppStore } from "../../store/useAppStore";
import { IconButton } from "../ui/IconButton";
import { StatusDot } from "../ui/StatusDot";

const navigation=[
  {to:"/",label:"Terminal",icon:TerminalSquare,end:true},
  {to:"/campaigns",label:"Campaigns",icon:Flag},
  {to:"/settings",label:"Settings",icon:Settings},
  {to:"/account",label:"Account",icon:CreditCard},
];

export function Sidebar(){
  const location=useLocation();
  const collapsed=useAppStore(s=>s.sidebarCollapsed);const toggle=useAppStore(s=>s.toggleSidebar);
  return <aside className={cn("flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-150",collapsed?"w-14":"w-52")}>
    <div className="flex h-12 items-center border-b border-line px-3">
      <img src="/brand/hedge-os-logo-blue.png" alt="Hedge OS" className="size-8 shrink-0 object-contain"/>
      {!collapsed&&<div className="ml-2.5 min-w-0"><div className="truncate text-xs font-bold tracking-wide text-slate-100">HEDGE OS</div><div className="text-[9px] uppercase tracking-[0.18em] text-slate-600">Paired execution</div></div>}
    </div>
    <nav className="flex-1 space-y-1 p-2">{navigation.map(({to,label,icon:Icon,end})=><NavLink key={to} to={to} state={to==="/settings"?{from:`${location.pathname}${location.search}`}:undefined} end={end} title={collapsed?label:undefined} className={({isActive})=>cn("flex h-8 items-center gap-2.5 border-l-2 px-2 text-xs transition-colors",isActive?"border-accent bg-blue-400/[0.07] text-slate-100":"border-transparent text-muted hover:bg-raised hover:text-slate-200")}><Icon className="size-3.5 shrink-0"/>{!collapsed&&<span>{label}</span>}</NavLink>)}</nav>
    <div className="border-t border-line p-2">
      {!collapsed&&<div className="mb-2 flex items-center gap-2 px-2 py-1.5 text-[10px] text-muted"><StatusDot status="offline"/><span>Services disconnected</span></div>}
      <IconButton label={collapsed?"Expand sidebar":"Collapse sidebar"} onClick={toggle} className={cn(!collapsed&&"w-full justify-end")}><ChevronLeft className={cn("size-3.5 transition-transform",collapsed&&"rotate-180")}/></IconButton>
    </div>
  </aside>;
}
