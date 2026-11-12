import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, FactList, LoadingState, PageBody, PageHeader, Section } from "@/components/layout/page";
import { roleLabel } from "@/lib/permissions";
import {
  type Person, type RequestAction, type UserRequest, STATUS_LABEL, STATUS_TONE, actOnRequest, editRequest, getRequest,
} from "@/services/api/userRequestsApi";
import { fmtTime } from "./requests-page";

const field = "mt-1 block w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft";

function who(p: Person | null | undefined): string {
  if (!p) return "—";
  return p.display_name || p.username || p.user_id;
}

const DETAIL_LABEL: Record<string, string> = {
  case_id: "Case", purpose: "Purpose", requested_role: "Requested role", action: "Permission", duration_days: "Duration (days)",
  item_reference: "Item",
};

const EVENT_TEXT: Record<string, string> = {
  CREATED: "created the request", EDITED: "edited the draft", SUBMITTED: "submitted it", CANCELLED: "withdrew it",
  CLAIMED: "started reviewing", RELEASED: "released it back to the queue", APPROVED: "approved it", REJECTED: "rejected it",
  COMPLETED: "completed it",
};

/** What each action button says, and how the server's version-conflict and transition errors are explained. */
const ACTION_UI: Record<Exclude<RequestAction, "edit">, { label: string; reason: "required" | "optional" | "none" | "manual"; variant: "primary" | "secondary" | "ghost" }> = {
  submit: { label: "Submit", reason: "none", variant: "primary" },
  claim: { label: "Start review", reason: "none", variant: "primary" },
  approve: { label: "Approve", reason: "required", variant: "primary" },
  reject: { label: "Reject", reason: "required", variant: "secondary" },
  complete: { label: "Complete", reason: "manual", variant: "primary" },
  release: { label: "Release", reason: "required", variant: "ghost" },
  cancel: { label: "Withdraw", reason: "optional", variant: "ghost" },
};

function explain(e: any): string {
  if (e?.code === "VERSION_CONFLICT") return "Someone else changed this request a moment ago. It has been reloaded; check it and try again.";
  return e?.message || "The action failed.";
}

function EditDraftDialog({ row, open, onOpenChange, onSaved }: { row: UserRequest; open: boolean; onOpenChange: (o: boolean) => void; onSaved: (r: UserRequest) => void }) {
  const [title, setTitle] = useState(row.title);
  const [justification, setJustification] = useState(row.justification);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setTitle(row.title); setJustification(row.justification); setError(null); } }, [open, row]);
  const save = async () => {
    setBusy(true); setError(null);
    try { onSaved(await editRequest(row.request_id, { version: row.version, title: title.trim(), justification: justification.trim() })); onOpenChange(false); }
    catch (e: any) { setError(explain(e)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit draft {row.reference}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">Only drafts can be edited. Submit it when it is ready.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label className="block text-sm font-medium">Title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} /></label>
          <label className="block text-sm font-medium">Why do you need this?<textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={4} maxLength={2000} className={field} /></label>
          {error && <p role="alert" className="text-sm text-critical-red">{error}</p>}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button><Button type="submit" variant="primary" disabled={busy}>Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One request (GET /user-requests/{id}): its details, the actions this account may take now, and the full history. */
export function RequestDetailPage() {
  const { requestId } = useParams();
  const id = Number(requestId);
  const [row, setRow] = useState<UserRequest | null>(null);
  const [error, setError] = useState<{ message: string; trace?: string; status?: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Exclude<RequestAction, "edit"> | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    if (!Number.isInteger(id) || id < 1) { setError({ message: "Request not found.", status: 404 }); return; }
    getRequest(id).then(setRow).catch((e) => setError({ message: e?.message || "The request could not be loaded.", trace: e?.trace, status: e?.status }));
  }, [id]);
  useEffect(load, [load]);

  const run = async (action: Exclude<RequestAction, "edit">, reason?: string): Promise<string | null> => {
    if (!row) return null;
    try {
      const r = await actOnRequest(row.request_id, action, row.version, reason);
      setRow(r); setNotice(null);
      return null;
    } catch (e: any) {
      if (e?.code === "VERSION_CONFLICT" || e?.code === "INVALID_TRANSITION") load();
      return explain(e);
    }
  };
  const direct = async (action: Exclude<RequestAction, "edit">) => {
    setBusy(true);
    const err = await run(action);
    setBusy(false);
    if (err) setNotice(err);
  };

  if (error) {
    return <div className="p-6"><ErrorState title={error.status === 404 ? "Request not found" : undefined}
      message={error.status === 404 ? "It does not exist, or it is not yours to see." : error.message} trace={error.trace}
      onRetry={error.status === 404 ? undefined : load} /></div>;
  }
  if (!row) return <div className="p-6"><LoadingState label="Loading request…" /></div>;

  const actions = row.allowed_actions.filter((a): a is Exclude<RequestAction, "edit"> => a !== "edit");
  const ctx = row.review_context;
  const pendingUi = pending ? ACTION_UI[pending] : null;
  const reasonMin = pendingUi?.reason === "optional" ? 0 : 10;
  const manualComplete = pending === "complete" && row.fulfilment === "MANUAL";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={<Inbox className="h-5 w-5" />}
        crumbs={[{ label: "Requests", to: "/requests" }, { label: row.reference }]}
        title={row.title}
        description={<span className="inline-flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
          <span>{row.category_label}</span><span aria-hidden="true">·</span><span className="font-mono text-xs">{row.reference}</span>
        </span>}
        actions={<>
          {row.allowed_actions.includes("edit") && <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit draft</Button>}
          {actions.map((a) => (
            <Button key={a} size="sm" variant={ACTION_UI[a].variant} disabled={busy} data-testid={`action-${a}`}
              onClick={() => (ACTION_UI[a].reason === "none" || (a === "complete" && row.fulfilment === "AUTO") ? void direct(a) : setPending(a))}>
              {ACTION_UI[a].label}
            </Button>
          ))}
        </>}
      />
      <PageBody>
        {notice && <div role="alert" className="flex items-start gap-2 rounded-lg border border-critical-red/40 bg-critical-red/5 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-critical-red" />{notice}</div>}
        {row.status === "COMPLETED" && row.completion_note && (
          <div className="flex items-start gap-2 rounded-lg border border-verified-emerald/40 bg-verified-emerald/5 p-3 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 text-verified-emerald" />{row.completion_note}</div>
        )}
        <Section title="Request">
          <div className="space-y-4 p-4">
            <FactList columns={3} items={[
              { label: "Requested by", value: `${who(row.requester)}${row.requester.role ? ` (${roleLabel(row.requester.role)})` : ""}` },
              { label: "Priority", value: row.priority.toLowerCase() },
              { label: "Created", value: fmtTime(row.created_at) },
              { label: "Submitted", value: fmtTime(row.submitted_at) },
              { label: "Reviewer", value: who(row.reviewer) },
              { label: "Decided", value: fmtTime(row.decided_at) },
              ...Object.entries(row.details).map(([k, v]) => ({ label: DETAIL_LABEL[k] ?? k.replace(/_/g, " "), value: k === "requested_role" ? roleLabel(String(v)) : String(v) })),
            ]} />
            <div>
              <h3 className="text-xs font-medium uppercase text-text-muted">Why it is needed</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm">{row.justification}</p>
            </div>
            {row.decision_reason && (
              <div>
                <h3 className="text-xs font-medium uppercase text-text-muted">Decision reason</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{row.decision_reason}</p>
              </div>
            )}
          </div>
        </Section>

        {ctx && (
          <Section title="Review checks" description="What the system will check when this request is completed.">
            <div className="p-4">
              <FactList columns={3} items={[
                { label: "Requester account", value: ctx.requester_active ? "Active" : "Deactivated" },
                { label: "Requester jurisdiction", value: ctx.requester_jurisdiction || "—" },
                ...(ctx.case !== undefined ? [{ label: "Case", value: ctx.case ? `${ctx.case.case_id}: ${ctx.case.title} (${ctx.case.jurisdiction})` : "No such case" }] : []),
                ...(ctx.can_apply !== undefined ? [{ label: "Can be applied", value: ctx.can_apply ? "Yes" : "No: reject it with a reason" }] : []),
              ]} />
              {row.fulfilment === "MANUAL" && <p className="mt-3 text-xs text-text-secondary">Completed by hand: record what was done (for example the permission override ID) when completing.</p>}
            </div>
          </Section>
        )}

        <Section title="History" description="Every change, who made it and when. This record cannot be edited.">
          <ol className="divide-y divide-border-subtle" data-testid="request-history">
            {(row.history ?? []).map((e, i) => (
              <li key={i} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{who(e.actor)}</span>
                  <span className="text-text-secondary"> ({roleLabel(e.actor_role)}) {EVENT_TEXT[e.event] ?? e.event.toLowerCase()}</span>
                  {e.to_status && e.from_status !== e.to_status && <> <Badge tone={STATUS_TONE[e.to_status]}>{STATUS_LABEL[e.to_status]}</Badge></>}
                  {e.reason && <p className="mt-0.5 whitespace-pre-wrap text-text-secondary">“{e.reason}”</p>}
                  {typeof e.detail?.note === "string" && <p className="mt-0.5 text-text-secondary">{e.detail.note}</p>}
                </div>
                <time className="whitespace-nowrap text-xs text-text-secondary" dateTime={e.at}>{fmtTime(e.at)}</time>
              </li>
            ))}
          </ol>
        </Section>
      </PageBody>

      {row.allowed_actions.includes("edit") && <EditDraftDialog row={row} open={editing} onOpenChange={setEditing} onSaved={setRow} />}
      <ReasonDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? `${pendingUi!.label} ${row.reference}` : ""}
        description={pending === "approve" ? "Explain why this request is approved. The requester sees this reason."
          : pending === "reject" ? "Explain why this request is rejected. The requester sees this reason."
          : pending === "release" ? "Explain why you are handing this request back to the queue."
          : manualComplete ? "Record what was done to fulfil it, for example the permission override ID."
          : "Optionally say why you are withdrawing it."}
        confirmLabel={pendingUi?.label ?? "Confirm"}
        minLength={reasonMin}
        destructive={pending === "reject" || pending === "cancel"}
        onConfirm={(reason) => run(pending!, reason || undefined)}
      />
    </div>
  );
}
