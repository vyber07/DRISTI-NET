import { create } from "zustand";

/** Effective permissions (role + overrides) for the signed-in user; loaded lazily to keep this store's imports flat. */
function loadEffectivePermissions(): void {
  void import("./permissionsStore").then(({ usePermissionsStore }) => usePermissionsStore.getState().loadGlobal());
}

export type Role =
  | "ADMIN"
  | "AUDITOR"
  | "INVESTIGATOR"
  | "EVIDENCE_OFFICER"
  | "REVIEWER"
  | "ANALYST";

export interface UserProfile {
  user_id: string;
  username: string;
  display_name: string;
  role: Role;
  jurisdiction: string;
  assigned_cases?: string[];
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  token: string | null;
  
  // Security session settings
  piiMasked: boolean;
  
  login: (username: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  /** expired: the session was rejected by the server; the login page then returns the officer to this page. */
  logout: (opts?: { expired?: boolean }) => void;
  setPiiMasked: (masked: boolean) => void;
  restoreSession: () => Promise<void>;
}

const STORAGE_KEY = "drishti.token";

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  token: null,
  piiMasked: true,

  setPiiMasked: (masked: boolean) => set({ piiMasked: masked }),

  login: async (username: string, password?: string) => {
    try {
      const {  post, setSession } = await import("../services/api/real_client");
      const loginRes = await post("/auth/login", { username, password });
      
      if (loginRes && loginRes.token && loginRes.user) {
        const token = loginRes.token as string;
        const user = loginRes.user as UserProfile;
        
        setSession(token, user);
        
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, token);
        }

        // Fetch additional user details (like assigned cases)
        const {  get: apiGet } = await import("../services/api/real_client");
        const meRes = await apiGet("/auth/me");
        
        const finalUser = meRes ? (meRes as UserProfile) : user;

        set({
          user: finalUser,
          token,
          isAuthenticated: true,
        });
        loadEffectivePermissions();

        return { success: true };
      }
      return { success: false, error: "Invalid credentials" };
    } catch (e: any) {
      console.warn("Backend login failed", e);
      return { 
        success: false, 
        // DEF-076: ApiError carries .status/.message (no axios `response`), so 401 and 429 throttling both showed a
        // generic message.
        error: e?.status === 429 ? "Too many failed attempts. Try again later."
             : e?.status === 401 ? "Invalid credentials."
             : (e?.message || "Authentication failed: server unreachable.") 
      };
    }
  },

  restoreSession: async () => {
    if (typeof window === "undefined") return;
    
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) return;

    try {
      const {  setSession, get: apiGet } = await import("../services/api/real_client");
      // Pre-set token for the /auth/me request
      // FE-055: was setSession(token, undefined), which stored the string "undefined" as the user. Only the token is
      // needed for /auth/me; it is already in storage under TOKEN_KEY.
      
      const meRes = await apiGet("/auth/me");
      if (meRes) {
        const user = meRes as UserProfile;
        setSession(token, user);
        set({
          user,
          token,
          isAuthenticated: true,
        });
        loadEffectivePermissions();
      } else {
        get().logout({ expired: true });
      }
    } catch (e: any) {
      console.warn("Session restore failed", e);
      // Only the server saying "not authenticated" ends the session. A request that merely did not complete (the
      // page navigated away mid-load, or a network blip) used to sign the officer out and hijack the navigation to
      // /login — seen in WebKit when a link was clicked while a page was still loading.
      if (e?.status === 401 || e?.status === 403) {
        get().logout({ expired: true });
        return;
      }
      const { currentUser } = await import("../services/api/real_client");
      const cached = currentUser() as UserProfile | null;
      if (cached?.user_id) {
        // Keep the stored session; any later request still gets a 401 if it really is invalid (handled in real_client).
        set({ user: cached, token, isAuthenticated: true });
      } else {
        get().logout({ expired: true });
      }
    }
  },

  logout: (opts) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      import("../services/api/real_client").then(({ clearSession }) => {
        clearSession();  // was setSession("", undefined): wrote an empty token and the string "undefined"
      });
      void import("./permissionsStore").then(({ usePermissionsStore }) => usePermissionsStore.getState().clear());
    } catch {
      // Storage fallback
    }

    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
    // DEF-061: every zustand store (graph, evidence, HITL, audit, reveal) is in memory. A full page load is the
    // only reset that cannot miss one, so the next user never sees the previous user's case data or reveals.
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      const next = window.location.pathname + window.location.search;
      window.location.assign(opts?.expired ? `/login?expired=1&next=${encodeURIComponent(next)}` : "/login");
    }
  },
}));
