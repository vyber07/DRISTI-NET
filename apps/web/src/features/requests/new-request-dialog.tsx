import { useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { roleLabel } from "@/lib/permissions";
import { type CategoryField, type RequestMeta, type RequestPriority, createRequest } from "@/services/api/userRequestsApi";

const field = "mt-1 block w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft";

/** Server validation errors arrive as [{loc, msg}]; show them next to the right field. */
function fieldErrors(e: any): Record<string, string> {
  try {
    const list = JSON.parse(e?.message);
    if (Array.isArray(list)) return Object.fromEntries(list.map((x: any) => [String(x.loc?.[x.loc.length - 1] ?? "form"), String(x.msg)]));
  } catch { /* plain message */ }
  return {};
}

function choiceLabel(f: CategoryField, c: string): string {
  return f.name === "requested_role" ? roleLabel(c) : c;
}

/**
 * Raise a request (POST /user-requests). The category's fields come from the server (GET /user-requests/categories),
 * so the form always asks for what the server requires. "Save draft" keeps it private and editable; "Submit" sends it
 * to administrators. The server validates everything again.
 */
export function NewRequestDialog({ open, onOpenChange, meta, presetCategory }: {
  open: boolean; onOpenChange: (o: boolean) => void; meta: RequestMeta | null; presetCategory?: string;
}) {
  const navigate = useNavigate();
  const ids = { cat: useId(), title: useId(), just: useId(), prio: useId(), err: useId() };
  const fieldIdBase = useId();
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [justification, setJustification] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("NORMAL");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory(presetCategory || meta?.categories[0]?.code || ""); setTitle(""); setJustification(""); setPriority("NORMAL");
    setDetails({}); setErrors({}); setFormError(null);
  }, [open, meta, presetCategory]);

  const cat = useMemo(() => meta?.categories.find((c) => c.code === category), [meta, category]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (title.trim().length < 5) e.title = "At least 5 characters.";
    if (justification.trim().length < 20) e.justification = "Explain why, in at least 20 characters.";
    for (const f of cat?.fields ?? []) {
      const v = (details[f.name] ?? "").trim();
      if (!v) { if (f.required) e[f.name] = `${f.label} is required.`; continue; }
      if (f.kind === "integer" && (!/^\d+$/.test(v) || (f.min != null && +v < f.min) || (f.max != null && +v > f.max))) e[f.name] = `Between ${f.min} and ${f.max}.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const send = async (submit: boolean) => {
    setFormError(null);
    if (!cat || !validate()) return;
    const clean: Record<string, string | number> = {};
    for (const f of cat.fields) {
      const v = (details[f.name] ?? "").trim();
      if (v) clean[f.name] = f.kind === "integer" ? Number(v) : v;
    }
    setBusy(true);
    try {
      const r = await createRequest({ category, title: title.trim(), justification: justification.trim(), priority, details: clean, submit });
      onOpenChange(false);
      navigate(`/requests/${r.request_id}`);
    } catch (e: any) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) { setErrors(fe); setFormError("Please correct the highlighted fields."); }
      else setFormError(e?.message || "The request was not saved.");
    } finally { setBusy(false); }
  };

  const errFor = (name: string) => errors[name] && <p className="mt-1 text-xs text-critical-red" role="alert">{errors[name]}</p>;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="new-request-dialog" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New request</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Administrators review requests. Every change to your request, and who made it, is recorded.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void send(true); }} aria-describedby={formError ? ids.err : undefined}>
          <div>
            <label htmlFor={ids.cat} className="text-sm font-medium">Type of request</label>
            <select id={ids.cat} value={category} className={field} onChange={(e) => { setCategory(e.target.value); setDetails({}); setErrors({}); }}>
              {meta?.categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            {cat && <p className="mt-1 text-xs text-text-secondary">{cat.description} {cat.fulfilment_text}</p>}
          </div>
          {cat?.fields.map((f, i) => {
            const id = `${fieldIdBase}-${i}`;
            const value = details[f.name] ?? "";
            const set = (v: string) => setDetails((d) => ({ ...d, [f.name]: v }));
            return (
              <div key={f.name}>
                <label htmlFor={id} className="text-sm font-medium">{f.label}{f.required ? "" : <span className="font-normal text-text-secondary"> (optional)</span>}</label>
                {f.kind === "choice" ? (
                  <select id={id} value={value} onChange={(e) => set(e.target.value)} className={field} aria-invalid={!!errors[f.name]}>
                    <option value="">Choose…</option>
                    {f.choices.map((c) => <option key={c} value={c}>{choiceLabel(f, c)}</option>)}
                  </select>
                ) : (
                  <input id={id} value={value} onChange={(e) => set(e.target.value)} aria-invalid={!!errors[f.name]}
                    inputMode={f.kind === "integer" ? "numeric" : undefined} maxLength={f.max && f.kind !== "integer" ? f.max : 64}
                    className={`${field} ${f.kind === "case" ? "font-mono uppercase" : ""}`} placeholder={f.help || undefined} />
                )}
                {errFor(f.name)}
              </div>
            );
          })}
          <div>
            <label htmlFor={ids.title} className="text-sm font-medium">Title</label>
            <input id={ids.title} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} aria-invalid={!!errors.title} />
            {errFor("title")}
          </div>
          <div>
            <label htmlFor={ids.just} className="text-sm font-medium">Why do you need this?</label>
            <textarea id={ids.just} value={justification} onChange={(e) => setJustification(e.target.value)} rows={4} maxLength={2000}
              className={field} aria-invalid={!!errors.justification} />
            {errFor("justification")}
          </div>
          <div>
            <label htmlFor={ids.prio} className="text-sm font-medium">Priority</label>
            <select id={ids.prio} value={priority} onChange={(e) => setPriority(e.target.value as RequestPriority)} className={field}>
              {(meta?.priorities ?? ["NORMAL"]).map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          {formError && <p id={ids.err} role="alert" className="text-sm text-critical-red">{formError}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Close</Button>
            <Button type="button" variant="secondary" onClick={() => void send(false)} disabled={busy || !cat}>Save draft</Button>
            <Button type="submit" variant="primary" disabled={busy || !cat}>{busy ? "Saving…" : "Submit request"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
