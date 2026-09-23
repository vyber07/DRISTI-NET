
export interface ApiResponse<T> {
  data: T;
  error?: string;
  meta: {
    requestId: string;
    timestamp: string;
    durationMs: number;
    securityClassification: string;
  };
}

// Thin API client. Token lives in localStorage for the demo only.
export const TOKEN_KEY = 'drishti.token'
export const USER_KEY = 'drishti.user'

export type User = { user_id: string; username: string; display_name: string; role: string; jurisdiction: string; assigned_cases?: string[] }

export class ApiError extends Error {
  status: number
  trace?: string
  constructor(status: number, message: string, trace?: string) { super(message); this.status = status; this.trace = trace }
}

function token() { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) }
  const t = token()
  if (t) headers.Authorization = `Bearer ${t}`
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "/api/v1"}${path}`, { ...init, headers })
  const trace = res.headers.get('X-Trace-Id') || undefined
  if (!res.ok) {
    let detail = res.statusText
    try { const j = await res.json(); detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail) } catch { /* ignore */ }
    throw new ApiError(res.status, detail, trace)
  }
  const ct = res.headers.get('content-type') || ''
  return (ct.includes('application/json') ? res.json() : res.text()) as Promise<T>
}

export const get = <T = any>(p: string) => api<T>(p)
export const post = <T = any>(p: string, body?: unknown) => api<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
export const postForm = <T = any>(p: string, fd: FormData) => api<T>(p, { method: 'POST', body: fd })

export function currentUser(): User | null { try { const s = localStorage.getItem(USER_KEY); return s ? JSON.parse(s) : null } catch { return null } }
export function setSession(tok: string, user: User) { try { localStorage.setItem(TOKEN_KEY, tok); localStorage.setItem(USER_KEY, JSON.stringify(user)) } catch { /* ignore */ } }
export function clearSession() { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) } catch { /* ignore */ } }
