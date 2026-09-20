import { useEffect, useState } from 'react'
import { get, post, postForm, currentUser } from '../api/client'
import { ErrorBox, StatusPill, clickableRow } from './common'

const FLOW = 'UPLOADED → HASHED → QUARANTINED → MALWARE_SCANNING → CLEAN → ACCEPTED → PROCESSING → EXTRACTED → ENTITY_CANDIDATES → HITL → GRAPH_PROJECTED → ACTIVE'

export default function EvidencePanel({ caseId, onChange }: { caseId: string; onChange: () => void }) {
  const [items, setItems] = useState<any[]>([])
  const [err, setErr] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState<any>(null)
  const [claims, setClaims] = useState<any[]>([])
  const [verify, setVerify] = useState<any>(null)
  const [force, setForce] = useState('')
  const [label, setLabel] = useState('user-upload')
  const user = currentUser()
  const canUpload = ['EVIDENCE_OFFICER', 'INVESTIGATOR', 'ADMIN'].includes(user?.role || '')
  const load = () => get(`/cases/${caseId}/evidence`).then(setItems).catch(setErr)
  useEffect(() => { load() }, [caseId])

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null); setBusy(true)
    const fd = new FormData(e.currentTarget)
    fd.set('source_label', label)
    if (force) fd.set('force_scan_outcome', force)
    try { const r = await postForm(`/cases/${caseId}/evidence`, fd); await load(); onChange(); open(r) } catch (ex) { setErr(ex) } finally { setBusy(false) }
  }
  async function open(ev: any) {
    setVerify(null)
    const full = await get(`/evidence/${ev.evidence_id}`)
    setSel(full)
    try { setClaims(await get(`/evidence/${ev.evidence_id}/claims?limit=40`)) } catch { setClaims([]) }
  }
  async function reprocess(id: string) { setErr(null); try { const r = await post(`/evidence/${id}/process`, {}); await load(); onChange(); setSel(r) } catch (ex) { setErr(ex) } }
  async function doVerify(id: string) { setErr(null); try { setVerify(await get(`/evidence/${id}/verify`)) } catch (ex) { setErr(ex) } }
  async function tamper(id: string) { setErr(null); try { await post(`/demo/tamper/${id}`); await doVerify(id) } catch (ex) { setErr(ex) } }

  return (
    <div className="grid2">
      <div>
        {canUpload && (
          <div className="card">
            <h3>Upload a record</h3>
            <form onSubmit={upload} className="row">
              <label className="visually-hidden" htmlFor="evidence-file">choose file to upload</label>
              <input id="evidence-file" type="file" name="file" required accept=".csv,.json,.pdf,.txt,.zip" />
              <label className="visually-hidden" htmlFor="evidence-source-label">source label</label>
              <input id="evidence-source-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="source label" style={{ width: 120 }} />
              <select value={force} onChange={e => setForce(e.target.value)} title="Demo only: simulate a scanner failure">
                <option value="">scanner: real result</option>
                <option>SCAN_FAILED</option><option>SCAN_TIMEOUT</option><option>SCANNER_UNAVAILABLE</option>
              </select>
              <button className="primary" disabled={busy} type="submit">{busy ? 'processing…' : 'Upload'}</button>
            </form>
            <p className="small muted mono" style={{ marginBottom: 0 }}>{FLOW}</p>
          </div>
        )}
        <div className="card">
          <h3>Evidence manifest</h3>
          <ErrorBox e={err} />
          <table>
            <thead><tr><th>ID</th><th>File</th><th>Type</th><th>Status</th><th>Area</th><th>SHA-256</th><th>v</th></tr></thead>
            <tbody>
              {items.map(ev => (
                <tr key={ev.evidence_id} className="clickable" {...clickableRow(() => open(ev), `evidence ${ev.filename}, status ${ev.status}`)} style={sel?.evidence_id === ev.evidence_id ? { background: '#eef0fd' } : {}}>
                  <td className="mono">{ev.evidence_id.slice(4, 12)}</td><td>{ev.filename}</td><td className="small">{ev.record_type}</td>
                  <td><StatusPill s={ev.status} /></td><td><span className={`pill ${ev.storage_area === 'quarantine' ? 'warn' : 'ok'}`}>{ev.storage_area}</span></td>
                  <td className="mono">{ev.sha256.slice(0, 12)}…</td><td>{ev.version}</td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="muted">No evidence yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        {sel ? (
          <div className="card">
            <h3>{sel.filename} <StatusPill s={sel.status} /></h3>
            <dl className="kv">
              <dt>evidence_id</dt><dd className="mono">{sel.evidence_id}</dd>
              <dt>sha256</dt><dd className="mono">{sel.sha256}</dd>
              <dt>detected type</dt><dd>{sel.detected_type} · {sel.size_bytes} bytes · record type <b>{sel.record_type}</b></dd>
              <dt>storage</dt><dd>{sel.storage_area} · version {sel.version} · retention {sel.retention_policy}{sel.legal_hold ? ' · LEGAL HOLD' : ''}</dd>
              <dt>governance</dt><dd>{sel.classification} · {sel.jurisdiction} · {sel.purpose} · access {sel.access_class} · authority {sel.authority_reference}</dd>
              <dt>scan</dt><dd>{sel.scan_result ? <><StatusPill s={sel.scan_result} /> via <code>{sel.scan_engine}</code></> : <span className="muted">not scanned</span>}</dd>
              <dt>uploaded</dt><dd>{sel.created_at} by <code>{sel.uploaded_by}</code> · source {sel.source_label}</dd>
              {sel.error && <><dt>error</dt><dd className="error">{sel.error}</dd></>}
            </dl>
            <div className="row" style={{ margin: '10px 0' }}>
              <button onClick={() => doVerify(sel.evidence_id)}>Verify hash</button>
              {['QUARANTINED', 'SCAN_FAILED', 'SCAN_TIMEOUT', 'SCANNER_UNAVAILABLE', 'ACCEPTED', 'EXTRACTION_FAILED', 'EXTRACTED'].includes(sel.status) && canUpload && <button onClick={() => reprocess(sel.evidence_id)}>Retry / process</button>}
              {user?.role === 'ADMIN' && <button className="danger" onClick={() => tamper(sel.evidence_id)} title="Demo: alter stored bytes to show hash mismatch">Demo: tamper stored object</button>}
            </div>
            {verify && <div className={verify.match ? 'notice' : 'error'}><b>{verify.match ? 'Hash matches manifest' : 'HASH MISMATCH — stored object differs from manifest'}</b><br /><span className="small mono">expected {verify.expected_sha256}<br />actual&nbsp;&nbsp; {verify.actual_sha256}</span><br /><span className="small">{verify.note}</span></div>}
            <h4>Jobs</h4>
            <table><thead><tr><th>kind</th><th>status</th><th>attempts</th><th>trace</th><th>metrics / error</th></tr></thead>
              <tbody>{(sel.jobs || []).map((j: any) => <tr key={j.job_id}><td>{j.kind}</td><td><StatusPill s={j.status} /></td><td>{j.attempts}</td><td className="mono">{j.trace_id}</td><td className="small mono">{j.error ? j.error.split('\n')[0] : JSON.stringify(j.metrics)}</td></tr>)}</tbody></table>
            <h4>Extracted claims (first {claims.length}) — original ⇄ normalized, with source locator</h4>
            {sel.storage_area === 'quarantine' && <div className="notice">File is in quarantine. Nothing was extracted; nothing entered the graph.</div>}
            <table><thead><tr><th>kind</th><th>source</th><th>rel / attr</th><th>target / value</th><th>locator</th><th>conf</th></tr></thead>
              <tbody>{claims.map(c => <tr key={c.claim_id}><td className="small">{c.kind}</td><td>{c.source.label}</td><td className="small">{c.rel_type || c.attribute}</td>
                <td>{c.target ? c.target.label : c.original_value}{c.normalized_value && c.normalized_value !== c.original_value && <span className="muted small"> → {c.normalized_value}</span>}{Object.keys(c.missingness || {}).length ? <span className="pill warn"> missing</span> : null}</td>
                <td className="mono small">{JSON.stringify(c.provenance[0]?.locator)}</td><td>{c.confidence}</td></tr>)}</tbody></table>
          </div>
        ) : <div className="card muted">Select an evidence row to see its manifest, scan result, jobs and extracted claims.</div>}
      </div>
    </div>
  )
}
