import { useEffect, useId, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertOctagon, CheckCircle2, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { useAuthStore } from "@/stores/authStore";
import { can, deniedReason } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * Source viewer: the stored file around the exact location a claim was read from (highlighted), masked by default.
 * An accessible dialog (labelled, Escape closes, focus trapped and restored). Revealing masked values needs a
 * permitted role and a reason, and writes an UNMASK audit event server-side.
 */
export function ProvenanceViewer() {
  const { isModalOpen, record, closeModal, revealContext, isRevealing, revealError, isLoading, error } = useProvenanceStore();
  const role = useAuthStore((s) => s.user?.role);
  const [reason, setReason] = useState("");
  const reasonId = useId();
  useEffect(() => { if (!isModalOpen) setReason(""); }, [isModalOpen]);

  const mayReveal = can(role, "reveal");
  const loc = record?.locator ?? {};
  const where = ["page", "line", "row", "json_path"].filter((k) => loc[k] !== undefined && loc[k] !== null).map((k) => `${k.replace("_", " ")} ${loc[k]}`).join(", ");

  return (
    <DialogPrimitive.Root open={isModalOpen} onOpenChange={(o) => { if (!o) closeModal(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content data-testid="provenance-viewer"
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border-strong bg-surface-1 shadow-panel focus:outline-none">
          <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold text-text-primary">Source: {record?.filename ?? "evidence"}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-text-secondary">
                {record ? (where ? `Highlighted at ${where}. ` : "Opening lines of the file. ") + "Sensitive values are masked." : "Stored source text for an evidence item."}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-md p-1.5 text-text-secondary hover:bg-surface-2" aria-label="Close source viewer"><X className="h-4 w-4" /></DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {!record ? (
              isLoading ? <p role="status" className="text-sm text-text-secondary">Loading source…</p>
                : <p role="alert" className="text-sm text-critical-red">Source not available: {error || "unknown error"}</p>
            ) : (
              <>
                <p className={cn("flex items-center gap-2 text-sm", record.hash_match ? "text-verified-emerald" : "text-critical-red")}>
                  {record.hash_match ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertOctagon className="h-4 w-4" aria-hidden="true" />}
                  {record.hash_match ? "The stored file matches its recorded SHA-256." : "The stored file does NOT match its recorded SHA-256 — treat this text with caution."}
                </p>
                <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-2">
                  <pre className="py-2 font-mono text-xs leading-5 text-text-primary">
                    {record.lines.map((line, i) => (
                      <div key={i} data-hit={line.hit ? "true" : undefined} data-line={line.n}
                        className={cn("flex gap-3 px-3", line.hit && "bg-amber/20 border-l-4 border-amber font-semibold")}>
                        <span className="w-10 shrink-0 select-none text-right text-text-secondary">{line.n}</span>
                        <span className="whitespace-pre-wrap break-words">{line.text}</span>
                        {line.hit && <span className="sr-only"> (cited line)</span>}
                      </div>
                    ))}
                  </pre>
                </div>

                <section aria-labelledby={`${reasonId}-h`} className="border-t border-border-subtle pt-4">
                  <h3 id={`${reasonId}-h`} className="text-sm font-semibold text-text-primary">Reveal masked values</h3>
                  {mayReveal ? (
                    <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (reason.trim().length >= 5) void revealContext(reason.trim()); }}>
                      <div className="flex-1 min-w-[16rem]">
                        <label htmlFor={reasonId} className="text-xs font-medium text-text-secondary">Reason (recorded in the audit log, at least 5 characters)</label>
                        <input id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)}
                          className="mt-1 w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft" />
                      </div>
                      <Button type="submit" variant="secondary" className="gap-1.5" disabled={isRevealing || reason.trim().length < 5}>
                        <Eye className="h-4 w-4" aria-hidden="true" /> {isRevealing ? "Revealing…" : "Reveal"}
                      </Button>
                    </form>
                  ) : <p className="mt-1 text-sm text-text-secondary">{deniedReason(role, "reveal masked values")}</p>}
                  {revealError && <p role="alert" className="mt-2 text-sm text-critical-red">{revealError}</p>}
                </section>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
