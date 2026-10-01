# TradingView Broker Interface Lab

Separate research extension; does not change the existing execution bridge.

## Load
1. In Chrome open chrome://extensions and enable Developer mode.
2. Select Load unpacked and choose this directory.
3. Reload the TradingView chart, connect the desired broker, and wait five seconds.
4. Open this extension, read the report, and Export JSON.
5. Repeat with another broker to compare the method surfaces.

## Demo execution test (v0.8.0)

The popup now opens a separate demo execution test page. It targets the chart tab from which it was opened. Explicit buttons place one MNQZ2026 order, cancel its identified working order, or close its matching one-contract filled position. Requires IRONBEAM account 51425034 and currentAccountType() equal to demo on each operation. Initial placement requires no positions or active orders. Keep other automation disarmed.

Test ownership is kept in the chart page until reload. One submission per page session is allowed; uncertain results are never automatically resubmitted. Inspect broker state after errors. Reloading the chart loses test ownership; existing exposure must then be handled through the broker UI. Read-only report export remains unchanged. Simulation checks passed; broker execution has not yet been validated. No automatic bracket orders are included.

## Read-only discovery

Adds broker-reader.js: active broker lookup through the paper_trading controller Map, adapted from ezydubs/tradingview-mcp commit fc631f449a02149419afa436499bb9bc99ea3918 (MIT). Only the lookup pattern is adapted; no MCP server, dependencies, or execution code is installed. Attribution is in THIRD_PARTY_LICENSE.txt.

The directBroker report reads currentAccount, currentAccountType, positions, and orders with bounded waits. It includes account ID and basic order/position fields but no credentials. Unsupported methods and failures are explicit. Broker identity alone never proves demo status. Read-only checks are available; execution testing still requires a verified demo context and validated order semantics.

Also inspects TradingView.bottomWidgetBar and its stored model/widget values up to seven levels deep, within the existing 1,500-object limit. Excludes listener and DOM branches. Does not invoke observable value getters. This targets the open trading panel independently of the chart broker facade.

Calls the read-only getCurrentBroker() service accessor, handles synchronous or asynchronous returns, and inspects the returned object's method definitions and property types. Does not call order, position, or account methods. A returned object is not proof of broker compatibility. Wait ten seconds before exporting so the asynchronous result appears in a subsequent scan.

Calls only tradingBrokerService.ready() when its source matches the observed zero-argument arrow returning a single identifier. Inspects the returned holder using descriptors; does not await readiness or invoke implementation methods. Reports skipped/failed discovery explicitly. Includes implOrNull and whenReady definitions for inspection.

Prioritizes the observed externalServices.trading graph, lists property types without values, and exports up to 6,000 characters of source for getCurrentBroker, ready, attach, placeOrder, and context. These function definitions are inspected, never invoked. Source inspection does not reveal closure values. The traversal excludes sensitive branches and order/position/account collections.
Examines data-property descriptors of relevant window globals and a bounded set of nested objects. Records candidate object paths and broker-like method names. Reports resource origins (not paths or request contents). Runs every five seconds; keeps only the latest report in the tab.

It does not invoke getters, call broker methods, intercept or send requests, subscribe to broker events, collect credentials, or submit/cancel/close trades. It has no relay or connection to Hedge OS.

A missing candidate does not prove the interface is absent: it may be inside a closure, getter, or unsupported branch. A matching method name does not prove a usable interface. Reports are untrusted page data.

## Next research gate
Inspect exported reports across Ironbeam and Tradovate; identify the actual object and lifecycle. Then develop explicit read-only account/order/position subscriptions and verify identity, reconnect behavior, and event semantics. Execution remains unimplemented until the interface is verified. This build cannot yet diagnose actual fills or replace the current bridge.
