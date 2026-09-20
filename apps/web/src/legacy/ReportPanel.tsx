import { useState } from 'react'
import { post, currentUser } from '../services/api/real_client'
import { ErrorBox } from './common'

export default function ReportPanel({ caseId }: { caseId: string }) {
  const [comments, setComments] = useState('')
  const [rep, setRep] = useState<any>(null)
  const [err, setErr] = useState<any>(null)
  const user = currentUser()
  async function exportJson() { setErr(null); try { setRep(await post(`/cases/${caseId}/report`, { analyst_comments: comments, format: 'json' })) } catch (ex) { setErr(ex) } }
  async function exportHtml() {
    setErr(null)
    try { const html = await post<string>(`/cases/${caseId}/report`, { analyst_comments: comments, format: 'html' }); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() } } catch (ex) { setErr(ex) }
  }
  async function exportCourtPdf() {
    setErr(null)
    try {
      const t = localStorage.getItem('drishti.token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (t) headers.Authorization = `Bearer ${t}`;
      const res = await fetch(`/api/v1/cases/${caseId}/report/court-pdf`, { method: 'POST', headers, body: JSON.stringify({ analyst_comments: comments }) });
      if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drishti-dossier-${caseId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (ex) { setErr(ex); }
  }
  return (
    <div className="grid2">
      <div className="card">
        <h3>Human-reviewed report</h3>
        <p className="small muted">Contains scope, synthetic-data notice, evidence hashes, accepted/rejected/deferred/contradictory items, source references, graph snapshot, limitations, access context and an audit ID. Identifiers stay masked.</p>
        <label className="visually-hidden" htmlFor="report-comments">analyst comments</label>
        <textarea id="report-comments" value={comments} onChange={e => setComments(e.target.value)} placeholder="Analyst comments (included verbatim)…" />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="primary" onClick={exportJson} disabled={!['INVESTIGATOR', 'REVIEWER', 'ANALYST', 'ADMIN'].includes(user?.role || '')}>Export JSON</button>
          <button onClick={exportHtml} disabled={!['INVESTIGATOR', 'REVIEWER', 'ANALYST', 'ADMIN'].includes(user?.role || '')}>Open HTML</button>
          <button className="danger" onClick={exportCourtPdf} disabled={!['INVESTIGATOR', 'REVIEWER', 'ANALYST', 'ADMIN'].includes(user?.role || '')}>Court-ready PDF</button>
        </div>
        <ErrorBox e={err} />
      </div>
      <div className="card">
        {rep ? (
          <>
            <h3>Report {rep.audit_id}</h3>
            <dl className="kv small">
              <dt>snapshot</dt><dd className="mono">{rep.graph_snapshot_id}</dd>
              <dt>decisions</dt><dd>{Object.entries(rep.decisions).map(([k, v]) => `${k}: ${v}`).join(' · ')}</dd>
              <dt>evidence</dt><dd>{rep.evidence.length} files</dd>
              <dt>relationships</dt><dd>{rep.relationships.length} aggregated</dd>
              <dt>access context</dt><dd className="mono">{JSON.stringify(rep.access_context)}</dd>
            </dl>
            <div className="notice small">{rep.statement}</div>
            <details style={{ marginTop: 8 }}><summary className="small">full JSON</summary><pre className="small" style={{ maxHeight: 400, overflow: 'auto' }}>{JSON.stringify(rep, null, 1)}</pre></details>
          </>
        ) : <div className="muted">Export to see the report summary here.</div>}
      </div>
    </div>
  )
}
