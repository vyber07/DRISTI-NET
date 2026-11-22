import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getEvidenceById, getEvidenceContext } from "@/services/api/evidenceApi";
import { useProvenanceStore } from "@/stores/provenanceStore";

interface Line { n: number; text: string; hit: boolean }
interface Item { evidence_id: string; filename: string; status: string; lines: Line[]; error: string | null }

async function loadOne(id: string): Promise<Item> {
  const ev: any = (await getEvidenceById(id)).data;
  const item: Item = { evidence_id: ev.evidence_id, filename: ev.filename, status: ev.status, lines: [], error: null };
  try {
    const ctx: any = (await getEvidenceContext(id, { line: 1, window: 10 })).data;
    item.lines = Array.isArray(ctx?.lines) ? ctx.lines : [];
  } catch (e: any) {
    item.error = e?.status === 409 ? `Not shown: ${e.message}` : `Could not load: ${e?.message || "error"}`;
  }
  return item;
}

/**
 * The evidence files a candidate cites, with their opening lines (masked) and a link to the full source viewer.
 * Only API data (DEF-058: this pane once showed a fabricated call record).
 */
export function SourcePane({ evidenceIds }: { evidenceIds: string[] }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const openSource = useProvenanceStore((s) => s.openProvenanceForRecord);
  const key = evidenceIds.join(",");

  useEffect(() => {
    let alive = true;
    const ids = evidenceIds.filter(Boolean).slice(0, 6);
    setItems(null); setError(null); setActive(0);
    if (!ids.length) { setItems([]); return; }
    Promise.all(ids.map(loadOne)).then((r) => alive && setItems(r)).catch((e) => alive && setError(e?.message || "Could not load the cited evidence"));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-labelledby="cited-h" className="rounded-lg border border-border-subtle bg-surface-1 min-w-0 self-start xl:sticky xl:top-0">
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 id="cited-h" className="text-[15px] font-semibold text-text-primary">Cited evidence</h3>
        <p className="text-xs text-text-secondary">The files this candidate was built from. Open a file to see it in full.</p>
      </div>
      <div className="p-4">
        {error ? <p role="alert" className="text-sm text-critical-red">{error}</p>
          : items === null ? <p className="text-sm text-text-secondary">Loading…</p>
          : items.length === 0 ? <p className="text-sm text-text-secondary">The candidate cites no evidence files.</p>
          : (
            <>
              <div role="tablist" aria-label="Cited files" className="flex flex-wrap gap-1">
                {items.map((it, i) => (
                  <button key={it.evidence_id} role="tab" type="button" aria-selected={i === active} onClick={() => setActive(i)}
                    className={`rounded-md px-2.5 py-1 text-xs ${i === active ? "bg-electric-blue/10 font-semibold text-electric-blue" : "text-text-secondary hover:bg-surface-2"}`}>
                    {it.filename}
                  </button>
                ))}
              </div>
              {(() => {
                const cur = items[Math.min(active, items.length - 1)];
                return (
                  <div role="tabpanel" className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge code={cur.status} />
                      <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => openSource(cur.evidence_id)}>
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Open full source
                      </Button>
                    </div>
                    <p className="text-xs text-text-secondary">First lines of the file (masked) — not necessarily the lines about these records. Use “Open full source” to read the whole file.</p>
                    {cur.error ? <p className="text-sm text-text-secondary">{cur.error}</p>
                      : cur.lines.length === 0 ? <p className="text-sm text-text-secondary">No text lines.</p>
                      : (
                        <pre className="max-h-80 overflow-auto rounded-md bg-surface-2 py-2 font-mono text-xs leading-5">
                          {cur.lines.map((l) => (
                            <div key={l.n} className="flex gap-3 px-2"><span className="w-7 shrink-0 select-none text-right text-text-secondary">{l.n}</span><span className="whitespace-pre-wrap break-words">{l.text}</span></div>
                          ))}
                        </pre>
                      )}
                  </div>
                );
              })()}
            </>
          )}
      </div>
    </section>
  );
}
