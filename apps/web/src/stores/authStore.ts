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

const STORAGE_KEY = "dristi_auth_token";

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
        error: e.response?.data?.detail || "Authentication failed. Server unreachable or invalid credentials." 
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
      import("../services/api/real_client").then(({ setSession }) => {
        setSession("" as any, undefined as any);
      });
    } catch {
      // Storage fallback
    }

    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },
}));
