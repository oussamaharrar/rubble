declare global {
  interface Window {
    analytics?: {
      track?: (event: string, payload?: Record<string, unknown>) => void;
    };
    gtag?: (...args: unknown[]) => void;
  }
}

export {};
