import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get, post, currentUser } from '../api/client'
import { Skeleton } from '../components/common'

export default function Cases() {
  const [cases, setCases] = useState<any[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({ case_id: 'CASE-0003', title: '', jurisdiction: currentUser()?.jurisdiction || '', purpose: 'Retrospective relationship review', authority_reference: '', classification: 'SYNTHETIC_DEMO' })
  const [showCreate, setShowCreate] = useState(false)
  const [denied, setDenied] = useState<string | null>(null)
  const user = currentUser()
  const load = () => get('/cases').then(setCases).catch(e => setErr(e.message))
  useEffect(() => { load() }, [])
  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(null)
    try { await post('/cases', form); setShowCreate(false); load() } catch (ex: any) { setErr(ex.message) }
  }
  async function tryDenied() {
    setDenied(null)
    try { await get('/cases/CASE-0001'); setDenied('Access granted (you are assigned to CASE-0001).') }
    catch (ex: any) { setDenied(`HTTP ${ex.status}: ${ex.message} · trace ${ex.trace}`) }
  }
  return (
    <>
      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Your cases</h2>
        <p className="muted small" style={{ marginTop: 0 }}>Open one to upload evidence, review matches, and explore its graph. You only see cases you're assigned to.</p>
        {err && <div className="error">{err}</div>}
        {cases === null ? (
          <div className="case-grid">{[0, 1, 2].map(i => <div key={i} className="case-card"><Skeleton lines={3} /></div>)}</div>
        ) : cases.length ? (
          <div className="case-grid">
            {cases.map(c => (
              <Link key={c.case_id} to={`/cases/${c.case_id}/overview`} className="case-card">
                <div className="case-card-id">{c.case_id}</div>
                <div className="case-card-title">{c.title}</div>
                <div className="case-card-meta">{c.jurisdiction} · {c.purpose}</div>
                <div className="row" style={{ gap: 6 }}>
                  <span className="pill info">{c.classification}</span>
                  <span className="pill grey">{c.evidence_count} evidence</span>
                  {c.pending_reviews ? <span className="pill warn">{c.pending_reviews} pending</span> : <span className="pill ok">up to date</span>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="muted">No cases are assigned to this user. Case existence is not disclosed to unassigned users.</div>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <button onClick={tryDenied}>Test: request CASE-0001 directly</button>
          {denied && <span className={denied.startsWith('HTTP') ? 'pill bad' : 'pill ok'}>{denied}</span>}
        </div>
      </div>
      {(user?.role === 'INVESTIGATOR' || user?.role === 'ADMIN') && (
        <div className="disclosure card" style={{ padding: 0 }}>
          <button type="button" className="disclosure-trigger" onClick={() => setShowCreate(v => !v)} aria-expanded={showCreate}>
            + New case <span className="muted small" style={{ fontWeight: 400 }}>{showCreate ? 'hide' : 'show form'}</span>
          </button>
          {showCreate && (
            <div className="disclosure-body">
              <form className="row" onSubmit={create}>
                <label className="visually-hidden" htmlFor="case-id">case id</label>
                <input id="case-id" value={form.case_id} onChange={e => setForm({ ...form, case_id: e.target.value })} placeholder="CASE-0003" style={{ width: 120 }} />
                <label className="visually-hidden" htmlFor="case-title">title</label>
                <input id="case-title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="title" required style={{ width: 260 }} />
                <label className="visually-hidden" htmlFor="case-jurisdiction">jurisdiction</label>
                <input id="case-jurisdiction" value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value })} placeholder="jurisdiction" />
                <label className="visually-hidden" htmlFor="case-purpose">purpose</label>
                <input id="case-purpose" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} placeholder="purpose" style={{ width: 260 }} />
                <label className="visually-hidden" htmlFor="case-authority">authority reference (FIR/warrant/court order)</label>
                <input id="case-authority" value={form.authority_reference} onChange={e => setForm({ ...form, authority_reference: e.target.value })} placeholder="authority reference (FIR/warrant no.)" required style={{ width: 220 }} />
                <label className="visually-hidden" htmlFor="case-classification">data classification for this case</label>
                <select id="case-classification" value={form.classification} onChange={e => setForm({ ...form, classification: e.target.value })} title="Data classification for this case">
                  <option value="SYNTHETIC_DEMO">SYNTHETIC_DEMO</option>
                  <option value="APPROVED_DEIDENTIFIED">APPROVED_DEIDENTIFIED</option>
                </select>
                <button className="primary" type="submit">Create case</button>
              </form>
              <p className="small muted" style={{ marginBottom: 0, marginTop: 10 }}>
                This prototype processes whatever records you upload (CSV/JSON/PDF/TXT) through the real ingestion pipeline.
                It must not be given real personal data without authorization — see <code>docs/context.md</code> §2.2.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
