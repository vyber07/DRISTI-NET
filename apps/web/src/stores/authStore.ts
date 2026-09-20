import { create } from "zustand";

export type ClearanceLevel = 1 | 2 | 3 | 4;

export type Role =
  | "ROLE_SUPER_ADMIN"
  | "ROLE_SUPERVISOR"
  | "ROLE_ANALYST"
  | "ROLE_INVESTIGATOR"
  | "ROLE_FIELD_OPERATOR"
  | "ROLE_FORENSIC_AUDITOR";

export interface DemoAccount {
  badgeNumber: string;
  username: string;
  fullName: string;
  role: Role;
  roleLabel: string;
  clearanceLevel: ClearanceLevel;
  jurisdiction: string;
  activeCaseId: string;
  department: string;
  description: string;
}

export const DEMO_PASSWORD = "dristi2026";

export const DEMO_ACCOUNTS: Record<string, DemoAccount> = {
  "USR-9921": {
    badgeNumber: "USR-9921",
    username: "v.rathore",
    fullName: "Insp. V. Rathore",
    role: "ROLE_INVESTIGATOR",
    roleLabel: "Lead Analyst / IO",
    clearanceLevel: 2,
    jurisdiction: "CYBER CRIME UNIT / ZONE-1",
    activeCaseId: "CASE-0001",
    department: "Cyber Crime Investigation Wing",
    description: "Primary case investigator, graph exploration, evidence triage & correlation",
  },
  "USR-8840": {
    badgeNumber: "USR-8840",
    username: "s.verma",
    fullName: "DySP S. C. Verma",
    role: "ROLE_SUPERVISOR",
    roleLabel: "Supervisory Officer",
    clearanceLevel: 3,
    jurisdiction: "CENTRAL INTELLIGENCE CELL",
    activeCaseId: "CASE-0001",
    department: "Executive Supervision & Review",
    description: "Supervisory review, tier elevation approvals, high-clearance audit sign-off",
  },
  "USR-7712": {
    badgeNumber: "USR-7712",
    username: "k.meena",
    fullName: "Sub-Insp. K. L. Meena",
    role: "ROLE_FIELD_OPERATOR",
    roleLabel: "Field Operator",
    clearanceLevel: 2,
    jurisdiction: "TACTICAL RESPONSE UNIT",
    activeCaseId: "CASE-0001",
    department: "Special Operations & Field Support",
    description: "Field artifact seizure, hardware triage, on-site corroboration",
  },
  "USR-6601": {
    badgeNumber: "USR-6601",
    username: "a.gupta",
    fullName: "Dr. A. Gupta",
    role: "ROLE_FORENSIC_AUDITOR",
    roleLabel: "Forensic Auditor",
    clearanceLevel: 4,
    jurisdiction: "DIGITAL FORENSICS LAB",
    activeCaseId: "CASE-0001",
    department: "Digital Evidence & Cryptographic Assurance",
    description: "Cryptographic verification, SHA-256 chain of custody, court compliance",
  },
};

export interface AuthState {
  badgeNumber: string;
  fullName: string;
  role: Role;
  roleLabel: string;
  clearanceLevel: ClearanceLevel;
  jurisdiction: string;
  activeCaseId: string | null;
  piiMasked: boolean;
  zeroTrustActive: boolean;
  breakGlassActive: boolean;
  isAuthenticated: boolean;
  rememberMe: boolean;
  login: (
    badgeOrUsername: string,
    password?: string,
    rememberMe?: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  selectDemoProfile: (badgeNumber: string) => void;
}

const STORAGE_KEY = "dristi_auth_session";

function getSavedSession(): Partial<AuthState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.isAuthenticated) {
      return parsed;
    }
  } catch {
    // Storage access or JSON parse error fallback
  }
  return null;
}

const initialSaved = getSavedSession();
const defaultAccount = DEMO_ACCOUNTS["USR-9921"];

export const useAuthStore = create<AuthState>((set, get) => ({
  badgeNumber: initialSaved?.badgeNumber || defaultAccount.badgeNumber,
  fullName: initialSaved?.fullName || defaultAccount.fullName,
  role: initialSaved?.role || defaultAccount.role,
  roleLabel: initialSaved?.roleLabel || defaultAccount.roleLabel,
  clearanceLevel: initialSaved?.clearanceLevel || defaultAccount.clearanceLevel,
  jurisdiction: initialSaved?.jurisdiction || defaultAccount.jurisdiction,
  activeCaseId:
    initialSaved?.activeCaseId !== undefined
      ? initialSaved.activeCaseId
      : defaultAccount.activeCaseId,
  piiMasked: true,
  zeroTrustActive: true,
  breakGlassActive: false,
  isAuthenticated: initialSaved?.isAuthenticated || false,
  rememberMe: initialSaved?.rememberMe || false,

  selectDemoProfile: (badgeNumber: string) => {
    const account = DEMO_ACCOUNTS[badgeNumber];
    if (account) {
      set({
        badgeNumber: account.badgeNumber,
        fullName: account.fullName,
        role: account.role,
        roleLabel: account.roleLabel,
        clearanceLevel: account.clearanceLevel,
        jurisdiction: account.jurisdiction,
        activeCaseId: account.activeCaseId,
      });
    }
  },

  login: async (badgeOrUsername: string, password?: string, rememberMe = true) => {
    const query = (badgeOrUsername || "").trim().toLowerCase();
    const enteredPassword = (password || "").trim();

    // Check account matching
    const matchedAccount = Object.values(DEMO_ACCOUNTS).find((acc) => {
      return (
        acc.badgeNumber.toLowerCase() === query ||
        acc.username.toLowerCase() === query ||
        acc.badgeNumber.toLowerCase().includes(query) ||
        acc.fullName.toLowerCase().includes(query)
      );
    });

    // Attempt backend login first to get real token
    let realUser: any = null;
    let realToken: string | null = null;
    try {
      // Dynamic import to avoid circular dependency issues if any
      const { post, setSession } = await import("../services/api/real_client");
      const loginRes = await post("/auth/login", { username: badgeOrUsername, password: password });
      if (loginRes && loginRes.token && loginRes.user) {
        realToken = loginRes.token as string;
        realUser = loginRes.user;
        if (realToken) setSession(realToken, realUser);
      }
    } catch (e) {
      console.warn("Backend login failed", e);
    }

    if (!matchedAccount && !realUser) {
      return {
        success: false,
        error: "Unrecognized Officer ID or invalid credentials.",
      };
    }

    if (matchedAccount && !realUser && enteredPassword !== DEMO_PASSWORD) {
      return {
        success: false,
        error: `Invalid Station Key. For demonstration access, use password: "${DEMO_PASSWORD}".`,
      };
    }

    // Build session data from either matchedAccount or realUser fallback
    const sessionData = {
      badgeNumber: matchedAccount ? matchedAccount.badgeNumber : realUser.username,
      fullName: matchedAccount ? matchedAccount.fullName : realUser.display_name,
      role: matchedAccount ? matchedAccount.role : realUser.role,
      roleLabel: matchedAccount ? matchedAccount.roleLabel : realUser.role,
      clearanceLevel: matchedAccount ? matchedAccount.clearanceLevel : 1,
      jurisdiction: matchedAccount ? matchedAccount.jurisdiction : realUser.jurisdiction,
      activeCaseId: matchedAccount ? matchedAccount.activeCaseId : "CASE-0001",
      isAuthenticated: true,
      rememberMe,
    };

    try {
      if (typeof window !== "undefined") {
        if (rememberMe) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
          sessionStorage.removeItem(STORAGE_KEY);
        } else {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // Storage quota or policy error fallback
    }

    set({
      ...sessionData,
      piiMasked: true,
      zeroTrustActive: true,
      breakGlassActive: false,
    });

    return { success: true };
  },

  logout: () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage fallback
    }

    const current = get();
    set({
      isAuthenticated: false,
      rememberMe: false,
      activeCaseId: current.activeCaseId,
    });
  },
}));
