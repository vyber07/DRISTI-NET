import { useEffect, useMemo, useState } from 'react'
import { get } from '../api/client'
import { ErrorBox, StatusPill, clickableRow } from './common'
import { ClaimCard } from './EvidenceDrawer'

export default function TimelinePanel({ caseId }: { caseId: string }) {
  const [t, setT] = useState<any>(null)
  const [err, setErr] = useState<any>(null)
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [rel, setRel] = useState('')
  const [open, setOpen] = useState<any>(null)
  useEffect(() => {
    const q = new URLSearchParams(); if (from) q.set('t_from', from); if (to) q.set('t_to', to)
    get(`/cases/${caseId}/timeline?${q}`).then(setT).catch(setErr)
  }, [caseId, from, to])
  const events = useMemo(() => (t?.events || []).filter((e: any) => !rel || e.rel_type === rel), [t, rel])
  const buckets = useMemo(() => {
    const m = new Map<string, { n: number; hist: boolean }>()
    events.forEach((e: any) => { const k = e.time.slice(0, 7); const b = m.get(k) || { n: 0, hist: e.relevance === 'HISTORICAL' }; b.n++; m.set(k, b) })
    return [...m.entries()].sort()
  }, [events])
  const max = Math.max(1, ...buckets.map(([, b]) => b.n))
  const rels = [...new Set((t?.events || []).map((e: any) => e.rel_type))] as string[]
  return (
    <div className="grid2">
      <div className="card">
        <h3>Timeline</h3>
        <div className="row">
          <label className="small">from <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="small">to <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <label className="visually-hidden" htmlFor="timeline-rel-filter">filter by relationship type</label>
          <select id="timeline-rel-filter" value={rel} onChange={e => setRel(e.target.value)}><option value="">all relationship types</option>{rels.map(r => <option key={r}>{r}</option>)}</select>
          <button className="link" onClick={() => { setFrom('2019-01-01'); setTo('2019-12-31') }}>show 2019 (historical)</button>
          <button className="link" onClick={() => { setFrom('2025-07-02'); setTo('2025-07-03') }}>burst window</button>
          <button className="link" onClick={() => { setFrom(''); setTo(''); setRel('') }}>reset</button>
        </div>
        <ErrorBox e={err} />
        {t && <p className="small muted">{events.length} events · reference time {t.reference_time} · events older than 365 days are shown as HISTORICAL (kept, not deleted)</p>}
        <div className="mini-hist" title="events per month">{buckets.map(([k, b]) => <div key={k} className={b.hist ? 'hist' : ''} style={{ height: `${(b.n / max) * 100}%` }} title={`${k}: ${b.n}`} />)}</div>
        <div style={{ maxHeight: 520, overflow: 'auto' }}>
          {events.map((e: any) => (
            <div key={e.claim_id} className={`timeline-item clickable ${e.relevance === 'HISTORICAL' ? 'hist' : ''}`}
                 {...clickableRow(() => get(`/claims/${e.claim_id}`).then(setOpen), `${e.time}: ${e.source.label} ${e.rel_type} ${e.target?.label || ''}`)}>
              <span className="mono">{e.time}</span><span><StatusPill s={e.relevance} /></span>
              <span>{e.source.label} <span className="muted">—{e.rel_type}→</span> {e.target?.label}{Object.keys(e.missing || {}).length ? <span className="pill warn"> missing</span> : null}</span>
            </div>
          ))}
          {!events.length && <div className="muted">No events in this window.</div>}
        </div>
      </div>
      <div className="card">{open ? <><h3>Event evidence</h3><ClaimCard c={open} /></> : <div className="muted">Click an event to see its claim and source.</div>}</div>
    </div>
  )
}
