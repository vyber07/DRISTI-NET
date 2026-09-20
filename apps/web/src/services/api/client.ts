/**
 * Async API client simulation shaped like future FastAPI backend endpoints.
 * Simulates network latency (150-250ms), standard response envelopes, and audit headers.
 */

export interface ApiResponse<T> {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    durationMs: number;
    securityClassification: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    detail?: string;
  };
}

function generateRequestId(): string {
  return `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

export async function mockFetch<T>(data: T, latencyMs = 180): Promise<ApiResponse<T>> {
  const start = performance.now();
  await new Promise((resolve) => setTimeout(resolve, latencyMs));
  const durationMs = Math.round(performance.now() - start);

  return {
    data,
    meta: {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      durationMs,
      securityClassification: "LAW_ENFORCEMENT_SENSITIVE",
    },
  };
}
