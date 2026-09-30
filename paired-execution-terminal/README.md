# Hedge OS

A local-first desktop UI foundation for a future paired prop/live hedge execution terminal. This phase contains no broker APIs, authentication, persistence, subscription logic, charts, or trade execution.

## Structure

```text
src/
  components/
    layout/       AppShell, Sidebar, TopBar
    ui/           Button, IconButton, Panel, StatusDot, NumericValue, SegmentedControl
  pages/          Terminal, Settings, Account route views
  store/          Global Zustand UI state
  lib/            Shared utilities
src-tauri/
  capabilities/   Tauri desktop permissions
  src/            Minimal Rust application entry point
  tauri.conf.json  Native window and build configuration
```

## Run the web UI

```bash
pnpm install
pnpm dev
```

## Run the native desktop app

Install the platform prerequisites for Tauri 2, then:

```bash
pnpm install
pnpm tauri:dev
```

Build platform-native installers with `pnpm tauri:build`. Run that command on macOS for a macOS bundle and on Windows for Windows installers.

## Future trading modules

Add domain-specific modules beneath `src/features/`, grouped by capability—for example `accounts`, `orders`, `hedging`, `risk`, and `paired-trades`. Keep reusable visual primitives in `src/components/ui`, route-level composition in `src/pages`, and future Tauri commands or broker adapters behind `src-tauri/src/` rather than calling external systems directly from presentation components.
