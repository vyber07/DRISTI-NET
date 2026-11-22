import { useEffect, useId, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * One accessible dialog for every action that needs an audited reason: download original, reveal, review decision,
 * reversal. Replaces window.prompt (DEF-101 download) and the ad-hoc HITL confirmation modal.
 * The reason is passed to `onConfirm` and never stored by this component.
 */
export function ReasonDialog({
  open, onOpenChange, title, description, confirmLabel, minLength = 5, onConfirm, children, destructive, placeholder,
  initialReason = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  minLength?: number;
  /** Resolve to null on success, or to an error message to keep the dialog open and show it. */
  onConfirm: (reason: string) => Promise<string | null>;
  children?: ReactNode;
  destructive?: boolean;
  placeholder?: string;
  initialReason?: string;
}) {
  const [reason, setReason] = useState(initialReason);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldId = useId();
  const errId = useId();

  useEffect(() => {
    if (open) { setReason(initialReason); setError(null); setBusy(false); }
  }, [open, initialReason]);

  const submit = async () => {
    const r = reason.trim();
    if (r.length < minLength) {
      setError(`Enter a reason of at least ${minLength} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    const err = await onConfirm(r).catch((e: any) => e?.message || "The request failed.");
    setBusy(false);
    if (err) setError(err);
    else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="reason-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">{description}</DialogDescription>
        </DialogHeader>
        {children}
        <form
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
          className="space-y-1.5"
        >
          <label htmlFor={fieldId} className="text-sm font-medium text-text-primary">
            Reason <span className="text-text-secondary font-normal">(recorded in the audit log)</span>
          </label>
          <textarea
            id={fieldId}
            rows={3}
            value={reason}
            autoFocus
            onChange={(e) => { setReason(e.target.value); if (error) setError(null); }}
            aria-invalid={!!error}
            aria-describedby={error ? errId : undefined}
            placeholder={placeholder}
            className="w-full rounded-md border border-border-strong bg-surface-1 p-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-electric-blue-soft"
          />
          <div className="flex justify-between text-xs text-text-secondary">
            <span>At least {minLength} characters, in your own words.</span>
            <span aria-hidden="true">{reason.trim().length}</span>
          </div>
          {error && <p id={errId} role="alert" className="text-sm text-critical-red">{error}</p>}
          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant={destructive ? "destructive" : "primary"} disabled={busy}>
              {busy ? "Working…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
