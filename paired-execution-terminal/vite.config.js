import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { WebSocket, WebSocketServer } from "ws";
const BRIDGE_PORT = 8765;
function tradingViewBridgePlugin() {
    let bridgeStarted = false;
    return {
        name: "hedge-os-tradingview-bridge",
        configureServer() {
            if (bridgeStarted)
                return;
            bridgeStarted = true;
            const server = new WebSocketServer({ host: "127.0.0.1", port: BRIDGE_PORT });
            const clients = new Map();
            let activeTradingViewExtension = null;
            let activeIronbeamExtension = null;
            const relayAudit = [];
            const audit = (entry) => {
                relayAudit.push({ time: Date.now(), ...entry });
                if (relayAudit.length > 100)
                    relayAudit.splice(0, relayAudit.length - 100);
            };
            const send = (client, payload) => {
                if (client.readyState === WebSocket.OPEN)
                    client.send(JSON.stringify(payload));
            };
            const broadcast = (role, payload) => clients.forEach((clientRole, client) => {
                if (clientRole === role)
                    send(client, payload);
            });
            const reportStatus = () => broadcast("app", {
                type: "BRIDGE_STATUS",
                relayConnected: true,
                extensionConnected: Array.from(clients.values()).includes("extension"),
            });
            server.on("connection", (client) => {
                clients.set(client, "unknown");
                client.on("message", (raw) => {
                    let message;
                    try {
                        message = JSON.parse(String(raw));
                    }
                    catch {
                        return send(client, { type: "PROTOCOL_ERROR", error: "INVALID_JSON" });
                    }
                    if (message.type === "HELLO") {
                        const role = message.source === "tradingview-extension" ? "extension" : message.source === "hedge-os-app" ? "app" : "unknown";
                        clients.set(client, role);
                        send(client, { type: "HELLO_ACK", role });
                        reportStatus();
                        return;
                    }
                    if (message.type === "PING")
                        return send(client, { type: "PONG" });
                    const sourceRole = clients.get(client);
                    if (message.type === "GET_RELAY_AUDIT" && sourceRole === "app")
                        return send(client, { type: "RELAY_AUDIT", entries: relayAudit });
                    if (message.provider === "ironbeam" && sourceRole === "app") {
                        audit({ direction: "app_to_extension", id: message.id, action: message.action,
                            legs: Array.isArray(message.legs) ? message.legs.map((leg) => ({ symbol: leg?.symbol, side: leg?.side, quantity: leg?.quantity, entryPrice: leg?.limitPrice, orderType: leg?.orderType, tpOffset: leg?.takeProfitOffset, slOffset: leg?.stopLossOffset })) : [] });
                        if (!activeIronbeamExtension || activeIronbeamExtension.readyState !== WebSocket.OPEN)
                            return send(client, { id: message.id, type: "IRONBEAM_RESULT", ok: false, provider: "ironbeam", error: "IRONBEAM_EXTENSION_NOT_READY" });
                        send(activeIronbeamExtension, message);
                        return;
                    }
                    if ((message.type === "PLACE_ORDER" || message.type === "CANCEL_ALL") && sourceRole === "app") {
                        audit({ direction: "app_to_extension", id: message.id, provider: "tradingview", action: message.type, symbol: message.symbol,
                            side: message.side, quantity: message.quantity, entryPrice: message.entryPrice, takeProfit: message.takeProfit, stopLoss: message.stopLoss });
                        if (!activeTradingViewExtension || activeTradingViewExtension.readyState !== WebSocket.OPEN)
                            return send(client, { id: message.id, type: "ORDER_ERROR", error: "TRADINGVIEW_EXTENSION_NOT_READY", message: "TradingView extension has not reported a ready order panel." });
                        send(activeTradingViewExtension, message);
                        return;
                    }
                    if (sourceRole === "extension") {
                        if (["ORDER_RECEIVED", "ORDER_SUBMITTED", "ORDER_ERROR", "CANCEL_RECEIVED", "ORDERS_CANCELLED", "CANCEL_ERROR"].includes(String(message.type)))
                            audit({ direction: "extension_to_app", id: message.id, provider: "tradingview", type: message.type, error: message.error });
                        if (message.provider === "ironbeam" && (message.type === "IRONBEAM_RECEIVED" || message.type === "IRONBEAM_RESULT"))
                            audit({ direction: "extension_to_app", id: message.id, type: message.type, ok: message.ok, error: message.error });
                        if (message.type === "STATUS" && message.ready === true)
                            activeTradingViewExtension = client;
                        if (message.type === "IRONBEAM_STATUS" && message.ready === true)
                            activeIronbeamExtension = client;
                        broadcast("app", message);
                    }
                });
                client.on("close", () => {
                    clients.delete(client);
                    if (activeTradingViewExtension === client)
                        activeTradingViewExtension = null;
                    if (activeIronbeamExtension === client)
                        activeIronbeamExtension = null;
                    reportStatus();
                });
            });
            server.on("listening", () => console.log(`TradingView bridge listening on ws://127.0.0.1:${BRIDGE_PORT}`));
            server.on("error", (error) => console.error("TradingView bridge failed:", error.message));
        },
    };
}
export default defineConfig(({mode}) => {
    const marketEnv = loadEnv(mode, process.cwd(), 'MARKET_');
    return {
    plugins: [react(), tradingViewBridgePlugin()],
    clearScreen: false,
    server: { port: 1420, strictPort: true, proxy: {
        '/market-data': { target: marketEnv.MARKET_RELAY_URL || 'http://127.0.0.1:8770', ws: true,
            headers: { Authorization: `Bearer ${marketEnv.MARKET_RELAY_TOKEN || ''}` } },
    } },
    envPrefix: ["VITE_", "TAURI_ENV_"],
    build: { target: ["es2021", "chrome100", "safari13"], minify: "esbuild" },
}; });
