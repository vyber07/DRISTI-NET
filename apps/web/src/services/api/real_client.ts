
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

/** Error codes the client sets itself; the server's own codes (BUSY, FORBIDDEN, ...) arrive in the response body. */
export type ClientErrorCode = 'NETWORK' | 'TIMEOUT' | 'SESSION_EXPIRED'

const RETRYABLE_STATUS = new Set([502, 503, 504])

export class ApiError extends Error {
  status: number          // 0 when no HTTP response arrived (network failure, timeout)
  trace?: string          // the server's request ID (X-Request-Id), quoted when reporting a problem
  code?: string
  constructor(status: number, message: string, trace?: string, code?: string) {
    super(message); this.status = status; this.trace = trace; this.code = code
  }
  /** True for failures where the same request may succeed later: no response, a timeout, or a busy/unavailable server. */
  get retryable() { return this.code === 'NETWORK' || this.code === 'TIMEOUT' || RETRYABLE_STATUS.has(this.status) }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1"
/** Reads give up after this long; the server answers a saturated pool with 503 within ~10 s (docs/TROUBLESHOOTING.md). */
export const READ_TIMEOUT_MS = 30_000
/** Back-off between attempts of a safe (GET/HEAD) request. Writes are never retried automatically. */
const RETRY_DELAYS_MS = [600, 2_000, 5_000]

const MESSAGES: Record<ClientErrorCode, string> = {
  NETWORK: 'Cannot reach the DRISTI-NET server. Check your network connection; this page retries when you are back online.',
  TIMEOUT: 'The server took too long to respond. Please try again.',
  SESSION_EXPIRED: 'Your session has ended. Please sign in again.',
}

let sessionEnding = false

function token() { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }

function correlationId(): string {
  // Matches the server's accepted pattern ^[A-Za-z0-9._:-]{8,64}$; logged with the server request ID.
  const c = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `web-${c}`
}

function isOffline() { return typeof navigator !== 'undefined' && navigator.onLine === false }

/** Wait `ms`, or, when the browser reports it is offline, until it is back online (at most 60 s). */
function pause(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve) => {
    const offline = isOffline()
    const done = () => { clearTimeout(timer); window.removeEventListener('online', done); signal?.removeEventListener('abort', done); resolve() }
    const timer = setTimeout(done, offline ? 60_000 : ms)
    if (offline) window.addEventListener('online', done)
    signal?.addEventListener('abort', done)
  })
}

/** One fetch with a timeout. A network failure or timeout becomes an ApiError instead of the browser's bare
 *  "TypeError: Failed to fetch"; an abort by the caller is re-thrown unchanged. */
async function attempt(url: string, init: RequestInit, timeoutMs: number | null): Promise<Response> {
  const ctl = new AbortController()
  const outer = init.signal
  const relay = () => ctl.abort()
  if (outer) { if (outer.aborted) ctl.abort(); else outer.addEventListener('abort', relay) }
  let timedOut = false
  const timer = timeoutMs ? setTimeout(() => { timedOut = true; ctl.abort() }, timeoutMs) : null
  try {
    return await fetch(url, { ...init, signal: ctl.signal })
  } catch (err) {
    if (outer?.aborted) throw err
    if (timedOut) throw new ApiError(0, MESSAGES.TIMEOUT, undefined, 'TIMEOUT')
    throw new ApiError(0, MESSAGES.NETWORK, undefined, 'NETWORK')
  } finally {
    if (timer) clearTimeout(timer)
    outer?.removeEventListener('abort', relay)
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  let detail = res.statusText || `HTTP ${res.status}`
  let code: string | undefined
  let rid = res.headers.get('X-Request-Id') || res.headers.get('X-Trace-Id') || undefined
  try {
    const j = await res.json()
    if (j.detail !== undefined) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    code = typeof j.code === 'string' ? j.code : undefined
    rid = rid || j.request_id || j.trace_id
  } catch { /* not JSON: e.g. an HTML 502 page from a proxy */ }
  if (RETRYABLE_STATUS.has(res.status) && !code) {
    detail = 'The DRISTI-NET service is temporarily unavailable. Please try again in a moment.'
  }
  return new ApiError(res.status, detail, rid, code)
}

/** Send a request with the session token. GET/HEAD are retried on network failure, timeout, 502, 503 and 504
 *  (honouring Retry-After); POST/PATCH/PUT/DELETE never are, so an upload or a review decision is never sent twice.
 *  A 401 ends the session and moves to sign-in (FE-019); errors carry the server request ID. */
export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase()
  const safe = method === 'GET' || method === 'HEAD'
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) }
  const t = token()
  if (t) headers.Authorization = `Bearer ${t}`
  if (!headers['X-Correlation-Id']) headers['X-Correlation-Id'] = correlationId()
  // JSON only for string bodies the caller did not label. A raw file body (Blob/File) keeps its own Content-Type,
  // and FormData sets its own multipart boundary.
  if (typeof init.body === 'string' && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const url = `${API_BASE}${path}`
  // Uploads and other writes can legitimately take minutes; only reads get a client-side timeout.
  const timeoutMs = safe ? READ_TIMEOUT_MS : null

  for (let i = 0; ; i++) {
    let res: Response
    try {
      res = await attempt(url, { ...init, headers }, timeoutMs)
    } catch (err) {
      if (err instanceof ApiError && safe && i < RETRY_DELAYS_MS.length && !init.signal?.aborted) {
        await pause(RETRY_DELAYS_MS[i], init.signal); continue
      }
      throw err
    }
    if (safe && RETRYABLE_STATUS.has(res.status) && i < RETRY_DELAYS_MS.length) {
      const after = Number(res.headers.get('Retry-After'))
      await pause(Number.isFinite(after) && after > 0 ? Math.min(after * 1000, 15_000) : RETRY_DELAYS_MS[i], init.signal)
      continue
    }
    if (res.status === 421) {
      // Host nginx answers API calls on a non-canonical address (bare IP, http://) with 421 + the canonical origin,
      // instead of a cross-origin redirect that the browser blocks as "Failed to fetch" (docs/TROUBLESHOOTING.md).
      try {
        const j = await res.clone().json()
        // Origin only (no path), and never a downgrade from https to http.
        const loc = typeof j.location === 'string' ? j.location : ''
        const ok = /^https:\/\/[^/]+$/.test(loc) || (window.location.protocol === 'http:' && /^http:\/\/[^/]+$/.test(loc))
        if (j.code === 'ORIGIN_MOVED' && ok && loc !== window.location.origin) {
          window.location.assign(loc + window.location.pathname + window.location.search)
          return new Promise<Response>(() => { /* the page is navigating away */ })
        }
      } catch { /* fall through to a normal error */ }
    }
    if (res.status === 401 && t && !path.startsWith('/auth/')) {
      // FE-019: an expired or revoked token used to leave every page showing "request failed". Clear the session and
      // return to sign-in; the login page brings the officer back to this page afterwards (same-app paths only).
      clearSession()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        if (!sessionEnding) {
          sessionEnding = true
          const next = window.location.pathname + window.location.search
          window.location.assign(`/login?expired=1&next=${encodeURIComponent(next)}`)
        }
        // Parallel requests failing with 401 must not flash error panels while the browser leaves the page.
        return new Promise<Response>(() => { /* the page is navigating away */ })
      }
      throw new ApiError(401, MESSAGES.SESSION_EXPIRED, res.headers.get('X-Request-Id') || undefined, 'SESSION_EXPIRED')
    }
    if (!res.ok) throw await errorFrom(res)
    return res
  }
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init)
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/pdf') || ct.includes('application/octet-stream')) {
    return res.blob() as unknown as Promise<T>
  }
  return (ct.includes('application/json') ? res.json() : res.text()) as Promise<T>
}

/** A page of a list endpoint plus the server's X-Total-Count (all matches before paging). */
export interface Paged<T> { items: T[]; total: number }

export async function getPaged<T = any>(path: string, params: Record<string, string | number | boolean | undefined | null>): Promise<Paged<T>> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) qs.set(k, String(v))
  const q = qs.toString()
  const res = await request(q ? `${path}?${q}` : path)
  const items = (await res.json()) as T[]
  const total = Number(res.headers.get('X-Total-Count'))
  return { items: Array.isArray(items) ? items : [], total: Number.isFinite(total) ? total : (Array.isArray(items) ? items.length : 0) }
}

export const get = <T = any>(p: string) => api<T>(p)
export const post = <T = any>(p: string, body?: unknown) => api<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
export const patch = <T = any>(p: string, body?: unknown) => api<T>(p, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) })
export const postForm = <T = any>(p: string, fd: FormData) => api<T>(p, { method: 'POST', body: fd })

export function currentUser(): User | null { try { const s = localStorage.getItem(USER_KEY); return s ? JSON.parse(s) : null } catch { return null } }
export function setSession(tok: string, user: User) { try { localStorage.setItem(TOKEN_KEY, tok); localStorage.setItem(USER_KEY, JSON.stringify(user)) } catch { /* ignore */ } }
export function clearSession() { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) } catch { /* ignore */ } }
