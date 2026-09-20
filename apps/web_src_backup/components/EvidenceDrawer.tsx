import { useEffect, useState } from 'react'
import { get, post, currentUser } from '../api/client'
import { ErrorBox, StatusPill } from './common'

export function SourceContext({ claim }: { claim: any }) {
  const [ctx, setCtx] = useState<any>(null)
  const [err, setErr] = useState<any>(null)
  useEffect(() => {
    const loc = claim.provenance[0]?.locator || {}
    const q = new URLSearchParams()
    if (loc.row) q.set('row', loc.row); if (loc.page) q.set('page', loc.page); if (loc.line) q.set('line', loc.line); if (loc.json_path) q.set('json_path', loc.json_path)
    get(`/evidence/${claim.evidence.evidence_id}/context?${q}`).then(setCtx).catch(setErr)
  }, [claim.claim_id])
  if (err) return <ErrorBox e={err} />
  if (!ctx) return <div className="muted small">loading source…</div>
  return (
    <div style={{ border: '1px solid var(--line-soft)', borderRadius: 8, marginTop: 6, overflow: 'hidden' }}>
      <div className="small" style={{ padding: '6px 8px', background: 'var(--panel-2)' }}>{ctx.filename} · {JSON.stringify(ctx.locator)} · {ctx.hash_match ? <span className="pill ok">hash verified</span> : <span className="pill bad">HASH MISMATCH</span>} · masked</div>
      {ctx.lines.map((l: any) => <div key={l.n} className={`srcline ${l.hit ? 'hit' : ''}`}>{String(l.n).padStart(4, ' ')}  {l.text}</div>)}
    </div>
  )
}

export function ClaimCard({ c }: { c: any }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
      <div className="row small">
        <b>{c.source.label}</b> —{c.rel_type || c.attribute}→ <b>{c.target ? c.target.label : c.original_value}</b>
        <StatusPill s={c.state} />{c.observed_time && <span className="muted">{c.observed_time}</span>}
      </div>
      <dl className="kv small">
        <dt>claim</dt><dd className="mono">{c.claim_id}</dd>
        <dt>evidence</dt><dd>{c.evidence.filename} <span className="mono">{c.evidence.evidence_id}</span> v{c.evidence.version} · sha {c.evidence.sha256.slice(0, 12)}…</dd>
        <dt>locator</dt><dd className="mono">{JSON.stringify(c.provenance[0]?.locator)}</dd>
        <dt>values</dt><dd>original <code>{c.original_value ?? '—'}</code> · normalized <code>{c.normalized_value ?? '—'}</code></dd>
        <dt>method</dt><dd>{c.method} v{c.method_version} · confidence {c.confidence}{Object.keys(c.missingness || {}).length ? <> · <span className="pill warn">missing: {Object.keys(c.missingness).join(', ')}</span></> : null}</dd>
        {c.flags?.contradicts?.length ? <><dt>contradicts</dt><dd className="mono">{c.flags.contradicts.join(', ')}</dd></> : null}
        {c.reviews?.length ? <><dt>reviews</dt><dd>{c.reviews.map((r: any) => `${r.decision} (${r.reviewer_id}): ${r.reason}`).join(' · ')}</dd></> : null}
      </dl>
      <button className="link small" onClick={() => setOpen(!open)}>{open ? 'hide source' : 'open source context'}</button>
      {open && <SourceContext claim={c} />}
    </div>
  )
}

export function EdgeDrawer({ caseId, edge }: { caseId: string; edge: any }) {
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState<any>(null)
  useEffect(() => { setD(null); get(`/cases/${caseId}/edge?source=${edge.source}&target=${edge.target}&rel_type=${edge.rel_type}`).then(setD).catch(setErr) }, [edge])
  return (
    <div className="drawer">
      <h3>Candidate relationship <code>{edge.rel_type}</code></h3>
      <dl className="kv small">
        <dt>occurrences</dt><dd>{edge.count} · weight {edge.weight}</dd>
        <dt>window</dt><dd>{edge.first_seen || '—'} → {edge.last_seen || '—'}</dd>
        <dt>relevance</dt><dd><StatusPill s={edge.relevance} /> {edge.decay_score != null && <span className="muted">decay {edge.decay_score} · age {edge.age_days}d — history is kept; decay only changes relevance</span>}</dd>
        <dt>confidence</dt><dd>min {edge.min_confidence} · {edge.missing_count ? <span className="pill warn">{edge.missing_count} with missing fields</span> : 'no missing fields'} · methods {edge.methods?.join(', ')}</dd>
        <dt>evidence</dt><dd className="mono">{edge.evidence_ids?.join(', ')}</dd>
        <dt>governance</dt><dd>{edge.jurisdiction} · access {edge.access_class} · authority {edge.authority_reference}{edge.governance_mixed && <span className="pill warn"> mixed across constituent claims</span>}</dd>
        <dt>limitations</dt><dd className="muted">Source-linked candidate, not a conclusion. A shared identifier does not establish person identity.</dd>
      </dl>
      <ErrorBox e={err} />
      {d ? d.claims.map((c: any) => <ClaimCard key={c.claim_id} c={c} />) : <div className="muted small">loading claims…</div>}
    </div>
  )
}

export function EntityCard({ caseId, node }: { caseId: string; node: any }) {
  const [e, setE] = useState<any>(null)
  const [err, setErr] = useState<any>(null)
  const [reason, setReason] = useState('')
  const [revealed, setRevealed] = useState<any>(null)
  const user = currentUser()
  useEffect(() => { setE(null); setRevealed(null); get(`/entities/${node.entity_id}?case_id=${caseId}`).then(setE).catch(setErr) }, [node.entity_id])
  async function reveal() { setErr(null); try { setRevealed(await post(`/entities/${node.entity_id}/reveal`, { case_id: caseId, reason })) } catch (ex) { setErr(ex) } }
  return (
    <div className="drawer">
      <h3><span className="pill grey">{node.kind}</span> {revealed ? revealed.value : node.label}</h3>
      {node.merged_from?.length ? <div className="notice small">Merged by human review with: {node.merged_from.join(', ')} (reversible)</div> : null}
      {node.flags?.contradictory && <div className="error small"><b>Contradictory attribute</b>: {node.flags.contradictions.map((c: any) => `${c.attribute}=“${c.value}” (${c.evidence_id})`).join(' vs ')}</div>}
      {node.flags?.supernode && <div className="notice small"><b>High-degree node</b> — {node.flags.supernode_note}</div>}
      <ErrorBox e={err} />
      {e && (
        <dl className="kv small">
          <dt>entity_id</dt><dd className="mono">{e.entity_id}</dd>
          <dt>access class</dt><dd>{e.access_class}{e.masked && ' · masked by default'}</dd>
          {Object.entries(e.attributes || {}).map(([k, v]) => <span key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{String(v)}</dd></span>)}
          <dt>cross-case</dt><dd>{e.cross_case.visible_cases.length ? `also in ${e.cross_case.visible_cases.join(', ')}` : 'no other visible case'}{e.cross_case.restricted_case_count ? <span className="pill warn"> +{e.cross_case.restricted_case_count} case(s) you cannot access</span> : null}</dd>
          <dt>degree</dt><dd>{node.degree}</dd>
        </dl>
      )}
      {node.masked && !revealed && (
        <div style={{ marginTop: 8 }}>
          <label className="visually-hidden" htmlFor="reveal-reason">reason for reveal (audited)</label>
          <input id="reveal-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="reason for reveal (audited)" style={{ width: '70%' }} />
          <button disabled={reason.length < 5 || !['INVESTIGATOR', 'REVIEWER', 'ADMIN'].includes(user?.role || '')} onClick={reveal} style={{ marginLeft: 6 }}>Reveal</button>
        </div>
      )}
      {revealed && <div className="notice small">Revealed value recorded in audit <code>{revealed.audit_id}</code> with reason “{revealed.reason}”.</div>}
      {e && <><h4>Claims involving this entity ({e.claims.length})</h4>{e.claims.slice(0, 25).map((c: any) => <ClaimCard key={c.claim_id} c={c} />)}</>}
    </div>
  )
}
