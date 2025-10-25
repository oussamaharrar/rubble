const globalState = globalThis as unknown as {
  __rubbleGrantedSessions?: Set<string>;
  __rubbleGrantedTimestamps?: Map<string, number>;
};

const grantedSessions = (globalState.__rubbleGrantedSessions ??= new Set<string>());
const grantedTimestamps = (globalState.__rubbleGrantedTimestamps ??= new Map<string, number>());

const GRANT_TTL_MS = 60 * 60 * 1000; // one hour

export function markSessionGranted(sessionId: string) {
  grantedSessions.add(sessionId);
  grantedTimestamps.set(sessionId, Date.now());
}

export function isSessionGranted(sessionId: string) {
  if (!grantedSessions.has(sessionId)) {
    return false;
  }
  const grantedAt = grantedTimestamps.get(sessionId);
  if (!grantedAt) {
    grantedSessions.delete(sessionId);
    return false;
  }
  if (Date.now() - grantedAt > GRANT_TTL_MS) {
    grantedSessions.delete(sessionId);
    grantedTimestamps.delete(sessionId);
    return false;
  }
  return true;
}
