# Read-only LSE chart fallback

The browser connects to `/market-data` on its own app backend. That backend
proxies to this relay, adding `Authorization: Bearer MARKET_RELAY_TOKEN`.
The provider key and relay credential must never enter a VITE variable or bundle.
Local Vite proxy configuration is included. Production requires an authenticated
app backend proxy; do not expose an unauthenticated proxy to the public Internet.

## Local

Put `LSE_API_KEY`, `MARKET_RELAY_TOKEN` (random, 32+ characters) in the ignored
`.env.local`. Run `npm run market:relay`; restart Vite to load the proxy credential.
The relay binds only to 127.0.0.1:8770 by default.

## Railway

Deploy from this app directory with Node 22+, install dependencies including ws,
and start `node server/marketDataRelay.mjs`. Configure LSE_API_KEY and
MARKET_RELAY_TOKEN as Railway secrets, MARKET_RELAY_HOST=0.0.0.0, and Railway PORT.
Use one replica. Health path: /health. No disk, database or Redis is required.
Use Railway private networking from the authenticated app backend where possible;
otherwise TLS is required. The app backend owns user/session authorization and
per-user rate limits; the relay accepts only its service credential, never users'
chosen symbols or URLs. It is not yet deployed or integrated with production auth.

## Behavior and limitations

- One upstream NQ.F subscription shared by up to 100 downstream connections.
- Fetches 5,000 recent 1m OHLC candles once per process, then tick replay (maximum
  24h) and live updates. This is a recent-history window, not unlimited history.
- In-memory cache capped at 6,000 candles. Sends one initial snapshot, then batched
  changed bars once per second. Disconnects slow consumers; checks heartbeats.
- Disconnects upstream 30s after the last viewer leaves. Reconnect uses bounded
  exponential backoff and replays the missed interval. Older missing intervals
  beyond replay coverage are left missing, never interpolated as real prices.
- UI admits current LSE bars only after 20 continuous seconds without extension
  connection. Completed history loads regardless. Reconnection restores extension
  priority. Fallback does not write to broker quote state or execution commands.
- NQ.F is the provider's futures series, not an expiry-verified MNQ contract.
  Source is labeled in the chart; there can be differences from the broker feed.
- Confirm provider redistribution rights before enabling multiple users.

Protocol sources: https://londonstrategicedge.com/docs/websocket/ and the official
lse-data SDK's `candles` method (vault/candles, x-api-key header).
