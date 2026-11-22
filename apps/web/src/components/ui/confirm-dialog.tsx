import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** Irreversible or access-removing actions: the confirm button uses the destructive style. */
  destructive?: boolean;
}

/**
 * Accessible confirmation (P2.1), replacing window.confirm (design system §5/§6: confirmation only for audited or
 * irreversible actions, always in our own Radix dialog). It traps and restores focus, Esc or Cancel resolve false,
 * it nests inside another open dialog, and it portals into the full-screen element when one is active.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: "Remove …?", confirmLabel: "Remove", destructive: true }))) return;
 *   ...
 *   return <>{...}{confirmDialog}</>;
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setOpts(o);
  }), []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  };

  const confirmDialog = (
    <Dialog open={opts !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
      <DialogContent data-testid="confirm-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{opts?.title}</DialogTitle>
          {opts?.description && <DialogDescription className="text-sm text-text-secondary">{opts.description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => settle(false)} autoFocus>Cancel</Button>
          <Button type="button" variant={opts?.destructive ? "destructive" : "primary"} onClick={() => settle(true)}
            data-testid="confirm-dialog-confirm">{opts?.confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { confirm, confirmDialog };
}
