const globalState = globalThis as unknown as {
  __rubblePaidSessions?: Map<string, { amountWei: bigint; updatedAt: number }>;
};

const paidSessions = (globalState.__rubblePaidSessions ??= new Map());

export function markSessionPaid(sessionId: string, amountWei: bigint) {
  paidSessions.set(sessionId, { amountWei, updatedAt: Date.now() });
}

export function isSessionPaid(sessionId: string) {
  const record = paidSessions.get(sessionId);
  if (!record) return false;

  const ttl = 1000 * 60 * 60; // 1 hour TTL to avoid unbounded memory.
  if (Date.now() - record.updatedAt > ttl) {
    paidSessions.delete(sessionId);
    return false;
  }
  return true;
}

export function getPaidSessionAmount(sessionId: string) {
  return paidSessions.get(sessionId)?.amountWei;
}
