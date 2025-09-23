export function shortId(): string {
  // 4 chars time + 2 chars random, base36 (not cryptographically secure; good enough for channel names)
  const t = Math.floor(Date.now() / 1000).toString(36).slice(-4);
  const r = Math.floor(Math.random() * 36 * 36).toString(36).padStart(2, '0');
  return (t + r).toLowerCase();
}
