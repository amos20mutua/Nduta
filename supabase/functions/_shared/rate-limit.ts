const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const item = buckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > item.resetAt) {
    item.count = 0;
    item.resetAt = now + windowMs;
  }
  item.count += 1;
  buckets.set(key, item);

  return {
    blocked: item.count > limit,
    remaining: Math.max(0, limit - item.count),
    resetAt: item.resetAt,
  };
}
