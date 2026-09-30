import { ArrowLeft, Check, ChevronDown, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  useAppStore,
  type TradingInstrument,
} from "../../store/useAppStore";
import { StatusDot } from "../ui/StatusDot";
import {
  subscribeTradingViewBridge,
  type TradingViewBridgeState,
} from "../../lib/tradingViewBridge";

function StablePrice({ value }: { value: number | null }) {
  const formatted=value?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:8})??'—';
  return <span aria-label={formatted}>{Array.from(formatted).map((character,index)=><span key={index} className="inline-block">{character}</span>)}</span>;
}

/** TradingView reports the active expiry (for example NQU2026); the terminal
 * works with the root contract selected in the ticket. */
function rootSymbol(symbol: string | null | undefined) {
  const matched = String(symbol ?? "").toUpperCase().match(/^(MNQ|NQ|MBT)/);
  return matched?.[1] ?? null;
}

function quoteDisplayPrice(state: TradingViewBridgeState) {
  if (Number.isFinite(state.tradingViewLast)) return Number(state.tradingViewLast);
  const bid = state.tradingViewBid;
  const ask = state.tradingViewAsk;
  if (Number.isFinite(bid) && Number.isFinite(ask)) return (Number(bid) + Number(ask)) / 2;
  if (Number.isFinite(bid)) return Number(bid);
  if (Number.isFinite(ask)) return Number(ask);
  return null;
}

export function TopBar() {
  const location = useLocation();
  const showTerminalStatus = location.pathname === "/";
  const instrument = useAppStore((state) => state.tradingInstrument);
  const setInstrument = useAppStore((state) => state.setTradingInstrument);
  const [contractMenuOpen, setContractMenuOpen] = useState(false);
  const [quoteClock,setQuoteClock]=useState(Date.now());
  const [bridgeState, setBridgeState] = useState<TradingViewBridgeState>({
    relayConnected: false,
    extensionConnected: false,
    tradingViewReady: false,
    tradingViewSymbol: null,
    lastMessage: "Bridge disconnected",
  });

  useEffect(() => {
    if (instrument === "MBT") setInstrument("MNQ");
  }, [instrument, setInstrument]);

  useEffect(() => subscribeTradingViewBridge(setBridgeState), []);
  // The connected prop chart is authoritative for the active prop contract.
  // This also clears an old hot-reload MNQ selection once an NQ chart reports.
  useEffect(() => {
    const liveContract = rootSymbol(bridgeState.tradingViewSymbol);
    if ((liveContract === "NQ" || liveContract === "MNQ") && liveContract !== instrument) {
      setInstrument(liveContract);
    }
  }, [bridgeState.tradingViewSymbol, instrument, setInstrument]);
  useEffect(()=>{const timer=window.setInterval(()=>setQuoteClock(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  const quoteMatches=rootSymbol(bridgeState.tradingViewSymbol)===instrument;
  // TradingView is the sole source for the prop/chart price. Prefer its last
  // trade, then its live bid/ask if the chart legend is temporarily unavailable.
  const displayPrice=quoteMatches ? quoteDisplayPrice(bridgeState) : null;
  const quoteFresh=quoteMatches&&Boolean(bridgeState.quoteUpdatedAt)&&quoteClock-Number(bridgeState.quoteUpdatedAt)<2500;

  const propConnectionStatus = bridgeState.tradingViewReady
    ? "online"
    : bridgeState.relayConnected || bridgeState.extensionConnected
      ? "warning"
      : "offline";
  const hedgeConnectionStatus = bridgeState.ironbeamReady
    ? "online"
    : bridgeState.ironbeamDetected || bridgeState.extensionConnected
      ? "warning"
      : "offline";
  const hedgeConnectionTitle = bridgeState.ironbeamReady
    ? `Ironbeam connected${bridgeState.ironbeamBoundTabs?.length ? ` · ${bridgeState.ironbeamBoundTabs.length}/${bridgeState.ironbeamBoundTabs.length} hedge connections ready` : ''}`
    : bridgeState.ironbeamError || (bridgeState.ironbeamDetected ? 'Ironbeam detected but not ready' : 'Ironbeam disconnected');

  return (
    <header className="relative z-[100] flex h-14 shrink-0 items-center justify-between overflow-visible border-b border-line bg-surface px-3">
      <div className="flex min-w-0 items-center gap-3">
        {showTerminalStatus ? <Link to="/campaigns" className="flex h-8 items-center gap-2 border border-line bg-canvas px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-300 transition-colors hover:border-blue-400/50 hover:bg-blue-400/[0.07] hover:text-white">
          <ArrowLeft className="size-3.5 text-accent"/>Back to campaigns
        </Link> : <div className="flex h-8 items-center px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-100">
          Hedge OS
        </div>}
        {showTerminalStatus && <>
          <span className="h-5 w-px bg-line" />
          <div className="relative">
            <button type="button" aria-label="Current contract" aria-haspopup="listbox" aria-expanded={contractMenuOpen} onClick={() => setContractMenuOpen((open) => !open)} className="flex h-9 min-w-32 items-center justify-between gap-4 border border-transparent px-2 text-left transition-colors hover:border-line hover:bg-raised">
              <span><span className="block font-mono text-xs font-semibold text-slate-100">{instrument}</span><span className="block text-[8px] uppercase tracking-[0.16em] text-muted">Current contract</span></span>
              <ChevronDown className={`size-3.5 text-muted transition-transform ${contractMenuOpen ? "rotate-180" : ""}`}/>
            </button>
            {contractMenuOpen && <div role="listbox" aria-label="Contract options" className="absolute left-0 top-full z-[110] mt-1 w-44 border border-slate-600 bg-surface p-1 shadow-2xl shadow-black/60">
              {(["NQ", "MNQ", "MBT"] as TradingInstrument[]).map((contract) => {
                const comingSoon = contract === "MBT";
                return <button key={contract} type="button" role="option" disabled={comingSoon} aria-disabled={comingSoon} aria-selected={instrument === contract} onClick={() => { if (comingSoon) return; setInstrument(contract); setContractMenuOpen(false); }} className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${comingSoon ? "cursor-not-allowed text-slate-600 opacity-70" : instrument === contract ? "bg-blue-400/15 text-blue-200" : "text-slate-300 hover:bg-slate-700/70 hover:text-white"}`}><span><span className="block font-mono text-xs font-semibold">{contract}</span><span className="mt-0.5 block text-[8px] text-slate-500">{contract === "NQ" ? "E-mini Nasdaq-100" : contract === "MNQ" ? "Micro E-mini Nasdaq-100" : "BTC perpetual hedge"}</span></span>{comingSoon ? <span className="border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider text-amber-300">Coming soon</span> : instrument === contract && <Check className="size-3.5 text-blue-300"/>}</button>;
              })}
            </div>}
          </div>
          <span className="h-5 w-px bg-line" />
          <div>
          <div className="font-mono text-sm font-semibold tabular-nums text-slate-100"><StablePrice value={displayPrice}/></div>
          <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.14em] text-muted">
            <StatusDot status={displayPrice==null?'offline':quoteFresh?'online':'warning'} /> {displayPrice==null?'Waiting for TradingView price':quoteFresh?Number.isFinite(bridgeState.tradingViewLast)?'TV last price':'TV bid/ask price':'TV price stale'}
          </div>
          </div>
        </>}
      </div>

      <div className="flex items-center justify-end gap-3">
        {showTerminalStatus && <>
          <div className="flex items-center gap-2 text-[10px]" title={bridgeState.lastMessage}>
            <StatusDot status={propConnectionStatus} />
            <span className="font-medium text-slate-200">Prop</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]" title={hedgeConnectionTitle}>
            <StatusDot status={hedgeConnectionStatus} />
            <span className={`font-medium ${bridgeState.ironbeamReady ? 'text-slate-200' : 'text-slate-500'}`}>Hedge</span>
          </div>
        </>}
        <Link to="/settings" state={{ from: `${location.pathname}${location.search}` }} aria-label="Settings" className="grid size-7 place-items-center border border-transparent text-muted transition-colors hover:border-line hover:bg-raised hover:text-slate-100">
          <Settings className="size-3.5" />
        </Link>
      </div>
    </header>
  );
}
