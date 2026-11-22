let cached: boolean | null = null;

/** Whether this browser can create a WebGL context (Sigma needs one). Without it the graph tab uses the list view. */
export function webglAvailable(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement("canvas");
    cached = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}
