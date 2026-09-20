import { useEffect, useState } from 'react'
import { get, post, currentUser } from '../api/client'
import { ErrorBox, StatusPill, clickableRow } from './common'

function Side({ p, title }: { p: any; title: string }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <h4 style={{ margin: '0 0 6px' }}>{title}: {p.label} <span className="muted small mono">{p.entity_id}</span></h4>
      <dl className="kv">
        <dt>names</dt><dd>{p.names?.join(', ')}{p.aliases?.length ? <span className="muted"> · aliases: {p.aliases.join(', ')}</span> : null}</dd>
        <dt>dob</dt><dd>{p.dob?.length ? p.dob.join(', ') : <span className="pill grey">missing</span>}</dd>
        <dt>address</dt><dd>{p.address?.length ? p.address.join('; ') : <span className="pill grey">missing</span>}</dd>
        <dt>phones</dt><dd>{p.phones?.length ? p.phones.join(', ') : <span className="pill grey">missing</span>}</dd>
        <dt>accounts</dt><dd>{p.accounts?.join(', ') || '—'}</dd>
        <dt>organisations</dt><dd>{p.orgs?.join(', ') || '—'}</dd>
        <dt>source</dt><dd className="small">{p.attributes?.source_document || p.attributes?.person_id || '—'} · evidence {p.evidence_ids?.length}</dd>
      </dl>
    </div>
  )
}

export default function ReviewQueue({ caseId, onChange }: { caseId: string; onChange: () => void }) {
  const [list, setList] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  const [sel, setSel] = useState<any>(null)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<any>(null)
  const user = currentUser()
  const canDecide = ['REVIEWER', 'INVESTIGATOR', 'ADMIN'].includes(user?.role || '')
  const load = () => get(`/cases/${caseId}/candidates${filter ? `?state=${filter}` : ''}`).then(setList).catch(setErr)
  useEffect(() => { load() }, [caseId, filter])
  async function open(id: string) { setErr(null); setReason(''); try { setSel(await get(`/candidates/${id}`)) } catch (ex) { setErr(ex) } }
  async function decide(decision: string) {
    setErr(null)
    try { setSel(await post(`/candidates/${sel.candidate_id}/decision`, { decision, reason })); setReason(''); await load(); onChange() } catch (ex) { setErr(ex) }
  }
  return (
    <div className="grid2">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Identity-match candidates</h3>
          <label className="visually-hidden" htmlFor="candidate-state-filter">filter by review state</label>
          <select id="candidate-state-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="">all states</option>{['REVIEW_REQUIRED', 'APPROVE', 'REJECT', 'DEFER', 'STALE'].map(s => <option key={s}>{s}</option>)}</select>
        </div>
        <p className="small muted">The matcher proposes; it never merges. A shared phone, address or vehicle is a signal, not proof of identity.</p>
        <ErrorBox e={err} />
        <table>
          <thead><tr><th>left</th><th>right</th><th>signals</th><th>conf.</th><th>state</th></tr></thead>
          <tbody>{list.map(m => (
            <tr key={m.candidate_id} className="clickable" {...clickableRow(() => open(m.candidate_id), `candidate ${m.left.label} / ${m.right.label}, confidence ${m.confidence}, state ${m.state}`)} style={sel?.candidate_id === m.candidate_id ? { background: '#eef0fd' } : {}}>
              <td>{m.left.label}</td><td>{m.right.label}</td>
              <td className="small">+{m.positive_signals.length} / −{m.counter_evidence.length + m.conflicts.length} / ?{m.missing.length}</td>
              <td><div className="bar" style={{ width: 60 }}><div style={{ width: `${m.confidence * 100}%` }} /></div><span className="small">{m.confidence}</span></td>
              <td><StatusPill s={m.state} /></td>
            </tr>))}
            {!list.length && <tr><td colSpan={5} className="muted">No candidates in this state.</td></tr>}
          </tbody>
        </table>
      </div>
      <div>
        {sel ? (
          <div className="card">
            <h3>Candidate <span className="mono small">{sel.candidate_id}</span> <StatusPill s={sel.state} /></h3>
            <p className="small muted">block key <code>{sel.block_key}</code> · matcher v{sel.matcher_version} · confidence {sel.confidence} (heuristic, never 0 or 1)</p>
            <div className="grid2"><Side p={sel.left} title="Record A" /><Side p={sel.right} title="Record B" /></div>
            <h4>Why these may be the same entity</h4>
            {sel.positive_signals.map((s: any, i: number) => <div key={i} className="signal pos"><b>{s.signal}</b> — {s.detail}{s.caveat && <div className="small muted">{s.caveat}</div>}</div>)}
            {!sel.positive_signals.length && <div className="muted small">none</div>}
            <h4>Counter-evidence &amp; conflicts</h4>
            {sel.counter_evidence.map((s: any, i: number) => <div key={i} className="signal neg"><b>{s.signal}</b> — {s.detail}</div>)}
            {sel.conflicts.map((c: any, i: number) => <div key={i} className="signal conf"><b>{c.attribute} conflict</b> — A: {c.left.join(', ')} · B: {c.right.join(', ')}</div>)}
            {!sel.counter_evidence.length && !sel.conflicts.length && <div className="muted small">none</div>}
            <h4>Missing data</h4>
            {sel.missing.map((m: any, i: number) => <div key={i} className="signal miss">{m.attribute} missing on {m.missing_on.join(' & ')}</div>)}
            {!sel.missing.length && <div className="muted small">none</div>}
            <h4>Decision history</h4>
            {sel.reviews.length ? <table><tbody>{sel.reviews.map((r: any) => <tr key={r.review_id}><td><StatusPill s={r.decision} /></td><td>{r.reason}</td><td className="small mono">{r.reviewer_id}</td><td className="small">{r.created_at}</td></tr>)}</tbody></table> : <div className="muted small">no decisions yet</div>}
            {canDecide ? (
              <>
                <h4>Your decision (reason is required and audited)</h4>
                <label className="visually-hidden" htmlFor="decision-reason">reason for the decision</label>
                <textarea id="decision-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for the decision…" />
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="primary" disabled={reason.length < 3} onClick={() => decide('APPROVE')}>Accept</button>
                  <button className="danger" disabled={reason.length < 3} onClick={() => decide('REJECT')}>Reject</button>
                  <button disabled={reason.length < 3} onClick={() => decide('DEFER')}>Defer</button>
                  <button disabled={reason.length < 3} onClick={() => decide('STALE')}>Mark stale</button>
                  <button disabled={reason.length < 3 || !sel.reviews.length} onClick={() => decide('REVERSE')}>Reverse last decision</button>
                </div>
              </>
            ) : <div className="notice">Your role ({user?.role}) can view but not decide.</div>}
          </div>
        ) : <div className="card muted">Select a candidate to see signals, counter-evidence, conflicts, missing data and decide.</div>}
      </div>
    </div>
  )
}
