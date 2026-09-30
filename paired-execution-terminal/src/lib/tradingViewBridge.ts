export type TradingViewBridgeState = {
  relayConnected: boolean;
  extensionConnected: boolean;
  tradingViewReady: boolean;
  tradingViewSymbol: string | null;
  tradingViewDisplayedSymbol?: string | null;
  tradingViewReadiness?: {
    reason?: string;
    requiredProtocolVersion?: number;
    tabCount?: number;
    compatibleTabCount?: number;
    tabs?: Array<Record<string, unknown>>;
  } | null;
  tradingViewStatusUpdatedAt?: number | null;
  tradingViewExtensionVersion?: string | null;
  tradingViewBid?: number | null;
  tradingViewAsk?: number | null;
  tradingViewLast?: number | null;
  quoteUpdatedAt?: number | null;
  tradingViewAccountBalance?: number | null;
  tradingViewUnrealizedPnl?: number | null;
  accountUpdatedAt?: number | null;
  tradingViewPosition?: {
    symbol: string;
    side: "LONG" | "SHORT";
    quantity: number;
    avgPrice: number;
  } | null;
  lastMessage: string;
  ironbeamDetected?: boolean;
  ironbeamReady?: boolean;
  ironbeamSocketReady?: boolean;
  ironbeamTabId?: number | null;
  ironbeamBoundSymbol?: string | null;
  ironbeamExecution?: string;
  ironbeamError?: string | null;
  ironbeamAccountBalance?: number | null;
  ironbeamAccountUpdatedAt?: number | null;
  ironbeamLastEvent?: Record<string, unknown> | null;
  /** Timestamped T0–T4 trace for the latest prop-driven hedge execution. */
  ironbeamExecutionTrace?: Record<string, unknown> | null;
  /** The most recent broker-confirmed Ironbeam fill. Submission acknowledgements do not update this. */
  ironbeamLastFill?: Record<string, unknown> | null;
  /** Session-local execution and lifecycle receipts, newest first. */
  ironbeamExecutionHistory?: Array<Record<string, unknown>>;
  ironbeamPositions?: Record<string, { quantity: number; averagePrice: number | null; symbol: string }>;
  ironbeamBoundTabs?: Array<{tabId:number;account?:string|null;symbol:string;rootSymbol?:string;currentContract?:string|null;contractMatches?:boolean;socketReady:boolean;outboundTopic?:string|null}>;
};

export type TradingViewOrder = {
  symbol: "NQ" | "MNQ";
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  /** The executable entry type selected from the live prop BBO. */
  orderType?: "MARKET" | "LIMIT" | "STOP";
  campaignId?: string;
};

export type IronbeamBracketOrder = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  limitPrice: number;
  /** Required when `orderType` is STOP_LIMIT; this is the trigger price. */
  stopPrice?: number;
  takeProfitOffset: number;
  stopLossOffset: number;
  orderType: "LIMIT" | "STOP" | "STOP_LIMIT";
  account?: string;
  campaignId?: string;
};

export function getTriggerOrderType(side: "BUY"|"SELL", entryPrice: number, currentPrice: number): "LIMIT"|"STOP" {
  if(!Number.isFinite(entryPrice)||!Number.isFinite(currentPrice))throw new Error("A live comparison price is required to select the entry order type.");
  // At the executable BBO use an immediately executable *limit*, never an
  // uncapped market order. This is the price-protection boundary for the
  // TradingView leg of a pair.
  if(Math.abs(entryPrice-currentPrice)<=0.125)return "LIMIT";
  if(side==="BUY")return entryPrice>currentPrice?"STOP":"LIMIT";
  return entryPrice<currentPrice?"STOP":"LIMIT";
}

export type IronbeamHedgeBatchResult = {
  provider: "ironbeam";
  role: "hedge";
  batchId: string;
  requested: number;
  submitted: number;
  results: Array<{rootSymbol:string;tabId:number;ok:true;strategyId:number;symbol:string}>;
};

type PendingOrder = {
  resolve: (message: any) => void;
  reject: (error: Error) => void;
  timeout: number;
};

const SOCKET_URL = "ws://127.0.0.1:8765";
const TRADINGVIEW_SUBMIT_TIMEOUT_MS = 60_000;
const IRONBEAM_COMMAND_TIMEOUT_MS = 60_000;
let socket: WebSocket | null = null;
let reconnectTimer = 0;
let state: TradingViewBridgeState = {
  relayConnected: false,
  extensionConnected: false,
  tradingViewReady: false,
  tradingViewSymbol: null,
  lastMessage: "Bridge disconnected",
};
const listeners = new Set<(state: TradingViewBridgeState) => void>();
const pendingOrders = new Map<string, PendingOrder>();

export function syncExtensionTheme() {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "APP_THEME", theme: localStorage.getItem("hedge-os:theme") === "ivory" ? "ivory" : "charcoal" }));
  }
}

function publish(patch: Partial<TradingViewBridgeState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

function position(value: unknown): TradingViewBridgeState["tradingViewPosition"] {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const side = raw.side === "LONG" || raw.side === "SHORT" ? raw.side : null;
  if (typeof raw.symbol !== "string" || !side || typeof raw.quantity !== "number" || !Number.isFinite(raw.quantity) || typeof raw.avgPrice !== "number" || !Number.isFinite(raw.avgPrice)) return null;
  return { symbol: raw.symbol, side, quantity: raw.quantity, avgPrice: raw.avgPrice };
}

function tradingViewReadinessDetail(action: string) {
  const readiness=state.tradingViewReadiness;
  const statusAge=state.tradingViewStatusUpdatedAt?Date.now()-state.tradingViewStatusUpdatedAt:null;
  const quoteAge=state.quoteUpdatedAt?Date.now()-state.quoteUpdatedAt:null;
  const tabs=Array.isArray(readiness?.tabs)&&readiness.tabs.length
    ? readiness.tabs.map((tab)=>`tab ${String(tab.tabId??'?')}[active=${Boolean(tab.active)}, protocol=${String(tab.protocolVersion??'none')}, panel=${Boolean(tab.orderPanelDetected)}, ticket=${Boolean(tab.orderTicketDetected)}, DOM=${Boolean(tab.domDetected)}, broker=${Boolean(tab.brokerConnected)}, ready=${Boolean(tab.ready)}, symbol=${String(tab.displayedSymbol??tab.symbol??'unknown')}]`).join('; ')
    : 'no tab diagnostics received';
  const reason=readiness?.reason??(statusAge!==null?'STALE_OR_INCOMPATIBLE_EXTENSION_STATUS':'STATUS_NOT_RECEIVED');
  return `TradingView ${action} readiness failed: reason=${reason}, relay=${state.relayConnected}, extension=${state.extensionConnected}, extensionVersion=${state.tradingViewExtensionVersion??'not reported'}, cachedReady=${state.tradingViewReady}, statusAgeMs=${statusAge??'unknown'}, quoteAgeMs=${quoteAge??'unknown'}, tabs=${readiness?.tabCount??0}, compatibleTabs=${readiness?.compatibleTabCount??0}, requiredProtocol=${readiness?.requiredProtocolVersion??'unknown'}, symbol=${state.tradingViewDisplayedSymbol??state.tradingViewSymbol??'unknown'}. ${tabs}. Last bridge message: ${state.lastMessage}`;
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  const nextSocket = new WebSocket(SOCKET_URL);
  socket = nextSocket;
  nextSocket.addEventListener("open", () => {
    publish({ relayConnected: true, lastMessage: "Local relay connected" });
    nextSocket.send(JSON.stringify({ type: "HELLO", source: "hedge-os-app", version: "0.1.0" }));
    syncExtensionTheme();
  });
  nextSocket.addEventListener("message", (event) => {
    let message: Record<string, unknown>;
    try { message = JSON.parse(String(event.data)); }
    catch { return; }
    if (message.type === "BRIDGE_STATUS") {
      publish({
        relayConnected: Boolean(message.relayConnected),
        extensionConnected: Boolean(message.extensionConnected),
        lastMessage: message.extensionConnected ? "TradingView extension connected" : "Waiting for TradingView extension",
      });
      return;
    }
    if (message.type === "STATUS") {
      const ready = Boolean(message.ready);
      const numeric=(value:unknown)=>typeof value === "number" && Number.isFinite(value) ? value:null;
      const accountBalance=numeric(message.accountBalance),unrealizedPnl=numeric(message.unrealizedPnl);
      publish({
        tradingViewStatusUpdatedAt:Date.now(),
        tradingViewExtensionVersion:typeof message.extensionVersion === "string" ? message.extensionVersion:null,
        tradingViewReady: ready,
        ...(typeof message.symbol === "string" ? {tradingViewSymbol:message.symbol}:{}),
        ...(typeof message.displayedSymbol === "string" ? {tradingViewDisplayedSymbol:message.displayedSymbol}:{}),
        tradingViewReadiness:message.readiness && typeof message.readiness === "object" ? message.readiness as TradingViewBridgeState['tradingViewReadiness'] : null,
        ...(numeric(message.timestamp)!==null ? {tradingViewBid:numeric(message.bid),tradingViewAsk:numeric(message.ask),
          tradingViewLast:numeric(message.last),quoteUpdatedAt:numeric(message.timestamp)}:{}),
        ...(accountBalance!==null?{tradingViewAccountBalance:accountBalance}:{}),
        ...(unrealizedPnl!==null?{tradingViewUnrealizedPnl:unrealizedPnl}:{}),
        ...(accountBalance!==null||unrealizedPnl!==null?{accountUpdatedAt:numeric(message.accountUpdatedAt)??numeric(message.timestamp)}:{}),
        tradingViewPosition: position(message.position),
        lastMessage: ready
          ? `TradingView ${String(message.displayedSymbol || message.symbol || "")} ready (${String(message.symbolSource || "live")})`.trim()
          : "Extension connected, but TradingView is not ready",
      });
      return;
    }
    if (message.type === "QUOTE") {
      const numeric=(value:unknown)=>typeof value === "number" && Number.isFinite(value) ? value:null;
      const accountBalance=numeric(message.accountBalance),unrealizedPnl=numeric(message.unrealizedPnl);
      publish({
        tradingViewSymbol: typeof message.symbol === "string" ? message.symbol:null,
        tradingViewDisplayedSymbol: typeof message.displayedSymbol === "string" ? message.displayedSymbol:null,
        tradingViewBid:numeric(message.bid),tradingViewAsk:numeric(message.ask),tradingViewLast:numeric(message.last),
        ...(accountBalance!==null?{tradingViewAccountBalance:accountBalance}:{}),
        ...(unrealizedPnl!==null?{tradingViewUnrealizedPnl:unrealizedPnl}:{}),
        quoteUpdatedAt:numeric(message.timestamp),
        ...(accountBalance!==null||unrealizedPnl!==null?{accountUpdatedAt:numeric(message.timestamp)}:{}),
        tradingViewPosition: position(message.position),
        lastMessage:"Live TradingView quote received",
      });
      return;
    }
    if(message.type === "IRONBEAM_STATUS") {
      publish({ironbeamDetected:Boolean(message.detected),ironbeamReady:Boolean(message.ready),ironbeamSocketReady:Boolean(message.socketReady),
        ironbeamAccountBalance:typeof message.accountBalance==='number'&&Number.isFinite(message.accountBalance)?message.accountBalance:null,
        ironbeamAccountUpdatedAt:typeof message.accountBalanceUpdatedAt==='number'&&Number.isFinite(message.accountBalanceUpdatedAt)?message.accountBalanceUpdatedAt:null,
        ironbeamTabId:typeof message.tabId==='number'?message.tabId:null,ironbeamBoundSymbol:typeof message.boundSymbol==='string'?message.boundSymbol:null,
        ironbeamExecution:typeof message.execution==='string'?message.execution:'IDLE',ironbeamError:typeof message.error==='string'?message.error:null,
        ironbeamBoundTabs:Array.isArray(message.boundTabs)?message.boundTabs as TradingViewBridgeState['ironbeamBoundTabs']:[]});
      return;
    }
    if(message.type === "IRONBEAM_EVENT" && message.event && typeof message.event === "object") {
      const event=message.event as Record<string, unknown>;
      const isExecutionReceipt=['order_fill','execution_trace','prop_hedge','deferred_hedge','contract_drift','execution_audit'].includes(String(event.type ?? ''));
      const receipt={...event,receivedAt:Date.now()};
      const existingHistory=state.ironbeamExecutionHistory ?? [];
      const eventKey=JSON.stringify([event.type,event.status,event.phase,event.batchId,event.strategyId,event.observedAt]);
      const history=isExecutionReceipt
        ? [receipt,...existingHistory.filter(item=>JSON.stringify([item.type,item.status,item.phase,item.batchId,item.strategyId,item.observedAt])!==eventKey)].slice(0,100)
        : existingHistory;
      const lifecycleMessage=event.type === 'prop_hedge'
        ? `${String(event.status ?? 'HEDGE_EVENT').replaceAll('_',' ')}${typeof event.reason === 'string' ? `: ${event.reason.replaceAll('_',' ')}` : ''}`
        : state.lastMessage;
      publish({
        ironbeamLastEvent:event,
        ironbeamExecutionHistory:history,
        ...(event.type === 'execution_trace' && event.trace && typeof event.trace === 'object' ? {ironbeamExecutionTrace:event.trace as Record<string, unknown>} : {}),
        ...(event.type === 'order_fill' ? {ironbeamLastFill:event} : {}),
        ...(event.type === 'position_state' && typeof event.symbol === 'string' && typeof event.quantity === 'number'
          ? {ironbeamPositions:{...(state.ironbeamPositions??{}),[event.symbol.replace(/^XCME:/,'').split('.')[0].toUpperCase()]:{symbol:event.symbol,quantity:event.quantity,averagePrice:typeof event.averagePrice === 'number'?event.averagePrice:null}}}
          : {}),
        ...(event.type === 'prop_hedge' ? {lastMessage:lifecycleMessage} : {}),
        ...(event.type === 'deferred_hedge' ? {lastMessage:typeof event.error === 'string' ? event.error : typeof event.status === 'string' ? `NNQ hedge: ${event.status.replaceAll('_',' ')}` : state.lastMessage} : {}),
      });
      return;
    }
    const id = typeof message.id === "string" ? message.id : "";
    const pending = pendingOrders.get(id);
    if (!pending) return;
    if (message.type === "IRONBEAM_RESULT") {
      clearTimeout(pending.timeout);
      pendingOrders.delete(id);
      if (message.ok) {
        const strategy = typeof message.strategyId === "number" ? ` (strategy ${message.strategyId})` : "";
        publish({lastMessage:`Ironbeam command confirmed${strategy}`});
        pending.resolve(message);
      } else {
        const detail=String(message.error||"Ironbeam rejected the command");publish({lastMessage:detail});pending.reject(new Error(detail));
      }
      return;
    }
    if (message.type === "ORDER_RECEIVED") {
      publish({ lastMessage: "Extension received order; waiting for TradingView submission" });
    } else if (message.type === "ORDER_SUBMITTED") {
      clearTimeout(pending.timeout);
      pendingOrders.delete(id);
      publish({ lastMessage: "Order submitted in TradingView" });
      pending.resolve("Order submitted in TradingView");
    } else if (message.type === "ORDER_ERROR") {
      clearTimeout(pending.timeout);
      pendingOrders.delete(id);
      const detail = String(message.message || message.error || "TradingView rejected the order");
      publish({ lastMessage: detail });
      pending.reject(new Error(detail));
    } else if (message.type === "CANCEL_RECEIVED") {
      publish({ lastMessage: "Cancellation received; waiting for TradingView" });
    } else if (message.type === "ORDERS_CANCELLED") {
      clearTimeout(pending.timeout);
      pendingOrders.delete(id);
      publish({ lastMessage: "Order cancelled in TradingView" });
      pending.resolve("Order cancelled in TradingView");
    } else if (message.type === "CANCEL_ERROR") {
      clearTimeout(pending.timeout);
      pendingOrders.delete(id);
      const detail = String(message.message || message.error || "TradingView could not cancel the order");
      publish({ lastMessage: detail });
      pending.reject(new Error(detail));
    }
  });
  nextSocket.addEventListener("close", () => {
    if (socket === nextSocket) socket = null;
    publish({ relayConnected: false, extensionConnected: false, tradingViewReady: false, tradingViewSymbol: null,
      tradingViewDisplayedSymbol:null,tradingViewBid:null,tradingViewAsk:null,tradingViewLast:null,quoteUpdatedAt:null,
      tradingViewAccountBalance:null,tradingViewUnrealizedPnl:null,tradingViewPosition:null,accountUpdatedAt:null,lastMessage: "Bridge disconnected" });
    clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(connect, 1000);
  });
  nextSocket.addEventListener("error", () => nextSocket.close());
}

export function subscribeTradingViewBridge(listener: (state: TradingViewBridgeState) => void) {
  listeners.add(listener);
  listener(state);
  connect();
  return () => { listeners.delete(listener); };
}

export function getTradingViewBridgeState() {
  connect();
  return state;
}

export function assertPairedExecutionReady(legs: IronbeamBracketOrder[]) {
  connect();
  if(!socket||socket.readyState!==WebSocket.OPEN)throw new Error("Local execution relay is not connected.");
  if(!state.extensionConnected)throw new Error("Execution extension is not connected.");
  if(!state.tradingViewReady)throw new Error(tradingViewReadinessDetail('prop submission'));
  if(state.tradingViewSymbol&&!['NQ','MNQ'].includes(state.tradingViewSymbol))throw new Error(`Prop leg requires NQ or MNQ, but TradingView is ${state.tradingViewSymbol}.`);
  if(!state.ironbeamReady)throw new Error(state.ironbeamError||"Ironbeam hedge tabs are not ready.");
  const requiredRoots=new Set(legs.map(leg=>leg.symbol.trim().toUpperCase().replace(/^XCME:/,'').split('.')[0]));
  if(!legs.length)throw new Error("The paired order has no executable Ironbeam hedge contracts.");
  if(requiredRoots.size!==legs.length)throw new Error("Each Ironbeam hedge root may appear only once.");
  const bindings=state.ironbeamBoundTabs??[];
  for(const root of requiredRoots){
    const matches=bindings.filter(binding=>(binding.rootSymbol??binding.symbol).toUpperCase()===root);
    if(matches.length!==1)throw new Error(`Ironbeam ${root} must have exactly one bound tab before arming.`);
    const binding=matches[0];
    if(!binding.socketReady||!binding.outboundTopic||binding.contractMatches===false)throw new Error(`Ironbeam ${root} tab is not execution-ready.`);
  }
}

export async function sendPairedExecution(prop: TradingViewOrder, hedgeLegs: IronbeamBracketOrder[]) {
  const quoteAge=Date.now()-(state.quoteUpdatedAt??0);
  if(!state.quoteUpdatedAt||quoteAge>3_000)throw new Error("Pair not sent: a fresh TradingView bid/ask is required.");
  const propComparison=prop.side==="BUY"?state.tradingViewAsk:state.tradingViewBid;
  if(!Number.isFinite(propComparison))throw new Error("Pair not sent: the TradingView comparison price is unavailable.");
  const propOrderType=getTriggerOrderType(prop.side,prop.entryPrice,Number(propComparison));
  assertPairedExecutionReady(hedgeLegs);
  const timeoutMs=Math.max(500,Math.min(10_000,Math.round(Number(localStorage.getItem('hedge-os:hedge-completion-timeout-ms'))||5000)));
  // The matched MNQ hedge is deliberately deterministic: it is offset from
  // the ticket's prop price by whole ticks, never repriced from a live BBO.
  const hedgeEntryOffsetTicks=Math.max(1,Math.min(4,Math.round(Number(localStorage.getItem('hedge-os:hedge-entry-offset-ticks'))||1)));
  const completionPercent=Math.max(1,Math.min(100,Number(localStorage.getItem('hedge-os:hedge-completion-threshold-percent'))||98));
  // Arming first stages the inverse MNQ Ironbeam bracket at the prop entry and
  // then submits TradingView. NNQ remains withheld until prop fill confirmation.
  const arm=await sendIronbeamCommand({action:'arm_after_prop_fill',prop:{...prop,orderType:prop.orderType??propOrderType},legs:hedgeLegs,timeoutMs,completionPercent,hedgeEntryOffsetTicks},"Ironbeam did not acknowledge hedge arming.");
  try {
    const propResult=await sendTradingViewOrder(prop);
    return {prop:propResult,hedge:arm};
  } catch(error) {
    await sendIronbeamCommand({action:'disarm_after_prop_fill',batchId:typeof arm.batchId==='string'?arm.batchId:undefined},"Ironbeam did not acknowledge hedge disarming.").catch(()=>{});
    throw error;
  }
}

export async function cancelPairedExecution(hedgeRoots: string[]) {
  // Never let an already-disconnected Ironbeam session prevent cancellation of
  // the prop order. The extension forgets armed work on its own context reset.
  await sendIronbeamCommand({action:'disarm_after_prop_fill'},"Ironbeam did not acknowledge hedge disarming.").catch(()=>{});
  const results=await Promise.allSettled([cancelTradingViewOrders(true),...hedgeRoots.map(root=>exitCancelIronbeam(root))]);
  const failures=results.filter(result=>result.status==='rejected') as PromiseRejectedResult[];
  if(failures.length)throw new Error(`Cancel/flatten was not fully confirmed. ${failures.map(result=>result.reason instanceof Error?result.reason.message:String(result.reason)).join(' ')}`);
  return results;
}

export async function cancelPairedPendingExecution(hedgeRoots: string[]) {
  // Cancel the prop order first. If that cannot be confirmed, preserve the
  // hedge orders instead of leaving a live, unhedged prop trigger behind.
  // `disarm_after_prop_fill` already stops every strategy owned by this
  // paired arm and waits for Ironbeam's STOP_STRATEGY acknowledgement. Do not
  // immediately issue a second account-level Cancel All for the same
  // strategy: Ironbeam can treat that redundant request as a rejection even
  // though the first stop succeeded.
  let disarmError: unknown = null;
  try {
    await sendIronbeamCommand({action:'disarm_after_prop_fill'},"Ironbeam did not acknowledge hedge disarming.");
  } catch (error) {
    disarmError = error;
  }
  const propResult=await cancelTradingViewOrders(false);
  // Use broad per-root cleanup only if the targeted disarm itself failed.
  // It is a recovery path, not the normal paired-order cancellation path.
  const hedgeResults=disarmError
    ? await Promise.allSettled(hedgeRoots.map(root=>cancelAllIronbeamStrategies(root)))
    : [];
  const failures=[
    ...(disarmError?[{status:'rejected',reason:disarmError} as PromiseRejectedResult]:[]),
    ...(hedgeResults.filter(result=>result.status==='rejected') as PromiseRejectedResult[]),
  ];
  if(failures.length)throw new Error(`TradingView pending orders were canceled, but hedge cancellation was not fully confirmed. ${failures.map(result=>result.reason instanceof Error?result.reason.message:String(result.reason)).join(' ')}`);
  return [propResult,...hedgeResults];
}

export async function sendTradingViewOrder(order: TradingViewOrder) {
  connect();
  if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("Local TradingView bridge is not connected.");
  if (!state.extensionConnected) throw new Error("TradingView extension is not connected. Open TradingView and verify the extension is enabled.");
  if (!state.tradingViewReady) throw new Error(tradingViewReadinessDetail('order submission'));
  if (state.tradingViewSymbol && state.tradingViewSymbol !== order.symbol) {
    throw new Error(`Hedge OS is set to ${order.symbol}, but the active TradingView order panel is ${state.tradingViewSymbol}.`);
  }
  const id = crypto.randomUUID();
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pendingOrders.delete(id);
      reject(new Error("TradingView did not confirm order submission. Check that its broker order panel is open and connected."));
    }, TRADINGVIEW_SUBMIT_TIMEOUT_MS);
    pendingOrders.set(id, { resolve, reject, timeout });
    socket!.send(JSON.stringify({ id, type: "PLACE_ORDER", role: "prop", ...order }));
  });
}

export async function cancelTradingViewOrders(flatten = false) {
  connect();
  if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("Local TradingView bridge is not connected.");
  if (!state.extensionConnected) throw new Error("TradingView extension is not connected.");
  // Do not gate safety actions on the app's cached readiness snapshot. The
  // extension performs a fresh per-tab/protocol/panel check when it receives
  // the cancellation and returns precise diagnostics if no target is usable.
  const id = crypto.randomUUID();
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pendingOrders.delete(id);
      reject(new Error("TradingView did not confirm the cancellation."));
    }, 20000);
    pendingOrders.set(id, { resolve, reject, timeout });
    socket!.send(JSON.stringify({ id, type: "CANCEL_ALL", flatten }));
  });
}

function sendIronbeamCommand(command: Record<string, unknown>, timeoutMessage: string) {
  connect();
  if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("Local execution relay is not connected.");
  if (!state.extensionConnected) throw new Error("Execution extension is not connected.");
  if (!state.ironbeamReady) throw new Error(state.ironbeamError || "Ironbeam is not ready. Open and bind its authenticated trading tab.");
  const id=crypto.randomUUID();
  return new Promise<Record<string, unknown>>((resolve,reject)=>{
    const timeout=window.setTimeout(()=>{pendingOrders.delete(id);reject(new Error(timeoutMessage));},IRONBEAM_COMMAND_TIMEOUT_MS);
    pendingOrders.set(id,{resolve,reject,timeout});
    socket!.send(JSON.stringify({id,provider:"ironbeam",...command}));
  });
}

export function sendIronbeamBracket(order: IronbeamBracketOrder) {
  return sendIronbeamCommand({action:"place_bracket",...order},"Ironbeam did not acknowledge bracket submission.");
}

export function sendIronbeamHedgeBatch(legs: IronbeamBracketOrder[]) {
  assertPairedExecutionReady(legs);
  return sendIronbeamCommand({action:"place_bracket_batch",role:"hedge",legs},"Ironbeam did not acknowledge every hedge bracket.") as Promise<unknown> as Promise<IronbeamHedgeBatchResult>;
}

export function cancelIronbeamStrategy(strategyId: number, symbol?: string) {
  if (!Number.isFinite(strategyId)) throw new Error("A valid Ironbeam strategy ID is required.");
  return sendIronbeamCommand({action:"cancel_strategy",strategyId,...(symbol?{symbol}: {})},"Ironbeam did not acknowledge strategy cancellation.");
}

export function cancelAllIronbeamStrategies(symbol?: string) {
  return sendIronbeamCommand({action:"cancel_all",...(symbol?{symbol}: {})},"Ironbeam did not acknowledge Cancel All.");
}

export function exitCancelIronbeam(symbol?: string) {
  return sendIronbeamCommand({action:"exit_cancel",...(symbol?{symbol}: {})},"Ironbeam did not confirm Exit / Cxl.");
}

/** Load the extension's durable audit trail after an app reload or restart. */
export async function loadIronbeamExecutionAudit() {
  const response=await sendIronbeamCommand({action:'get_execution_audit'},'Ironbeam did not return the execution audit.');
  const entries=Array.isArray(response.entries)?response.entries.filter((entry):entry is Record<string, unknown>=>Boolean(entry)&&typeof entry==='object'):[];
  const current=state.ironbeamExecutionHistory??[];
  const key=(entry:Record<string,unknown>)=>JSON.stringify([entry.type,entry.category,entry.action,entry.status,entry.phase,entry.batchId,entry.strategyId,entry.observedAt]);
  const history=[...entries,...current.filter(entry=>!entries.some(candidate=>key(candidate)===key(entry)))].sort((a,b)=>Number(b.observedAt??0)-Number(a.observedAt??0)).slice(0,500);
  publish({ironbeamExecutionHistory:history});
  return history;
}
