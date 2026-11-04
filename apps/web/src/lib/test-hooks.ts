/**
 * FE-056: the browser E2E reads the rendered graph through window globals. They are exposed only in builds made with
 * VITE_E2E_HOOKS=1 (`make build-web-e2e`), never in a normal production build.
 */
export const E2E_HOOKS = import.meta.env.VITE_E2E_HOOKS === "1";

export function exposeForTests(name: string, value: unknown): void {
  if (E2E_HOOKS && typeof window !== "undefined") (window as unknown as Record<string, unknown>)[name] = value;
}
