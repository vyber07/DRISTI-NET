import { useEffect, useMemo, useRef, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import Graph from 'graphology'
import Sigma from 'sigma'
import { get } from '../api/client'
import { ErrorBox } from './common'
import { EdgeDrawer, EntityCard } from './EvidenceDrawer'

// Kept in sync with the --person/--phone/etc. custom properties in styles.css (Sigma renders to
// canvas, so these can't just reference the CSS variables directly).
const COLORS: Record<string, string> = { PERSON: '#4f46e5', PHONE: '#9333ea', ACCOUNT: '#0d9488', ORGANIZATION: '#ea580c', VEHICLE: '#64748b', LOCATION: '#16a34a', CASE: '#1e293b', EVENT: '#d97706', DEVICE: '#475569' }

type N = { entity_id: string; kind: string; label: string; degree: number; flags: any; merged_from: string[]; masked?: boolean; x?: number; y?: number; fx?: number | null; fy?: number | null }
type E = { source: any; target: any; rel_type: string; count: number; relevance: string; state?: string; candidate_id?: string; [k: string]: any }
type Sel = { kind: 'node' | 'edge'; item: any } | null

export default function GraphView({ caseId }: { caseId: string }) {
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState<any>(null)
  const [center, setCenter] = useState<string>('')
  const [hops, setHops] = useState(1)
  const [maxNodes, setMaxNodes] = useState(80)
  const [offset, setOffset] = useState(0)
  const [tFrom, setTFrom] = useState('')
  const [tTo, setTTo] = useState('')
  const [cands, setCands] = useState(true)
  const [showHist, setShowHist] = useState(true)
  const [sel, setSel] = useState<Sel>(null)
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const selRef = useRef<Sel>(null)
  const W = 900, H = 560

  async function load() {
    setErr(null)
    const q = new URLSearchParams({ hops: String(hops), max_nodes: String(maxNodes), offset: String(offset), include_candidates: String(cands) })
    if (center) q.set('center', center); if (tFrom) q.set('t_from', tFrom); if (tTo) q.set('t_to', tTo)
    try { setData(await get(`/cases/${caseId}/graph?${q}`)) } catch (ex) { setErr(ex) }
  }
  useEffect(() => { load() }, [caseId, center, hops, maxNodes, offset, tFrom, tTo, cands])
  // Pagination only applies to the uncentered node listing (a centered hop-bounded traversal has no
  // stable total order to page through -- see the backend's bounded_subgraph docstring). Changing any
  // other filter picks a new view, so it resets back to that view's first page.
  function setFilter<T>(setter: (v: T) => void) {
    return (v: T) => { setOffset(0); setter(v) }
  }

  // layout: same shared d3-force positioning as the previous SVG view (node counts here are small/bounded
  // by the server, so a one-shot force layout is cheap; positions are then handed to Sigma as fixed x/y).
  const { nodes, links } = useMemo(() => {
    if (!data) return { nodes: [] as N[], links: [] as E[] }
    const nodes: N[] = data.nodes.map((n: any) => ({ ...n }))
    const ids = new Set(nodes.map(n => n.entity_id))
    const edges: E[] = [...data.edges, ...(cands ? data.candidate_edges : [])].filter((e: E) => ids.has(e.source) && ids.has(e.target) && (showHist || e.relevance !== 'HISTORICAL'))
    return { nodes, links: edges.map(e => ({ ...e })) }
  }, [data, cands, showHist])

  useEffect(() => {
    if (!nodes.length) { setPos({}); return }
    const linked = new Set<string>()
    links.forEach(l => { linked.add(typeof l.source === 'string' ? l.source : l.source.entity_id); linked.add(typeof l.target === 'string' ? l.target : l.target.entity_id) })
    const isolates = nodes.filter(n => !linked.has(n.entity_id))
    const connected = nodes.filter(n => linked.has(n.entity_id))
    const sim = forceSimulation(connected as any)
      .force('link', forceLink(links as any).id((d: any) => d.entity_id).distance(85).strength(0.35))
      .force('charge', forceManyBody().strength(-260))
      .force('center', forceCenter(W / 2, H / 2))
      .force('collide', forceCollide(26))
      .stop()
    for (let i = 0; i < 300; i++) sim.tick()
    const left = isolates.length ? 110 : 0
    const xs = connected.map(n => n.x || 0), ys = connected.map(n => n.y || 0)
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    const m = 40, sx = (W - left - 2 * m) / Math.max(1, maxX - minX), sy = (H - 2 * m) / Math.max(1, maxY - minY), sc = Math.min(sx, sy, 1.5)
    const ox = left + (W - left - (maxX - minX) * sc) / 2, oy = (H - (maxY - minY) * sc) / 2
    const p: Record<string, { x: number; y: number }> = {}
    connected.forEach(n => { p[n.entity_id] = { x: ox + ((n.x || 0) - minX) * sc, y: oy + ((n.y || 0) - minY) * sc } })
    isolates.forEach((n, i) => { p[n.entity_id] = { x: 50, y: 40 + i * 40 } })
    setPos(p)
  }, [nodes, links])

  // keep the reducers' view of `sel` current without tearing down/rebuilding the WebGL scene on every click
  useEffect(() => { selRef.current = sel; sigmaRef.current?.refresh() }, [sel])

  // build the Graphology graph + (re)create the Sigma renderer whenever the bounded result or layout changes
  useEffect(() => {
    sigmaRef.current?.kill()
    sigmaRef.current = null
    if (!containerRef.current || !nodes.length || !Object.keys(pos).length) return

    const graph = new Graph({ multi: true, type: 'directed' })
    nodes.forEach(n => {
      const p = pos[n.entity_id]
      if (!p) return
      graph.addNode(n.entity_id, {
        x: p.x, y: p.y,
        size: 4 + Math.min(n.degree, 12) * 0.6,
        color: n.flags?.contradictory ? '#b91c1c' : (COLORS[n.kind] || '#888'),
        label: n.label.length > 22 ? n.label.slice(0, 21) + '…' : n.label,
        raw: n,
      })
    })
    links.forEach((e, i) => {
      const s = typeof e.source === 'string' ? e.source : e.source.entity_id
      const t = typeof e.target === 'string' ? e.target : e.target.entity_id
      if (!graph.hasNode(s) || !graph.hasNode(t)) return
      const cand = e.rel_type === 'POSSIBLE_SAME_AS', hist = e.relevance === 'HISTORICAL'
      graph.addEdgeWithKey(`edge-${i}`, s, t, {
        size: cand ? 1.5 : Math.min(1 + Math.log2(e.count || 1), 5),
        color: cand ? '#f97316' : hist ? '#cbd2de' : '#64748b',
        type: 'arrow',
        label: `${e.rel_type} ×${e.count}`,
        raw: { ...e, source: s, target: t },
        edgeKind: cand ? 'candidate' : e.rel_type,
      })
    })

    const sigma = new Sigma(graph, containerRef.current, {
      enableEdgeEvents: true,
      renderEdgeLabels: false,
      labelSize: 11,
      labelColor: { color: '#151827' },
      minCameraRatio: 0.1,
      maxCameraRatio: 3,
      nodeReducer: (node, data) => {
        const s = selRef.current
        if (s?.kind === 'node' && s.item.entity_id === node) return { ...data, highlighted: true, zIndex: 1 }
        return data
      },
      edgeReducer: (_edge, data) => {
        const s = selRef.current
        const raw = data.raw
        if (s?.kind === 'edge' && s.item.source === raw.source && s.item.target === raw.target && s.item.rel_type === raw.rel_type) {
          return { ...data, color: '#5b5bd6', size: Math.max(data.size, 3), zIndex: 1 }
        }
        return data
      },
    })
    sigmaRef.current = sigma
    // Exposed only for Playwright (tests/e2e): a canvas-rendered graph has no per-node DOM elements to
    // select, so the E2E test computes real screen coordinates from this and issues a genuine mouse click
    // (see tests/e2e/test_ui_demo.py::_click_graph_edge/_click_first_node). Not sensitive: identical data
    // to what the /cases/{id}/graph API response already contains.
    ;(window as any).__sigma = sigma
    ;(window as any).__graph = graph

    sigma.on('clickNode', ({ node }) => setSel({ kind: 'node', item: graph.getNodeAttribute(node, 'raw') }))
    sigma.on('doubleClickNode', (event) => { event.preventSigmaDefault(); setCenter(event.node) })
    sigma.on('clickEdge', ({ edge }) => {
      const data = graph.getEdgeAttributes(edge)
      if (data.edgeKind === 'candidate') return // candidates are not clickable, same as the previous SVG view
      setSel({ kind: 'edge', item: data.raw })
    })
    sigma.on('clickStage', () => setSel(null))

    return () => {
      sigma.kill()
      if (sigmaRef.current === sigma) sigmaRef.current = null
      if ((window as any).__sigma === sigma) { (window as any).__sigma = undefined; (window as any).__graph = undefined }
    }
  }, [nodes, links, pos])

  const kinds = Object.keys(COLORS).filter(k => nodes.some(n => n.kind === k))
  const zoomIn = () => sigmaRef.current?.getCamera().animatedZoom({ duration: 200 })
  const zoomOut = () => sigmaRef.current?.getCamera().animatedUnzoom({ duration: 200 })
  const resetView = () => sigmaRef.current?.getCamera().animatedReset({ duration: 200 })

  return (
    <div className="grid-graph">
      <div>
        <div className="card">
          <div className="row">
            <label className="small">centre <input value={center} onChange={e => setFilter(setCenter)(e.target.value)} placeholder="entity_id (or click a node → expand)" style={{ width: 230 }} /></label>
            <label className="small">hops <select value={hops} onChange={e => setFilter(setHops)(+e.target.value)}><option value={1}>1</option><option value={2}>2 (max)</option></select></label>
            <label className="small">max nodes <input type="number" value={maxNodes} min={5} max={150} onChange={e => setFilter(setMaxNodes)(+e.target.value)} style={{ width: 70 }} /></label>
            <label className="small">from <input type="date" value={tFrom} onChange={e => setFilter(setTFrom)(e.target.value)} /></label>
            <label className="small">to <input type="date" value={tTo} onChange={e => setFilter(setTTo)(e.target.value)} /></label>
            <label className="small"><input type="checkbox" checked={cands} onChange={e => setFilter(setCands)(e.target.checked)} /> candidates</label>
            <label className="small"><input type="checkbox" checked={showHist} onChange={e => setShowHist(e.target.checked)} /> historical</label>
            {center && <button className="link" onClick={() => setFilter(setCenter)('')}>clear centre</button>}
            {!center && offset > 0 && <button className="link" onClick={() => setOffset(0)}>first page</button>}
            {!center && data?.next_offset != null && <button className="link" onClick={() => setOffset(data.next_offset)}>load next page →</button>}
          </div>
          <ErrorBox e={err} />
          {data && (
            <div className="row small muted" style={{ marginTop: 6 }}>
              <span>{data.nodes.length}/{data.total_nodes} nodes{!center && (offset > 0 || data.next_offset != null) ? ` · showing offset ${data.offset}–${data.offset + data.nodes.length}` : ''} · {data.edges.length} edges · reference time {data.reference_time}</span>
              {data.truncated && <span className="pill warn">bounded result — server cap {data.bounds.max_nodes} nodes / {data.bounds.hops} hops (supernode fan-out capped at {data.bounds.supernode_degree})</span>}
              <span className="pill grey">masked</span><span className="mono">snapshot {data.snapshot_hash.slice(0, 12)}</span>
            </div>
          )}
          <div className="graph-wrap">
            <div ref={containerRef} data-testid="sigma-container" style={{ width: '100%', height: H }} />
            <div className="graph-zoom-controls">
              <button type="button" onClick={zoomIn} title="zoom in">+</button>
              <button type="button" onClick={zoomOut} title="zoom out">−</button>
              <button type="button" onClick={resetView} title="reset view">↺</button>
            </div>
          </div>
          <div className="legend">
            {/* The swatch dot carries the actual graph color; the label stays in default ink so the
                text itself is never illegible-by-design the way "light grey text on white" was
                (measured 1.84:1 against WCAG AA's 4.5:1 minimum before this fix). */}
            {kinds.map(k => <span key={k}><i className="swatch" style={{ color: COLORS[k] }} aria-hidden="true" />{k}</span>)}
            <span><i className="swatch" style={{ color: '#64748b' }} aria-hidden="true" />solid grey = current</span>
            <span><i className="swatch" style={{ color: '#cbd2de' }} aria-hidden="true" />light grey = historical</span>
            <span><i className="swatch" style={{ color: '#f97316' }} aria-hidden="true" />orange = match candidate (not merged)</span>
            <span className="muted">click node/edge · double-click node to expand from it · scroll to zoom · drag to pan</span>
          </div>
        </div>
      </div>
      <div className="card">
        {!sel && <div className="muted">Select a node to see its entity card (cross-case appearances, masked identifiers, reveal with reason) or an edge to open the evidence drawer.</div>}
        {sel?.kind === 'edge' && <EdgeDrawer caseId={caseId} edge={sel.item} />}
        {sel?.kind === 'node' && <EntityCard caseId={caseId} node={sel.item} />}
      </div>
    </div>
  )
}
