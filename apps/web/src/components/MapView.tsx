import { useEffect, useMemo, useState } from 'react'
import { get } from '../api/client'
import { ErrorBox } from './common'

/** A self-contained, locally-rendered scatter plot of this case's LOCATION entities -- deliberately not
 * a tile-based map (Leaflet/Mapbox/etc.), which would mean sending case coordinates to a third-party
 * tile server on every pan/zoom. That's exactly the kind of external/live connector docs/context.md's
 * product boundary rules out (§2: no live connectors) even though it's "just" map tiles, not case data
 * itself -- the coordinates in the request URL still leave this system. A simple linear lat/lon
 * projection over the case's own bounding box needs no external network call at all. */
export default function MapView({ caseId }: { caseId: string }) {
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState<any>(null)
  const [sel, setSel] = useState<any>(null)
  useEffect(() => { setSel(null); get(`/cases/${caseId}/locations`).then(setData).catch(setErr) }, [caseId])

  const W = 720, H = 440, PAD = 40
  const { points, without } = useMemo(() => {
    const all = data?.locations || []
    const withCoords = all.filter((l: any) => l.has_coords)
    const without = all.filter((l: any) => !l.has_coords)
    if (!withCoords.length) return { points: [], without }
    const lats = withCoords.map((l: any) => l.lat), lons = withCoords.map((l: any) => l.lon)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const spanLat = Math.max(maxLat - minLat, 0.0001), spanLon = Math.max(maxLon - minLon, 0.0001)
    const points = withCoords.map((l: any) => ({
      ...l,
      x: PAD + ((l.lon - minLon) / spanLon) * (W - 2 * PAD),
      y: H - PAD - ((l.lat - minLat) / spanLat) * (H - 2 * PAD), // lat increases upward
    }))
    return { points, without }
  }, [data])

  return (
    <div className="grid2">
      <div className="card">
        <h3>Map</h3>
        <p className="small muted">
          Locally-rendered relative positions of this case's location entities (cell towers, named sites)
          from approved evidence — a linear projection over this case's own coordinate range, not a
          real-world map tile service. Not to scale; for spatial pattern review only.
        </p>
        <ErrorBox e={err} />
        {data && !points.length && <div className="muted">No location entities with coordinates in this case yet.</div>}
        {!!points.length && (
          <svg
            width="100%" viewBox={`0 0 ${W} ${H}`} role="img"
            aria-label={`Map of ${points.length} locations for case ${caseId}`}
            style={{ background: '#f7f8fd', border: '1px solid #e1e4f0', borderRadius: 10 }}
          >
            {points.map((p: any) => (
              <g key={p.entity_id} transform={`translate(${p.x},${p.y})`}>
                <circle r={sel?.entity_id === p.entity_id ? 8 : 6} fill={sel?.entity_id === p.entity_id ? '#5b5bd6' : '#16a34a'} stroke="#fff" strokeWidth={1.5} />
                <text x={9} y={4} fontSize={11} fill="#151827">{p.label}</text>
              </g>
            ))}
          </svg>
        )}
        {/* A real, keyboard-and-screen-reader-accessible control per point, layered under the SVG visual
            above rather than relying on SVG-element keyboard support (inconsistent across browsers). */}
        {!!points.length && (
          <ul className="map-marker-list" style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {points.map((p: any) => (
              <li key={p.entity_id}>
                <button
                  type="button" className={`map-marker link small ${sel?.entity_id === p.entity_id ? 'active' : ''}`}
                  onClick={() => setSel(p)} aria-pressed={sel?.entity_id === p.entity_id}
                >
                  {p.label}{p.kind_detail ? ` (${p.kind_detail})` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!!without.length && (
          <p className="small muted" style={{ marginTop: 10 }}>
            {without.length} location entit{without.length === 1 ? 'y' : 'ies'} without recorded coordinates
            (not shown on the map): {without.map((l: any) => l.label).join(', ')}
          </p>
        )}
        {data?.truncated && <span className="pill warn">bounded result — {data.total} locations exist, showing {data.locations.length}</span>}
      </div>
      <div className="card">
        {sel ? (
          <>
            <h3>{sel.label}</h3>
            <dl className="kv small">
              <dt>entity_id</dt><dd className="mono">{sel.entity_id}</dd>
              <dt>kind</dt><dd>{sel.kind_detail || '—'}</dd>
              <dt>coordinates</dt><dd>{sel.lat.toFixed(4)}, {sel.lon.toFixed(4)}</dd>
            </dl>
            <p className="small muted">Open the Graph tab and search this entity_id for its full relationship and evidence context.</p>
          </>
        ) : <div className="muted">Select a location to see its details.</div>}
      </div>
    </div>
  )
}
