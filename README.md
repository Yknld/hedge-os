# Hedge OS

Private source repository for the Hedge OS app and TradingView / Ironbeam execution bridge.

## Contents

- `paired-execution-terminal/`: React/Vite app, Tauri desktop source, campaign journal, planning and execution UI, tests, and vendored chart tools.
- `tradingview-order-test/`: Chrome Manifest V3 extension for TradingView and Ironbeam (v1.10.81).
- `tradingview-bridge-test-server.py`: optional standalone development relay.

## Run

```sh
cd paired-execution-terminal
pnpm install
pnpm dev
```

Vite serves the app on localhost:1420 and starts the local WebSocket relay on port 8765. Do not run the standalone relay alongside it on the same port.

In Chrome, open `chrome://extensions`, enable Developer mode, and load `tradingview-order-test` as an unpacked extension. Refresh existing TradingView and Ironbeam tabs after loading or updating the extension.

For native development, install the Tauri 2 platform prerequisites and run `pnpm tauri:dev` from the app directory. Run `pnpm build` to check TypeScript and build the web app.

Dependencies, build outputs, local account storage, and unrelated research files are excluded. Existing browser-local campaign data is not migrated by cloning this repository.
