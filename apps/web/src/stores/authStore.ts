import { create } from "zustand";

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
  logout: () => void;
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
      setSession(token, undefined as any);
      
      const meRes = await apiGet("/auth/me");
      if (meRes) {
        const user = meRes as UserProfile;
        setSession(token, user);
        set({
          user,
          token,
          isAuthenticated: true,
        });
      } else {
        get().logout();
      }
    } catch (e) {
      console.warn("Session restore failed", e);
      get().logout();
    }
  },

  logout: () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      import("../services/api/real_client").then(({ clearSession }) => {
        clearSession();  // was setSession("", undefined): wrote an empty token and the string "undefined"
      });
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
      window.location.assign("/login");
    }
  },
}));
