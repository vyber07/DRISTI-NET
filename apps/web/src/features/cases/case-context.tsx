import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getCaseDetails } from "@/services/api/casesApi";
import type { CaseDetail } from "@/types/case";

/**
 * The case being viewed, loaded once by CaseLayout and shared by every tab, so tabs no longer refetch it or fall
 * out of the case layout (graph, review and reports pages used to render their own headers).
 */
interface CaseContextValue {
  caseId: string;
  caseData: CaseDetail;
  /** user_id → display name, for showing people instead of USR- IDs. Falls back to the ID itself. */
  personName: (userId: string | null | undefined) => string;
  reload: () => void;
}

const Ctx = createContext<CaseContextValue | null>(null);

export function useCase(): CaseContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCase() must be used inside <CaseProvider>");
  return v;
}

/** Like useCase(), but returns null outside a case (for components that also render elsewhere). */
export function useOptionalCase(): CaseContextValue | null {
  return useContext(Ctx);
}

export type CaseLoad =
  | { state: "loading" }
  | { state: "denied"; message: string }
  | { state: "error"; message: string; trace?: string }
  | { state: "ready"; caseData: CaseDetail };

export function useCaseLoader(caseId: string): [CaseLoad, () => void] {
  const [load, setLoad] = useState<CaseLoad>({ state: "loading" });
  const [nonce, setNonce] = useState(0);
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    // DEF-078: never keep the previous case on screen while another loads or is refused. A refresh of the SAME case
    // (after an upload or a decision) keeps it on screen: resetting to "loading" unmounted the tab and lost its state.
    if (loadedFor.current !== caseId) setLoad({ state: "loading" });
    getCaseDetails(caseId)
      .then((r) => { if (alive && r.data) { loadedFor.current = caseId; setLoad({ state: "ready", caseData: r.data }); } })
      .catch((e: any) => {
        if (!alive) return;
        loadedFor.current = null;
        if (e?.status === 403 || e?.status === 404) setLoad({ state: "denied", message: e?.status === 404 ? "This case does not exist." : (e?.message || "Access denied.") });
        else setLoad({ state: "error", message: e?.message || "The case could not be loaded.", trace: e?.trace });
      });
    return () => { alive = false; };
  }, [caseId, nonce]);
  return [load, useCallback(() => setNonce((n) => n + 1), [])];
}

export function CaseProvider({ caseId, caseData, reload, children }: { caseId: string; caseData: CaseDetail; reload: () => void; children: ReactNode }) {
  const value = useMemo<CaseContextValue>(() => {
    const names = new Map(caseData.people.map((p) => [p.user_id, p.display_name]));
    return {
      caseId,
      caseData,
      reload,
      personName: (id) => (id ? names.get(id) ?? id : "—"),
    };
  }, [caseId, caseData, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
