import { useEffect, useState } from 'react'
import { get } from '../services/api/real_client'
import { ErrorBox } from './common'

export default function AnalysisPanel({ caseId }: { caseId: string }) {
  const [a, setA] = useState<any>(null)
  const [err, setErr] = useState<any>(null)
  useEffect(() => { get(`/cases/${caseId}/analysis`).then(setA).catch(setErr) }, [caseId])
  if (err) return <div className="card"><ErrorBox e={err} /></div>
  if (!a) return <div className="card muted">computing…</div>
  return (
    <>
      <div className="notice">{a.language_note}</div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Bridge candidates (betweenness)</h3>
          <table><thead><tr><th>entity</th><th>kind</th><th>betweenness</th><th>touches</th></tr></thead>
            <tbody>{a.bridge_candidates.map((b: any) => <tr key={b.entity_id}><td>{b.label}</td><td>{b.kind}</td><td>{b.betweenness}</td><td>{b.touches_communities.join(', ')}</td></tr>)}</tbody></table>
          <p className="small muted">{a.bridge_candidates[0]?.note}</p>
        </div>
        <div className="card">
          <h3>Rule candidates (transparent thresholds)</h3>
          {a.rules.map((r: any, i: number) => (
            <div key={i} className="signal conf"><b>{r.rule}</b> v{r.version} · {r.subject}{r.object ? ` → ${r.object}` : ''}<br /><span className="small">{r.explanation} · {r.window_start} → {r.window_end}{r.sources ? ` · from ${r.sources.join(', ')}` : ''} · priority: {r.priority}</span></div>
          ))}
          {!a.rules.length && <div className="muted">no rule hits</div>}
        </div>
        <div className="card">
          <h3>High-volume nodes (degree)</h3>
          <table><thead><tr><th>entity</th><th>kind</th><th>degree</th></tr></thead><tbody>{a.degree.map((d: any) => <tr key={d.entity_id}><td>{d.label}</td><td>{d.kind}</td><td>{d.degree}</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <h3>Communities (greedy modularity)</h3>
          {a.communities.map((c: any) => <div key={c.community_id} className="small" style={{ marginBottom: 6 }} title={c.stability_note}><b>{c.community_id}</b> ({c.size}){c.stability != null ? ` · stability ${c.stability}` : ''}: {c.members?.map((m: any) => m.label).join(', ')}{c.size > (c.members?.length || 0) ? ' …' : ''}</div>)}
        </div>
      </div>
    </>
  )
}
