import { useEffect, useState } from 'react'
import { get } from '../api/client'
import { ErrorBox, StatusPill } from './common'

export default function AuditPanel({ caseId }: { caseId: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [err, setErr] = useState<any>(null)
  const [f, setF] = useState('')
  useEffect(() => { get(`/cases/${caseId}/audit`).then(setRows).catch(setErr) }, [caseId])
  const shown = rows.filter(r => !f || r.action === f)
  const actions = [...new Set(rows.map(r => r.action))].sort()
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>Audit trail — {caseId}</h3><label className="visually-hidden" htmlFor="audit-action-filter">filter by action</label><select id="audit-action-filter" value={f} onChange={e => setF(e.target.value)}><option value="">all actions</option>{actions.map(a => <option key={a}>{a}</option>)}</select></div>
      <ErrorBox e={err} />
      <table><thead><tr><th>time</th><th>actor</th><th>action</th><th>target</th><th>outcome</th><th>detail</th><th>trace</th></tr></thead>
        <tbody>{shown.map(r => <tr key={r.audit_id}><td className="small mono">{r.created_at.replace('T', ' ').slice(0, 19)}</td><td className="mono small">{r.actor_id || '—'}</td><td>{r.action}</td><td className="small mono">{r.target_kind} {r.target_id}</td><td><StatusPill s={r.outcome} /></td><td className="small mono" style={{ maxWidth: 380, wordBreak: 'break-all' }}>{JSON.stringify(r.detail).slice(0, 220)}</td><td className="small mono">{r.trace_id}</td></tr>)}</tbody></table>
    </div>
  )
}
