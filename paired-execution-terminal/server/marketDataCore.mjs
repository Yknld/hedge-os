export function timestamp(value) {
  if (typeof value === 'number') return value > 1e12 ? value / 1000 : value;
  if (typeof value !== 'string') return NaN;
  const iso = value.replace(' ', 'T');
  return Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`) / 1000;
}

export function candle(row) {
  const time = Math.floor(timestamp(row.ts ?? row.time) / 60) * 60;
  const { open, high, low, close } = row;
  if (![time, open, high, low, close].every(Number.isFinite) || time <= 0 || low <= 0 || low > Math.min(open, close) || high < Math.max(open, close)) return null;
  return { time, open, high, low, close };
}

export class CandleCache {
  bars = new Map();
  times = new Map();
  constructor(limit = 6000) { this.limit = limit; }
  seed(rows) { for (const row of rows) { const bar = candle(row); if (bar) this.bars.set(bar.time, bar); } this.trim(); }
  tick(price, ts) {
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(ts) || ts <= 0 || ts > Date.now() / 1000 + 60) return null;
    const time = Math.floor(ts / 60) * 60;
    const old = this.bars.get(time);
    const bounds = this.times.get(time);
    const bar = old ? { ...old, high: Math.max(old.high, price), low: Math.min(old.low, price),
      open: bounds && ts < bounds.first ? price : old.open,
      close: !bounds || ts >= bounds.last ? price : old.close } : { time, open: price, high: price, low: price, close: price };
    this.times.set(time, { first: Math.min(bounds?.first ?? ts, ts), last: Math.max(bounds?.last ?? ts, ts) });
    this.bars.set(time, bar); this.trim(); return bar;
  }
  trim() { if (this.bars.size > this.limit) for (const time of [...this.bars.keys()].sort((a,b)=>a-b).slice(0, this.bars.size-this.limit)) { this.bars.delete(time); this.times.delete(time); } }
  snapshot() { return [...this.bars.values()].sort((a,b)=>a.time-b.time); }
}
