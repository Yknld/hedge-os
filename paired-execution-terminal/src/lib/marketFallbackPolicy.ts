export function fallbackDue(connected:boolean, disconnectedAt:number|null, now:number):boolean {
  return !connected && disconnectedAt !== null && now-disconnectedAt >= 20_000;
}
