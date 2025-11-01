export type ServerTelemetryPayload = Record<string, unknown> | undefined;

function sanitize(payload?: Record<string, unknown>) {
  if (!payload) return undefined;
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return undefined;
  }
}

export function logEvent(name: string, payload?: ServerTelemetryPayload) {
  if (typeof name !== 'string' || !name.trim()) {
    return;
  }
  const eventName = name.trim();
  const sanitized = sanitize(payload);
  if (sanitized) {
    console.info(`[telemetry][server] ${eventName}`, sanitized);
  } else {
    console.info(`[telemetry][server] ${eventName}`);
  }
}
