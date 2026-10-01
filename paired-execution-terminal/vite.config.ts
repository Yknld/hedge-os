import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { startExecutionRelay } from "./server/executionRelay";

export default defineConfig(({mode}) => {
const marketEnv=loadEnv(mode,process.cwd(),'MARKET_');
return {
  plugins: [react(), {
    name: "hedge-os-execution-relay",
    configureServer(vite) {
      const relay = startExecutionRelay();
      vite.httpServer?.once("close", () => {
        relay.clients.forEach(client => client.terminate());
        relay.close();
      });
    },
  }],
  clearScreen: false,
  server: { port: 1420, strictPort: true, proxy: {
    '/market-data': { target: marketEnv.MARKET_RELAY_URL || 'http://127.0.0.1:8770', ws:true,
      headers: { Authorization: `Bearer ${marketEnv.MARKET_RELAY_TOKEN || ''}` },
    },
  } },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: ["es2021", "chrome100", "safari13"], minify: "esbuild" },
}; });
