import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";

export function AppShell(){
  return <div className="flex h-screen min-h-[720px] flex-col bg-canvas text-slate-200"><TopBar/><main className="min-h-0 flex-1 overflow-auto"><Outlet/></main><footer className="flex h-6 shrink-0 items-center justify-between border-t border-line bg-surface px-3 font-mono text-[9px] text-slate-600"><span>LOCAL-FIRST · UI FOUNDATION</span><span>v0.1.0</span></footer></div>;
}
