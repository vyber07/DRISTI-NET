import type Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

/**
 * Deterministic, readable layout for a case graph (P1.4).
 *
 * Before: ForceAtlas2 with inferred settings (strong gravity) plus adjustSizes packed CASE-0001's 57 entities into a
 * clump: 118 node pairs overlapped on screen and 53 of 57 nodes touched another node.
 * Now, in screen pixels (the engine passes the area its camera fit will actually use):
 * 1. ForceAtlas2 from seeded positions without strong gravity, so clusters separate;
 * 2. the result is scaled into that area;
 * 3. the node radius is chosen from the room each node has (16 px when there is room, never below 6 px);
 * 4. a bounded overlap-removal pass pushes apart any two nodes closer than two radii plus a gap.
 * The server caps one view at GRAPH_MAX_NODES (150), so the O(n²) pass stays cheap. Same input, same picture.
 */

export const MAX_RADIUS = 16;
export const MIN_RADIUS = 6;
const GAP = 10;

/** Stable pseudo-random start position for a node id (FNV-1a), so the layout is the same on every load. */
export function seededPosition(id: string): { x: number; y: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  const a = ((h >>> 0) % 10000) / 10000, b = (((h >>> 0) / 10000) % 10000) / 10000;
  return { x: a * 100, y: b * 100 };
}

/** Radius that leaves every node a cell of free space in a width × height px area. */
export function radiusFor(n: number, width: number, height: number): number {
  if (n <= 1) return MAX_RADIUS;
  const cell = Math.sqrt((width * height) / n);
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, (cell - GAP) * 0.42));
}

/**
 * Lay out `graph` for an area of width × height screen pixels (what the camera fit maps the layout into). Writes x/y
 * (in px) and returns the node radius to draw.
 */
export function layoutGraph(graph: Graph, area: { width: number; height: number }): number {
  const n = graph.order;
  const width = Math.max(120, area.width), height = Math.max(90, area.height);
  if (n === 0) return MAX_RADIUS;
  graph.forEachNode((id) => {
    const p = seededPosition(id);
    graph.mergeNodeAttributes(id, { x: p.x, y: p.y });
  });
  if (n > 1) {
    forceAtlas2.assign(graph, {
      iterations: Math.min(500, 150 + n * 3),
      settings: {
        ...forceAtlas2.inferSettings(graph),
        strongGravityMode: false,
        gravity: 1,
        scalingRatio: 12,
        linLogMode: false,
        adjustSizes: false,
        barnesHutOptimize: n > 200,
      },
    });
  }
  const radius = radiusFor(n, width, height);
  separate(graph, width, height, 2 * radius + GAP);
  return radius;
}

function separate(graph: Graph, width: number, height: number, minDist: number): void {
  const ids = graph.nodes();
  const n = ids.length;
  const xs = new Float64Array(n), ys = new Float64Array(n);
  ids.forEach((id, i) => { xs[i] = graph.getNodeAttribute(id, "x") as number; ys[i] = graph.getNodeAttribute(id, "y") as number; });

  // Scale into the area, keeping a radius of margin; a single node or a line keeps its shape centred.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) { minX = Math.min(minX, xs[i]); maxX = Math.max(maxX, xs[i]); minY = Math.min(minY, ys[i]); maxY = Math.max(maxY, ys[i]); }
  const spanX = maxX - minX, spanY = maxY - minY;
  const sx = spanX > 1e-9 ? width / spanX : 0, sy = spanY > 1e-9 ? height / spanY : 0;
  for (let i = 0; i < n; i++) {
    xs[i] = sx ? (xs[i] - minX) * sx : width / 2;
    ys[i] = sy ? (ys[i] - minY) * sy : height / 2;
  }

  for (let iter = 0; iter < 120; iter++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = xs[j] - xs[i], dy = ys[j] - ys[i];
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < 1e-6) { dx = ((i * 31 + j * 17) % 7) - 3 || 1; dy = ((i * 13 + j * 29) % 7) - 3 || 1; d = Math.hypot(dx, dy); }
        const push = (minDist - d) / 2 + 0.25;
        const ux = dx / d, uy = dy / d;
        xs[i] -= ux * push; ys[i] -= uy * push;
        xs[j] += ux * push; ys[j] += uy * push;
        moved = true;
      }
    }
    // Pull back into the area so the camera fit does not have to zoom out (which would shrink the gaps again).
    for (let i = 0; i < n; i++) {
      xs[i] = Math.min(width, Math.max(0, xs[i]));
      ys[i] = Math.min(height, Math.max(0, ys[i]));
    }
    if (!moved) break;
  }
  ids.forEach((id, i) => graph.mergeNodeAttributes(id, { x: xs[i], y: ys[i] }));
}
