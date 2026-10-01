import { useEffect, useRef, useState } from 'react';
import { fallbackDue } from './marketFallbackPolicy';

export type MarketBar = { time:number; open:number; high:number; low:number; close:number };
export function useMarketFallback(extensionConnected:boolean) {
  const [bars,setBars]=useState<MarketBar[]>([]);
  const [status,setStatus]=useState('connecting');
  const [fallback,setFallback]=useState(false);
  const [fresh,setFresh]=useState(false);
  const lastLiveTick=useRef(0);
  const disconnectedAt=useRef<number|null>(null);
  const connected=useRef(extensionConnected);
  connected.current=extensionConnected;
  useEffect(()=>{
    if(extensionConnected){disconnectedAt.current=null;setFallback(false);}
    else disconnectedAt.current ??= Date.now();
  },[extensionConnected]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      setFallback(fallbackDue(connected.current,disconnectedAt.current,Date.now()));
      setFresh(lastLiveTick.current>0 && Date.now()/1000-lastLiveTick.current<20);
    },250);
    return ()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    let socket:WebSocket, stopped=false, retry:ReturnType<typeof setTimeout>;
    const cache=new Map<number,MarketBar>();
    function connect(){
      // Same-origin backend proxy supplies credentials. Never ship provider or relay keys.
      const configured = import.meta.env.VITE_MARKET_RELAY_URL as string | undefined;
      const endpoint = configured?.trim() || 'wss://nq-market-relay-production.up.railway.app/market-data';
      socket=new WebSocket(endpoint);
      socket.onmessage=event=>{
        try{
          const data=JSON.parse(event.data);
          if(data.symbol!=='NQ.F')return;
          if(typeof data.status==='string')setStatus(data.status);
          if(Number.isFinite(data.latestTick?.time))lastLiveTick.current=data.latestTick.time;
          if(Array.isArray(data.bars)){
            for(const bar of data.bars){
              if([bar.time,bar.open,bar.high,bar.low,bar.close].every(Number.isFinite) && bar.low>0 && bar.low<=Math.min(bar.open,bar.close) && bar.high>=Math.max(bar.open,bar.close))cache.set(bar.time,bar);
            }
            const sorted=[...cache.values()].sort((a,b)=>a.time-b.time).slice(-6000);
            cache.clear();for(const bar of sorted)cache.set(bar.time,bar);
            setBars(sorted);
          }
        }catch{setStatus('invalid feed response');}
      };
      socket.onclose=()=>{if(!stopped){setStatus('unavailable');retry=setTimeout(connect,5000);}};
      socket.onerror=()=>socket.close();
    }
    connect();return()=>{stopped=true;clearTimeout(retry);socket.close();};
  },[]);
  return {bars,status:status==='live'&&!fresh?'stale':status,fallback};
}
