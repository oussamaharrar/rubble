function sanitize(payload?: Record<string, unknown>) {
  if (!payload) return undefined;
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return undefined;
  }
}

export function logEvent(name: string, payload?: Record<string, unknown>) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return;
  }
  const data = sanitize(payload);
  const tag = name.trim();
  if (data) {
    console.info(`[telemetry] ${tag}`, data);
  } else {
    console.info(`[telemetry] ${tag}`);
  }
}
