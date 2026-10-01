// Read-only feed, deliberately separate from the execution relay.
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import { CandleCache, timestamp } from './marketDataCore.mjs';

const key = process.env.LSE_API_KEY;
const token = process.env.MARKET_RELAY_TOKEN;
if (!key || !token || token.length < 32) throw new Error('Set LSE_API_KEY and a MARKET_RELAY_TOKEN of at least 32 characters');
const cache = new CandleCache();
const symbol = 'NQ.F'; // Provider feed, NOT an expiry-specific MNQ execution quote.
let upstream, retry, idle, ping, seeded = false, starting = false, stopping = false;
let status = 'idle', latestTick = null, failures = 0, dirty = new Map(), lastReceived = 0;
const authorized = req => {
  const supplied = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${token}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
};
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type':'application/json' }); res.end('{"ok":true}'); return; }
  res.writeHead(404); res.end();
});
const wss = new WebSocketServer({ noServer:true, maxPayload:1024, perMessageDeflate:false });
server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/market-data' || !authorized(req) || wss.clients.size >= 100) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
  wss.handleUpgrade(req, socket, head, ws=>wss.emit('connection',ws));
});
function send(ws, data) { if (ws.readyState === WebSocket.OPEN) { if (ws.bufferedAmount > 1_000_000) ws.terminate(); else ws.send(JSON.stringify(data)); } }
function broadcast(data) { for (const ws of wss.clients) send(ws,data); }
function snapshot() { return { type:'snapshot', symbol, bars:cache.snapshot(), status, latestTick }; }
function state(value) { status=value; broadcast({type:'status',status, symbol}); }
async function start() {
  clearTimeout(idle);
  if (upstream || starting || stopping) return;
  starting=true;
  try {
    if (!seeded) {
      state('loading history');
      const response = await fetch('https://api.londonstrategicedge.com/vault/candles?symbol=NQ.F&timeframe=1m&order=desc&limit=5000', {
        headers:{'x-api-key':key}, signal:AbortSignal.timeout(15000), redirect:'error',
      });
      if (!response.ok) throw new Error('history unavailable');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('invalid history');
      cache.seed(rows); seeded=true; broadcast(snapshot());
    }
    if (!wss.clients.size || stopping) return;
    state('connecting');
    const ws = upstream = new WebSocket('wss://data-ws.londonstrategicedge.com', { maxPayload:16*1024*1024, handshakeTimeout:10000 });
    lastReceived=Date.now();
    ping=setInterval(()=>{ if(Date.now()-lastReceived>60000) ws.terminate(); else if(ws.readyState===WebSocket.OPEN)ws.send('{"action":"ping"}'); },25000);
    ws.on('message', raw=>{
      lastReceived=Date.now();
      try {
        const data=JSON.parse(raw.toString());
        if(data.type==='welcome')ws.send(JSON.stringify({action:'auth',api_key:key}));
        else if(data.type==='authenticated') {
          const last=cache.snapshot().at(-1)?.time ?? Date.now()/1000-3600;
          ws.send(JSON.stringify({action:'subscribe',symbol,start:new Date(Math.max(last,Date.now()/1000-86340)*1000).toISOString()}));
          state('recovering history');
        } else if(data.type==='tick' && data.symbol===symbol) {
          const ts=timestamp(data.ts); const bar=cache.tick(data.price,ts);
          if(bar)dirty.set(bar.time,bar);
          if(bar && !data.replay && (!latestTick || ts>=latestTick.time)) { latestTick={time:ts,price:data.price}; if(status!=='live')state('live'); failures=0; }
        } else if(data.type==='replay_complete') { broadcast(snapshot()); dirty.clear(); state('waiting for live tick'); }
        else if(data.type==='error') { state('provider error'); ws.close(); }
      } catch { state('invalid provider response'); ws.close(); }
    });
    ws.on('error',()=>state('provider disconnected'));
    ws.on('close',()=>{ clearInterval(ping); upstream=null; if(!stopping){state('disconnected'); schedule();} });
  } catch { state('history unavailable'); schedule(); }
  finally { starting=false; }
}
function schedule() { clearTimeout(retry); if(wss.clients.size && !stopping)retry=setTimeout(start,Math.min(30000,1000*2**Math.min(failures++,5))+Math.random()*500); }
wss.on('connection',ws=>{
  ws.alive=true; ws.on('pong',()=>{ws.alive=true;});
  // No client-selected symbols, upstream URLs, or trading commands.
  ws.on('message',()=>ws.close(1008,'Read-only feed'));
  send(ws,snapshot()); start();
  ws.on('close',()=>{if(!wss.clients.size)idle=setTimeout(()=>{clearTimeout(retry);upstream?.close();},30000);});
});
const flush=setInterval(()=>{ if(dirty.size){broadcast({type:'bars',symbol,bars:[...dirty.values()],latestTick,status});dirty.clear();} },1000);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive)ws.terminate();else{ws.alive=false;ws.ping();}}},30000);
server.listen(Number(process.env.PORT || 8770),process.env.MARKET_RELAY_HOST || '127.0.0.1',()=>console.log('Read-only market relay listening'));
function stop(){stopping=true;clearTimeout(retry);clearTimeout(idle);clearInterval(ping);clearInterval(flush);clearInterval(heartbeat);upstream?.terminate();wss.clients.forEach(ws=>ws.terminate());wss.close();server.close();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
