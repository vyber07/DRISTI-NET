import { Link } from 'react-router-dom'
import { Icon } from './common'

const SECTIONS: { to: string; icon: string; title: string; blurb: string }[] = [
  { to: 'evidence', icon: 'evidence', title: 'Evidence', blurb: 'Upload records and see how each one moved through validation, scanning and extraction.' },
  { to: 'review', icon: 'review', title: 'Review', blurb: 'Decide on possible identity matches the system found — accept, reject, defer or reverse.' },
  { to: 'graph', icon: 'graph', title: 'Graph', blurb: 'Explore the relationship network approved evidence has built up so far.' },
  { to: 'map', icon: 'map', title: 'Map', blurb: 'See the locations mentioned in this case laid out spatially.' },
  { to: 'timeline', icon: 'timeline', title: 'Timeline', blurb: 'Browse events in time order, current and historical.' },
  { to: 'analysis', icon: 'analysis', title: 'Analysis', blurb: 'Bridge candidates, communities, and pattern rules — all explainable, never a verdict.' },
  { to: 'audit', icon: 'audit', title: 'Audit', blurb: 'Every access, decision and reveal on this case, in order.' },
  { to: 'report', icon: 'report', title: 'Report', blurb: 'Export a human-reviewed summary of this case, masked and hash-stamped.' },
]

export default function CaseOverview({ c, caseId }: { c: any; caseId: string }) {
  return (
    <div>
      <div className="card overview-hero">
        <h2 style={{ margin: '0 0 4px' }}>Welcome to {c.case_id}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {c.pending_reviews
            ? <>There {c.pending_reviews === 1 ? 'is' : 'are'} <Link to={`/cases/${caseId}/review`}><b>{c.pending_reviews} identity match{c.pending_reviews === 1 ? '' : 'es'}</b></Link> waiting for a decision.</>
            : 'No decisions are waiting on you right now — everything reviewable has been reviewed.'}
        </p>
        <div className="row" style={{ marginTop: 14, gap: 24 }}>
          <div className="overview-stat">
            <div className="overview-stat-num">{c.evidence_count}</div>
            <div className="small muted">evidence item{c.evidence_count === 1 ? '' : 's'}</div>
          </div>
          <div className="overview-stat">
            <div className="overview-stat-num" style={{ color: c.pending_reviews ? 'var(--warn)' : 'var(--ok)' }}>{c.pending_reviews}</div>
            <div className="small muted">pending review{c.pending_reviews === 1 ? '' : 's'}</div>
          </div>
        </div>
      </div>

      <h3 style={{ margin: '18px 0 10px', fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Where do you want to go?
      </h3>
      <div className="overview-grid">
        {SECTIONS.map(s => (
          <Link key={s.to} to={`/cases/${caseId}/${s.to}`} className="overview-card">
            <span className="overview-card-icon"><Icon name={s.icon} size={22} /></span>
            <span className="overview-card-title">{s.title}</span>
            <span className="overview-card-blurb">{s.blurb}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
