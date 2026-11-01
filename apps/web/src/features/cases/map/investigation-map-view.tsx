import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MapPin, AlertTriangle, RefreshCw, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCaseLocations } from "@/services/api/casesApi";

interface Location {
  entity_id: string;
  label: string;
  lat: number | null;
  lon: number | null;
  has_coords: boolean;
  kind_detail?: string;
}

export function InvestigationMapView() {
  const { caseId = "" } = useParams();
  const [locations, setLocations] = useState<Location[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Location | null>(null);

  const load = () => {
    if (!caseId) return;
    setIsLoading(true);
    setError("");
    getCaseLocations(caseId)
      .then((r) => {
        const d = r.data;
        setLocations(d?.locations || []);
        setTotal(d?.total || 0);
        setTruncated(d?.truncated || false);
      })
      .catch((e) => setError(e.message || "Failed to load locations"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  const withCoords = locations.filter((l) => l.has_coords);
  const noCoords = locations.filter((l) => !l.has_coords);

  // Simple linear projection: compute bounding box and map lat/lon to SVG coords
  const minLat = withCoords.length ? Math.min(...withCoords.map((l) => l.lat!)) - 0.05 : 0;
  const maxLat = withCoords.length ? Math.max(...withCoords.map((l) => l.lat!)) + 0.05 : 1;
  const minLon = withCoords.length ? Math.min(...withCoords.map((l) => l.lon!)) - 0.05 : 0;
  const maxLon = withCoords.length ? Math.max(...withCoords.map((l) => l.lon!)) + 0.05 : 1;

  const toSvgX = (lon: number) => ((lon - minLon) / (maxLon - minLon || 1)) * 760 + 20;
  const toSvgY = (lat: number) => (1 - (lat - minLat) / (maxLat - minLat || 1)) * 360 + 20;

  return (
    <div className="flex flex-col h-full bg-bg-base overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle bg-surface-1 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-electric-blue-soft" />
          <h2 className="text-sm font-bold font-mono tracking-wide uppercase text-text-primary">Investigation Map</h2>
          {total > 0 && <span className="text-xs text-text-muted">· {total} location entities</span>}
        </div>
        <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={load} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-electric-blue border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="m-5 rounded-lg border border-red-400/30 bg-red-400/5 p-4 text-xs text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {!isLoading && !error && (
        <div className="flex-1 flex flex-col lg:flex-row gap-0 min-h-0">

          {/* Map SVG panel */}
          <div className="flex-1 bg-surface-2 border-b lg:border-b-0 lg:border-r border-border-subtle flex items-center justify-center p-4 min-h-[300px]">
            {withCoords.length === 0 ? (
              <div className="text-center space-y-2">
                <Navigation className="h-10 w-10 text-text-muted mx-auto" />
                <p className="text-sm text-text-muted">No location coordinates found.</p>
                <p className="text-xs text-text-muted">{noCoords.length > 0 ? `${noCoords.length} locations exist but have no lat/lon.` : "No location entities in this case."}</p>
              </div>
            ) : (
              <div className="w-full max-w-3xl">
                <div className="text-xs text-text-muted mb-2 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-electric-blue inline-block" />
                  <span>Linear projection · not tile-server (avoids sending case coordinates to third parties)</span>
                </div>
                <svg viewBox="0 0 800 400" className="w-full border border-border-subtle rounded-lg bg-surface-1" style={{ maxHeight: "400px" }}>
                  {/* Grid lines */}
                  {[0.25, 0.5, 0.75].map((f) => (
                    <g key={f}>
                      <line x1={20 + f * 760} y1={20} x2={20 + f * 760} y2={380} stroke="currentColor" className="text-border-subtle" strokeWidth="0.5" strokeDasharray="4,4" />
                      <line x1={20} y1={20 + f * 360} x2={780} y2={20 + f * 360} stroke="currentColor" className="text-border-subtle" strokeWidth="0.5" strokeDasharray="4,4" />
                    </g>
                  ))}

                  {/* DEF-066: lines between every pair of points implied relationships the API never returned; removed. */}

                  {/* Location dots */}
                  {withCoords.map((loc) => {
                    const x = toSvgX(loc.lon!);
                    const y = toSvgY(loc.lat!);
                    const isSelected = selected?.entity_id === loc.entity_id;
                    return (
                      <g key={loc.entity_id} className="cursor-pointer" onClick={() => setSelected(isSelected ? null : loc)}>
                        <circle cx={x} cy={y} r={isSelected ? 8 : 5} fill={isSelected ? "#3b82f6" : "#6b7280"} stroke={isSelected ? "#93c5fd" : "#374151"} strokeWidth="1.5" />
                        <text x={x + 9} y={y + 4} fontSize="9" fill={isSelected ? "#93c5fd" : "#9ca3af"} className="select-none">
                          {loc.label.substring(0, 20)}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {selected && (
                  <div className="mt-2 rounded-md bg-surface-1 border border-electric-blue/30 p-3 text-xs space-y-1">
                    <p className="font-semibold text-text-primary">{selected.label}</p>
                    <p className="text-text-muted font-mono">{selected.entity_id}</p>
                    <p className="text-text-muted">Lat: {selected.lat?.toFixed(6)} · Lon: {selected.lon?.toFixed(6)}</p>
                    {selected.kind_detail && <p className="text-text-muted">Type: {selected.kind_detail}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Location list sidebar */}
          <div className="w-full lg:w-72 shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-border-subtle bg-surface-1">
              <p className="text-xs font-semibold text-text-primary">{withCoords.length} with coordinates</p>
              {noCoords.length > 0 && <p className="text-[10.5px] text-text-muted">{noCoords.length} without coordinates</p>}
              {truncated && <Badge tone="amber" className="text-micro mt-1">Results truncated</Badge>}
            </div>
            <div className="divide-y divide-border-subtle">
              {locations.map((loc) => (
                <button
                  key={loc.entity_id}
                  onClick={() => setSelected(selected?.entity_id === loc.entity_id ? null : loc)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors ${selected?.entity_id === loc.entity_id ? "bg-electric-blue/10" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className={`h-3.5 w-3.5 shrink-0 ${loc.has_coords ? "text-electric-blue" : "text-text-muted"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{loc.label}</p>
                      <p className="text-[10px] text-text-muted font-mono">{loc.has_coords ? `${loc.lat?.toFixed(4)}, ${loc.lon?.toFixed(4)}` : "No coordinates"}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
