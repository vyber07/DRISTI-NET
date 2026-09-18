import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { get } from '../api/client'
import { Icon, Skeleton } from '../components/common'
import CaseOverview from '../components/CaseOverview'
import EvidencePanel from '../components/EvidencePanel'
import ReviewQueue from '../components/ReviewQueue'
import GraphView from '../components/GraphView'
import MapView from '../components/MapView'
import TimelinePanel from '../components/TimelinePanel'
import AnalysisPanel from '../components/AnalysisPanel'
import AuditPanel from '../components/AuditPanel'
import ReportPanel from '../components/ReportPanel'

// Grouped, not flat, and every item carries a plain-language one-liner -- the point is that a new user
// can tell what each section is *for* without clicking into it first, not just that it exists.
const NAV_GROUPS: { label: string; items: { to: string; icon: string; title: string; hint: string }[] }[] = [
  { label: '', items: [{ to: 'overview', icon: 'overview', title: 'Overview', hint: 'Start here' }] },
  { label: 'Evidence', items: [
    { to: 'evidence', icon: 'evidence', title: 'Evidence', hint: 'Upload & status' },
    { to: 'review', icon: 'review', title: 'Review', hint: 'Identity matches' },
  ] },
  { label: 'Explore', items: [
    { to: 'graph', icon: 'graph', title: 'Graph', hint: 'Relationships' },
    { to: 'map', icon: 'map', title: 'Map', hint: 'Locations' },
    { to: 'timeline', icon: 'timeline', title: 'Timeline', hint: 'Events over time' },
    { to: 'analysis', icon: 'analysis', title: 'Analysis', hint: 'Patterns & bridges' },
  ] },
  { label: 'Governance', items: [
    { to: 'audit', icon: 'audit', title: 'Audit', hint: 'Access log' },
    { to: 'report', icon: 'report', title: 'Report', hint: 'Export' },
  ] },
]

export default function CaseWorkspace() {
  const { caseId = '' } = useParams()
  const location = useLocation()
  const [c, setC] = useState<any>(null)
  const [err, setErr] = useState<any>(null)
  const reload = () => get(`/cases/${caseId}`).then(setC).catch(setErr)
  useEffect(() => { reload() }, [caseId])
  if (err) return <div className="card"><div className="error">HTTP {err.status}: {err.message}<br /><span className="small">trace {err.trace} — this denial was recorded in the audit log.</span></div></div>
  if (!c) return <div className="card"><Skeleton lines={2} /></div>

  return (
    <div className="case-shell">
      <aside className="case-sidebar">
        <div className="case-sidebar-header">
          <div className="case-sidebar-title">{c.case_id}</div>
          <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
          <div className="row" style={{ marginTop: 8, gap: 6 }}>
            <span className="pill info">{c.classification}</span>
            <span className="pill grey">{c.sensitivity}</span>
          </div>
        </div>
        <nav aria-label="Case sections">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="case-nav-group">
              {group.label && <div className="case-nav-group-label">{group.label}</div>}
              {group.items.map(item => (
                <NavLink key={item.to} to={`/cases/${caseId}/${item.to}`} className={({ isActive }) => `case-nav-item${isActive ? ' active' : ''}`}>
                  <Icon name={item.icon} />
                  <span className="case-nav-text">
                    <span className="case-nav-title">
                      {item.title}
                      {item.to === 'review' && c.pending_reviews ? <span className="pill warn case-nav-badge">{c.pending_reviews}</span> : null}
                    </span>
                    <span className="case-nav-hint">{item.hint}</span>
                  </span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="case-content" key={location.pathname}>
        <Routes>
          <Route path="overview" element={<CaseOverview c={c} caseId={caseId} />} />
          <Route path="evidence" element={<EvidencePanel caseId={caseId} onChange={reload} />} />
          <Route path="review" element={<ReviewQueue caseId={caseId} onChange={reload} />} />
          <Route path="graph" element={<GraphView caseId={caseId} />} />
          <Route path="map" element={<MapView caseId={caseId} />} />
          <Route path="timeline" element={<TimelinePanel caseId={caseId} />} />
          <Route path="analysis" element={<AnalysisPanel caseId={caseId} />} />
          <Route path="audit" element={<AuditPanel caseId={caseId} />} />
          <Route path="report" element={<ReportPanel caseId={caseId} />} />
          <Route path="*" element={<CaseOverview c={c} caseId={caseId} />} />
        </Routes>
      </div>
    </div>
  )
}
