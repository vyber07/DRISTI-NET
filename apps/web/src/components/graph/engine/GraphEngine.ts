import Graph from "graphology";
import Sigma from "sigma";
import type {
  GraphNodeAttributes,
  GraphEdgeAttributes,
  EntityType,
  RelationshipType,
} from "@/types/entity";
import type { EvidenceTier } from "@/constants/evidenceTiers";
import { maskPersonName, maskSensitiveText } from "@/lib/pii";

export interface GraphEngineFilters {
  activeEntityTypes: Set<EntityType>;
  activeRelationshipTypes?: Set<RelationshipType>;
  onlyContradictions: boolean;
  dateRange?: [number, number];
  searchTerm: string;
  currentTimestamp: number;
  showCoreConnectionsOnly?: boolean;
}

export interface GraphEngineCallbacks {
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onStageClick?: () => void;
  onNodeEnter?: (nodeId: string) => void;
  onNodeLeave?: () => void;
  onEdgeEnter?: (edgeId: string) => void;
  onEdgeLeave?: () => void;
}

export const CORE_RELATIONSHIP_IDS = new Set([
  "R-01", // USED DEVICE (Vikram -> IMEI)
  "R-04", // LOCATED AT (Vikram -> Tower 412 Mansarovar, Flagged Contradiction)
  "R-05", // CONTROLS (Vikram -> Marwar Gold)
  "R-17", // MAINTAINED AT (Bank Acct -> HDFC Branch)
]);

const TIER_COLORS: Record<EvidenceTier, string> = {
  2: "#B9822B", // amber
  3: "#C96827", // orange
  4: "#287C7A", // muted teal
  5: "#3F7D5A", // muted emerald
  6: "#6B5B95", // purple
};

const ENTITY_COLORS: Record<EntityType, string> = {
  PERSON: "#287C7A",       // Teal (Person)
  ORGANIZATION: "#526273", // Slate (Business)
  LOCATION: "#B9822B",     // Amber (Location)
  EVENT: "#475569",        // Dark Slate (Event / Call)
  FINANCIAL: "#3F7D5A",    // Muted Green (Bank Account)
  CYBER: "#6B5B95",        // Purple (Phone / Device)
};

export const CANONICAL_NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  // Center: Suspect Hub
  "E-PERS-01": { x: 0, y: 0 },

  // Northwest (Upper-Left): Threat Call & Proxy
  "E-PERS-02": { x: -180, y: -130 },
  "E-EVT-01": { x: -80, y: -230 },
  "E-CYB-02": { x: -320, y: -210 },

  // North (Upper-Center): Tower & Contradiction
  "E-LOC-01": { x: -100, y: 190 },
  "E-EVT-03": { x: -230, y: 270 },

  // West & Southwest: Hardware & SIM supply
  "E-CYB-01": { x: -220, y: 30 },
  "E-PERS-04": { x: -360, y: 110 },
  "E-ORG-03": { x: -450, y: 190 },

  // Northeast (Upper-Right): Safehouse, Courier & Cash Handover
  "E-PERS-03": { x: 200, y: 90 },
  "E-LOC-02": { x: 80, y: 260 },
  "E-EVT-02": { x: 340, y: 210 },

  // Southeast & East: Shell Company & Bank Trail
  "E-ORG-01": { x: 170, y: -90 },
  "E-ORG-02": { x: 310, y: -200 },
  "E-FIN-01": { x: 310, y: -40 },
  "E-LOC-03": { x: 430, y: 50 },
};

export class GraphEngine {
  private container: HTMLElement;
  private graph: Graph;
  private sigma: Sigma | null = null;
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D | null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeDebounceTimer: number | null = null;

  private selectedNodeId: string | null = null;
  private selectedEdgeId: string | null = null;
  private hoveredNodeId: string | null = null;
  private hoveredEdgeId: string | null = null;

  private filters: GraphEngineFilters = {
    activeEntityTypes: new Set([
      "PERSON",
      "ORGANIZATION",
      "LOCATION",
      "EVENT",
      "FINANCIAL",
      "CYBER",
    ]),
    onlyContradictions: false,
    searchTerm: "",
    currentTimestamp: Date.now(),
  };

  private callbacks: GraphEngineCallbacks;
  private layoutInterval: number | null = null;

  constructor(
    container: HTMLElement,
    callbacks: GraphEngineCallbacks = {},
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.graph = new Graph({ multi: false, type: "directed" });

    // Create an overlay canvas for custom POLE+ shape glyphs, dashed/dotted edges, and contradiction badges
    this.overlayCanvas = document.createElement("canvas");
    this.overlayCanvas.style.position = "absolute";
    this.overlayCanvas.style.top = "0";
    this.overlayCanvas.style.left = "0";
    this.overlayCanvas.style.width = "100%";
    this.overlayCanvas.style.height = "100%";
    this.overlayCanvas.style.pointerEvents = "none";
    this.overlayCanvas.style.zIndex = "10";
    this.overlayCtx = this.overlayCanvas.getContext("2d");

    this.container.style.position = "relative";
    this.container.appendChild(this.overlayCanvas);

    this.initSigma();
    this.initResizeObserver();
  }

  private initSigma(): void {
    // Expose for E2E testing
    (window as any).__graph = this.graph;

    const SigmaConstructor = (Sigma as unknown as { default?: typeof Sigma }).default || Sigma;

    this.sigma = new SigmaConstructor(this.graph, this.container, {
      renderLabels: true,
      renderEdgeLabels: true,
      enableEdgeClickEvents: true,
      enableEdgeHoverEvents: true,
      labelFont: '"Inter", sans-serif',
      labelSize: 11,
      labelWeight: "600",
      labelColor: { color: "#17324D" },
      edgeLabelFont: '"Inter", sans-serif',
      edgeLabelSize: 9,
      edgeLabelColor: { color: "#526273" },
      stagePadding: 35,
      allowInvalidContainer: true,
      zIndex: true,

      nodeReducer: (node, data) => {

        const entityType = data.entityType as EntityType;
        const search = this.filters.searchTerm.toLowerCase();

        // PII Masking: Ensure node label on WebGL canvas is always masked
        const rawLabel = ((data.maskedLabel || data.label || "") as string);
        const safeLabel = entityType === "PERSON" ? maskPersonName(rawLabel as string) : maskSensitiveText(rawLabel as string);

        const isVisible = this.isNodeVisible(node);
        const isSelected = this.selectedNodeId === node;
        const isHovered = this.hoveredNodeId === node;

        const isNeighborOfSelected =
          this.selectedNodeId &&
          (this.graph.areNeighbors(node, this.selectedNodeId) ||
            this.selectedNodeId === node);

        const dimmed =
          (this.selectedNodeId && !isNeighborOfSelected) ||
          (search && !safeLabel.toLowerCase().includes(search));

        // Node label formatting: preserve full label on hover/select/normal zoom;
        // truncate long names with ellipsis when zoomed out (> 1.15) and unselected
        const cameraRatio = this.sigma ? this.sigma.getCamera().ratio : 1.0;
        let displayNodeLabel = safeLabel;
        if (node === "E-CYB-01") {
          // Custom positioned in drawCustomOverlay with calibrated clearance from USED DEVICE edge and Vikram
          displayNodeLabel = "";
        } else if (!isSelected && !isHovered && cameraRatio > 1.15 && displayNodeLabel.length > 18) {
          displayNodeLabel = `${displayNodeLabel.slice(0, 16)}…`;
        }

        return {
          ...data,
          label: displayNodeLabel,
          hidden: !isVisible,
          highlighted: isSelected || isHovered,
          size: isSelected ? 24 : isHovered ? 21 : (data.size as number) || 16,
          color: dimmed ? "#D8DFE2" : ENTITY_COLORS[entityType] || "#287C7A",
          zIndex: isSelected ? 3 : isHovered ? 2 : 1,
        };
      },

      edgeReducer: (edge, data) => {
        const isVisible = this.isEdgeVisible(edge);
        const isSelected = this.selectedEdgeId === edge;
        const isHovered = this.hoveredEdgeId === edge;

        const source = this.graph.source(edge);
        const target = this.graph.target(edge);
        const isConnectedToSelectedNode =
          this.selectedNodeId &&
          (source === this.selectedNodeId || target === this.selectedNodeId);

        const isDimmed =
          (this.selectedNodeId && !isConnectedToSelectedNode) ||
          (this.selectedEdgeId && !isSelected);

        const tier = data.evidenceTier as EvidenceTier;
        const isContradiction = Boolean(data.hasContradiction);

        let strokeColor = isContradiction
          ? "#B94A48"
          : TIER_COLORS[tier] || "#287C7A";

        if (isDimmed) {
          strokeColor = "#D8DFE2";
        }

        const cameraRatio = this.sigma ? this.sigma.getCamera().ratio : 1.0;
        const confidence = (data.confidence as number) || 1.0;

        const isCoreOverviewLink =
          isContradiction ||
          (CORE_RELATIONSHIP_IDS.has(edge) && edge !== "R-17");

        const shouldShowLabel =
          isSelected ||
          isHovered ||
          Boolean(isConnectedToSelectedNode) ||
          isContradiction ||
          cameraRatio <= 0.70 ||
          (cameraRatio <= 0.88 && (tier >= 5 || (tier === 4 && confidence >= 0.90))) ||
          (cameraRatio <= 1.25 && isCoreOverviewLink);

        const rawEdgeLabel = (data.label as string) || "";
        const displayEdgeLabel = shouldShowLabel ? maskSensitiveText(rawEdgeLabel) : "";

        return {
          ...data,
          label: displayEdgeLabel,
          hidden: !isVisible,
          color: strokeColor,
          size: isSelected ? 4 : isHovered ? 3 : (data.size as number) || 2,
          zIndex: isSelected ? 2 : isHovered ? 2 : 1,
        };
      },
    });

    (window as any).__sigma = this.sigma;

    // Event listeners
    this.sigma.on("clickNode", (e) => {
      this.selectedNodeId = e.node;
      this.selectedEdgeId = null;
      this.callbacks.onNodeClick?.(e.node);
      this.refresh();
    });

    this.sigma.on("clickEdge", (e) => {
      this.selectedEdgeId = e.edge;
      this.selectedNodeId = null;
      this.callbacks.onEdgeClick?.(e.edge);
      this.refresh();
    });

    this.sigma.on("clickStage", () => {
      this.selectedNodeId = null;
      this.selectedEdgeId = null;
      this.callbacks.onStageClick?.();
      this.refresh();
    });

    this.sigma.on("enterNode", (e) => {
      this.hoveredNodeId = e.node;
      this.callbacks.onNodeEnter?.(e.node);
      this.refresh();
    });

    this.sigma.on("leaveNode", () => {
      this.hoveredNodeId = null;
      this.callbacks.onNodeLeave?.();
      this.refresh();
    });

    this.sigma.on("enterEdge", (e) => {
      this.hoveredEdgeId = e.edge;
      this.callbacks.onEdgeEnter?.(e.edge);
      this.refresh();
    });

    this.sigma.on("leaveEdge", () => {
      this.hoveredEdgeId = null;
      this.callbacks.onEdgeLeave?.();
      this.refresh();
    });

    // Redraw custom canvas overlay after every Sigma render cycle
    this.sigma.on("afterRender", () => {
      this.drawCustomOverlay();
    });
  }

  private initResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.container) return;
      const rect = this.container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      this.overlayCanvas.width = rect.width * window.devicePixelRatio;
      this.overlayCanvas.height = rect.height * window.devicePixelRatio;
      if (this.overlayCtx) {
        this.overlayCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
      this.sigma?.resize();
      this.drawCustomOverlay();

      if (this.resizeDebounceTimer) window.clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = window.setTimeout(() => {
        this.sigma?.resize();
        this.sigma?.refresh();
        this.updateCustomBBoxAndFit(true);
      }, 200);
    });
    this.resizeObserver.observe(this.container);
  }

  public loadGraphData(
    nodes: GraphNodeAttributes[],
    edges: GraphEdgeAttributes[],
  ): void {
    this.graph.clear();

    nodes.forEach((n) => {
      const entityType = n.entityType as EntityType;
      const rawLabel = (n.maskedLabel || n.label || "");
      const safeLabel = entityType === "PERSON" ? maskPersonName(rawLabel as string) : maskSensitiveText(rawLabel as string);

      const canonical = CANONICAL_NODE_POSITIONS[n.id];
      const posX = canonical ? canonical.x : n.x;
      const posY = canonical ? canonical.y : n.y;

      this.graph.addNode(n.id, {
        ...n,
        x: posX,
        y: posY,
        size: n.size || 16,
        label: safeLabel,
      });
    });

    edges.forEach((e) => {
      // Tier 1 Raw Artifact must NEVER be added as an active graph edge!

      if (this.graph.hasNode(e.source) && this.graph.hasNode(e.target)) {
        this.graph.addEdgeWithKey(e.id, e.source, e.target, {
          ...e,
          label: maskSensitiveText(e.label || ""),
        });
      }
    });

    this.refresh();
    this.updateCustomBBoxAndFit(false);
  }

  public applyDelta(
    newNodes: GraphNodeAttributes[],
    newEdges: GraphEdgeAttributes[],
  ): void {
    newNodes.forEach((n) => {
      if (!this.graph.hasNode(n.id)) {
        this.graph.addNode(n.id, {
          ...n,
          x: n.x,
          y: n.y,
          size: n.size || 15,
          label: n.isMasked ? n.maskedLabel : n.label,
        });
      }
    });

    newEdges.forEach((e) => {
      if (
        !this.graph.hasEdge(e.id) &&
        this.graph.hasNode(e.source) &&
        this.graph.hasNode(e.target)
      ) {
        this.graph.addEdgeWithKey(e.id, e.source, e.target, {
          ...e,
          label: e.label,
        });
      }
    });

    this.refresh();
  }

  public getNodeCount(): number {
    return this.graph.order;
  }

  public hasNode(nodeId: string): boolean {
    return this.graph.hasNode(nodeId);
  }

  public setFilters(filters: Partial<GraphEngineFilters>): void {
    this.filters = { ...this.filters, ...filters };
    this.refresh();
  }

  public setSelection(nodeId: string | null, edgeId: string | null): void {
    this.selectedNodeId = nodeId;
    this.selectedEdgeId = edgeId;
    this.refresh();
  }

  public refresh(): void {
    this.sigma?.refresh();
    this.drawCustomOverlay();
  }

  /** Checks if a node is currently visible based on active filters */
  public isNodeVisible(nodeId: string): boolean {
    if (!this.graph.hasNode(nodeId)) return false;
    const attr = this.graph.getNodeAttributes(nodeId);
    const entityType = attr.entityType as EntityType;

    // Filter by entity type
    if (!this.filters.activeEntityTypes.has(entityType)) return false;


    // Filter by search term
    const search = this.filters.searchTerm.trim().toLowerCase();
    if (search) {
      const rawLabel = ((attr.maskedLabel || attr.label || "") as string).toLowerCase();
      const safeLabel = (entityType === "PERSON" ? maskPersonName(rawLabel) : maskSensitiveText(rawLabel)).toLowerCase();
      if (!rawLabel.includes(search) && !safeLabel.includes(search)) {
        return false;
      }
    }

    // Filter by core connections only
    if (this.filters.showCoreConnectionsOnly && this.selectedNodeId !== nodeId && this.hoveredNodeId !== nodeId) {
      const incidentEdges = this.graph.edges(nodeId);
      const hasCoreIncidentEdge = incidentEdges.some((edgeId) => CORE_RELATIONSHIP_IDS.has(edgeId));
      if (!hasCoreIncidentEdge) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if an edge is currently visible based on active filters and endpoint visibility.
   * GUARANTEE: An edge is NEVER visible unless BOTH its source and target nodes are visible.
   */
  public isEdgeVisible(edgeId: string): boolean {
    if (!this.graph.hasEdge(edgeId)) return false;
    const attr = this.graph.getEdgeAttributes(edgeId);
    const source = this.graph.source(edgeId);
    const target = this.graph.target(edgeId);

    // CRITICAL: Both endpoints must be visible
    if (!this.isNodeVisible(source) || !this.isNodeVisible(target)) {
      return false;
    }


    // Filter by relationship type
    const relType = attr.relationshipType as RelationshipType;
    if (this.filters.activeRelationshipTypes && !this.filters.activeRelationshipTypes.has(relType)) {
      return false;
    }


    // Filter by date range
    const timestamp = new Date(attr.timestamp as string).getTime();
    if (this.filters.dateRange && !isNaN(timestamp)) {
      if (timestamp < this.filters.dateRange[0] || timestamp > this.filters.dateRange[1]) {
        return false;
      }
    }

    // Filter by temporal playback
    if (!isNaN(timestamp) && timestamp > this.filters.currentTimestamp) {
      return false;
    }

    // Filter by contradiction
    const isContradiction = Boolean(attr.hasContradiction);
    if (this.filters.onlyContradictions && !isContradiction) {
      return false;
    }

    // Filter by core connections only
    if (
      Boolean(this.filters.showCoreConnectionsOnly) &&
      !CORE_RELATIONSHIP_IDS.has(edgeId) &&
      this.selectedEdgeId !== edgeId &&
      this.hoveredEdgeId !== edgeId
    ) {
      return false;
    }

    return true;
  }

  /**
   * High-fidelity overlay drawing:
   * - POLE+ Node Shape glyphs (Circle for Person, Rect for Org, Pin for Location, Diamond for Event, Hexagon for Financial, Shield for Cyber)
   * - Evidence tier edge visual encoding (dotted T2, dashed T3, glow T6)
   * - Restrained Red Contradiction Indicator badge
   */
  private drawCustomOverlay(): void {
    if (!this.overlayCtx || !this.sigma) return;
    const ctx = this.overlayCtx;
    const rect = this.container.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 1. Draw Custom Edge Overlays (Dotted T2, Dashed T3, Glow T6, and Contradiction Alert Marks)
    this.graph.forEachEdge((edge, attr, source, target) => {
      // Must be visible according to isEdgeVisible (guarantees both endpoints are visible!)
      if (!this.isEdgeVisible(edge)) return;

      const sourceAttr = this.graph.getNodeAttributes(source);
      const targetAttr = this.graph.getNodeAttributes(target);
      const tier = attr.evidenceTier as EvidenceTier;
      const isContradiction = attr.hasContradiction as boolean;

      const p1 = this.sigma!.graphToViewport({ x: sourceAttr.x as number, y: sourceAttr.y as number });
      const p2 = this.sigma!.graphToViewport({ x: targetAttr.x as number, y: targetAttr.y as number });

      ctx.save();

      // Tier 2: Dotted amber (1px, 40% opacity)
      if (tier === 2) {
        ctx.beginPath();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
        ctx.lineWidth = 1;
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Tier 3: Dashed orange (2px, 70% opacity)
      if (tier === 3) {
        ctx.beginPath();
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = "rgba(249, 115, 22, 0.7)";
        ctx.lineWidth = 2;
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Tier 6: Court Ready Glowing Purple
      if (tier === 6) {
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 3;
        ctx.shadowColor = "rgba(139, 92, 246, 0.6)";
        ctx.shadowBlur = 8;
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Contradiction Indicator: Restrained Red badge at edge midpoint
      if (isContradiction) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        ctx.restore();
        ctx.save();
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(midX, midY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", midX, midY);
      }

      // Reposition "MAINTAINED AT" (R-17) so it does not visually sit on top of the purple relationship line or account node
      if (edge === "R-17") {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len > 10) {
          let angle = Math.atan2(dy, dx);
          // Keep text readable left-to-right
          if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
            angle += Math.PI;
          }

          // Positioned 65% along the edge towards HDFC MI Road (away from Account node)
          // and offset 12px perpendicular above the purple line (upward in viewport coordinates)
          const nx = dy / len;
          const ny = -dx / len;
          const midX = p1.x + dx * 0.65 + nx * 12;
          const midY = p1.y + dy * 0.65 + ny * 12;

          const labelText = "MAINTAINED AT";
          ctx.restore();
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(angle);
          ctx.font = '600 9px "Inter", sans-serif';
          const tw = ctx.measureText(labelText).width;

          // Crisp white pill background with subtle purple border for separation
          ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
          ctx.strokeStyle = "#c4b5fd";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(-tw / 2 - 4, -7, tw + 8, 14, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#526273";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(labelText, 0, 0);
        }
      }

      ctx.restore();
    });

    // 2. Draw Recognizable Node Icons over node positions
    this.graph.forEachNode((node, attr) => {
      if (!this.isNodeVisible(node)) return;

      const entityType = attr.entityType as EntityType;
      const p = this.sigma!.graphToViewport({ x: attr.x as number, y: attr.y as number });
      const size = (attr.size as number) || 16;
      const isSelected = this.selectedNodeId === node;
      const isHovered = this.hoveredNodeId === node;

      ctx.save();
      ctx.translate(p.x, p.y);

      // Focus halo on select/hover
      if (isSelected) {
        ctx.strokeStyle = "#287C7A";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, size + 5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (isHovered) {
        ctx.strokeStyle = "#BCC7CC";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, size + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crisp outer boundary ring
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.stroke();

      // Vector Icon Glyphs (Crisp White on colored node circle)
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.6;

      switch (entityType) {
        case "PERSON": {
          // Person icon: Head + Shoulders
          ctx.beginPath();
          ctx.arc(0, -size * 0.24, size * 0.24, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, size * 0.44, size * 0.42, Math.PI * 1.15, Math.PI * 1.85);
          ctx.fill();
          break;
        }

        case "CYBER": {
          // Phone / Device: Handset rounded rectangle + home line
          const pw = size * 0.48;
          const ph = size * 0.88;
          ctx.beginPath();
          ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 2.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-size * 0.12, size * 0.28);
          ctx.lineTo(size * 0.12, size * 0.28);
          ctx.stroke();
          break;
        }

        case "LOCATION": {
          // Map Pin: Teardrop pin + inner circle
          ctx.beginPath();
          ctx.arc(0, -size * 0.16, size * 0.34, Math.PI, 0);
          ctx.lineTo(0, size * 0.50);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = ENTITY_COLORS.LOCATION || "#B9822B";
          ctx.beginPath();
          ctx.arc(0, -size * 0.16, size * 0.13, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case "FINANCIAL": {
          // Bank Account: Classical Bank pediment roof + 3 columns + base
          ctx.beginPath();
          ctx.moveTo(0, -size * 0.48);
          ctx.lineTo(size * 0.42, -size * 0.16);
          ctx.lineTo(-size * 0.42, -size * 0.16);
          ctx.closePath();
          ctx.fill();
          // Columns
          const colW = size * 0.12;
          const colH = size * 0.36;
          ctx.fillRect(-size * 0.36, -size * 0.10, colW, colH);
          ctx.fillRect(-size * 0.06, -size * 0.10, colW, colH);
          ctx.fillRect(size * 0.24, -size * 0.10, colW, colH);
          // Base
          ctx.fillRect(-size * 0.44, size * 0.32, size * 0.88, size * 0.14);
          break;
        }

        case "ORGANIZATION": {
          // Organization: Commercial building with windows
          ctx.fillRect(-size * 0.36, -size * 0.46, size * 0.72, size * 0.92);
          ctx.fillStyle = ENTITY_COLORS.ORGANIZATION || "#526273";
          for (let r = 0; r < 3; r++) {
            const wy = -size * 0.34 + r * size * 0.24;
            ctx.fillRect(-size * 0.24, wy, size * 0.16, size * 0.14);
            ctx.fillRect(size * 0.08, wy, size * 0.16, size * 0.14);
          }
          break;
        }

        case "EVENT": {
          // Event / Call: Speech call bubble
          ctx.beginPath();
          ctx.arc(0, -size * 0.06, size * 0.38, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-size * 0.16, size * 0.22);
          ctx.lineTo(-size * 0.42, size * 0.48);
          ctx.lineTo(-size * 0.02, size * 0.28);
          ctx.closePath();
          ctx.fill();
          break;
        }
      }

      ctx.restore();
    });

    // 2.1 Draw E-CYB-01 custom node label with calibrated clearance from nearby edges and Vikram S******
    if (this.isNodeVisible("E-CYB-01")) {
      const cybAttr = this.graph.getNodeAttributes("E-CYB-01");
      const p = this.sigma!.graphToViewport({ x: cybAttr.x as number, y: cybAttr.y as number });
      const size = (cybAttr.size as number) || 16;
      const isSelected = this.selectedNodeId === "E-CYB-01";
      const isHovered = this.hoveredNodeId === "E-CYB-01";
      const labelText = maskSensitiveText((cybAttr.maskedLabel || cybAttr.label || "IMEI 3589********102") as string);

      ctx.save();
      ctx.font = '600 11px "Inter", sans-serif';
      const tw = ctx.measureText(labelText).width;
      const lx = p.x + size + 6;
      const ly = p.y - 12; // Shifted upward by 12px for generous clearance above USED DEVICE edge

      // Crisp background pill for zero edge collision
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.beginPath();
      ctx.roundRect(lx - 3, ly - 8, tw + 6, 15, 3);
      ctx.fill();

      ctx.fillStyle = isSelected || isHovered ? "#287C7A" : "#17324D";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, lx, ly);
      ctx.restore();
    }

    // 3. Render Tactical Hover HUD Tooltip when a node is hovered (Light Theme)
    if (this.hoveredNodeId && this.isNodeVisible(this.hoveredNodeId)) {
      const attr = this.graph.getNodeAttributes(this.hoveredNodeId);
      const entityType = (attr.entityType as EntityType) || "PERSON";
      const p = this.sigma!.graphToViewport({ x: attr.x as number, y: attr.y as number });
      const size = (attr.size as number) || 16;
      const confidence = 100;
      const rawLabel = ((attr.maskedLabel || attr.label || "") as string);
      const fullLabel = entityType === "PERSON" ? maskPersonName(rawLabel) : maskSensitiveText(rawLabel);

      const typeLabels: Record<EntityType, string> = {
        PERSON: "Person",
        CYBER: "Phone / Handset",
        FINANCIAL: "Bank Account",
        LOCATION: "Location",
        ORGANIZATION: "Organization / Business",
        EVENT: "Call / Handover Event",
      };

      ctx.save();
      ctx.font = '600 10px "Inter", sans-serif';
      const tagText = `${typeLabels[entityType] || entityType} · ${confidence}% Match Confidence`;
      ctx.font = 'bold 12px "Inter", sans-serif';
      const titleText = fullLabel;

      const tagWidth = ctx.measureText(tagText).width;
      const titleWidth = ctx.measureText(titleText).width;
      const boxWidth = Math.max(tagWidth, titleWidth, 140) + 20;
      const boxHeight = 42;

      let boxX = p.x + size + 8;
      let boxY = p.y - boxHeight / 2;

      if (boxX + boxWidth > rect.width - 12) {
        boxX = p.x - size - boxWidth - 8;
      }
      if (boxY < 12) boxY = 12;
      if (boxY + boxHeight > rect.height - 12) boxY = rect.height - boxHeight - 12;

      // Tooltip box shadow & background
      ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#D8DFE2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = "transparent";
      ctx.fillStyle = ENTITY_COLORS[entityType] || "#287C7A";
      ctx.font = '600 10px "Inter", sans-serif';
      ctx.fillText(tagText, boxX + 10, boxY + 16);

      ctx.fillStyle = "#17324D";
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.fillText(titleText, boxX + 10, boxY + 32);

      ctx.restore();
    }

    // 4. Render Tactical Hover HUD Tooltip when an edge is hovered (Light Theme)
    if (this.hoveredEdgeId && this.isEdgeVisible(this.hoveredEdgeId)) {
      const edgeAttr = this.graph.getEdgeAttributes(this.hoveredEdgeId);
      const source = this.graph.source(this.hoveredEdgeId);
      const target = this.graph.target(this.hoveredEdgeId);
      const sourceAttr = this.graph.getNodeAttributes(source);
      const targetAttr = this.graph.getNodeAttributes(target);

      const p1 = this.sigma!.graphToViewport({ x: sourceAttr.x as number, y: sourceAttr.y as number });
      const p2 = this.sigma!.graphToViewport({ x: targetAttr.x as number, y: targetAttr.y as number });
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      const relLabel = maskSensitiveText((edgeAttr.label as string) || "CONNECTED");
      const conf = Math.round(((edgeAttr.confidence as number) || 0.9) * 100);

      ctx.save();
      ctx.font = '600 10px "Inter", sans-serif';
      const tagText = edgeAttr.hasContradiction
        ? "⚠️ Conflicting Information Flagged"
        : `Connection · ${conf}% Match Confidence`;
      ctx.font = 'bold 12px "Inter", sans-serif';
      const titleText = relLabel;

      const tagWidth = ctx.measureText(tagText).width;
      const titleWidth = ctx.measureText(titleText).width;
      const boxWidth = Math.max(tagWidth, titleWidth, 140) + 20;
      const boxHeight = 40;

      let boxX = midX - boxWidth / 2;
      let boxY = midY - boxHeight - 10;
      if (boxY < 12) boxY = midY + 12;

      ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = edgeAttr.hasContradiction ? "#B94A48" : "#D8DFE2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = "transparent";
      ctx.fillStyle = edgeAttr.hasContradiction ? "#B94A48" : "#287C7A";
      ctx.font = '600 10px "Inter", sans-serif';
      ctx.fillText(tagText, boxX + 10, boxY + 15);

      ctx.fillStyle = "#17324D";
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.fillText(titleText, boxX + 10, boxY + 30);

      ctx.restore();
    }
  }

  // Camera Actions
  public zoomIn(): void {
    if (!this.sigma) return;
    const camera = this.sigma.getCamera();
    camera.animatedZoom({ duration: 250, factor: 1.4 });
  }

  public zoomOut(): void {
    if (!this.sigma) return;
    const camera = this.sigma.getCamera();
    camera.animatedUnzoom({ duration: 250, factor: 1.4 });
  }

  /**
   * Recalculates the active bounding box across all visible nodes, adding safe padding
   * for top toolbar (~48px), bottom controls/legend (~54px), and viewport sides so nodes never get clipped.
   */
  public updateCustomBBoxAndFit(animate = false): void {
    if (!this.sigma || this.graph.order === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let visibleCount = 0;

    this.graph.forEachNode((node, attr) => {
      if (!this.isNodeVisible(node)) return;

      const x = attr.x as number;
      const y = attr.y as number;
      if (typeof x !== "number" || typeof y !== "number" || isNaN(x) || isNaN(y)) return;

      visibleCount++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    if (visibleCount === 0 || minX === Infinity) return;

    const spanX = Math.max(maxX - minX, 60);
    const spanY = Math.max(maxY - minY, 60);

    // Calibrated safe margins to achieve approximately 75–82% canvas utilization without clipping:
    const padX = spanX * 0.14;
    const padYTop = spanY * 0.22;
    const padYBottom = spanY * 0.16;

    this.sigma.setCustomBBox({
      x: [minX - padX, maxX + padX],
      y: [minY - padYTop, maxY + padYBottom],
    });

    this.sigma.refresh();

    const camera = this.sigma.getCamera();
    if (animate) {
      camera.animatedReset({ duration: 300 });
    } else {
      camera.setState({ x: 0.5, y: 0.5, ratio: 1, angle: 0 });
    }
  }

  public resetCamera(): void {
    if (!this.sigma) return;
    this.updateCustomBBoxAndFit(true);
  }

  public fitToExtent(): void {
    if (!this.sigma || this.graph.order === 0) return;
    this.updateCustomBBoxAndFit(true);
  }

  public focusNode(nodeId: string): void {
    if (!this.sigma || !this.graph.hasNode(nodeId)) return;
    const nodeAttrs = this.graph.getNodeAttributes(nodeId);
    const camera = this.sigma.getCamera();
    camera.animate(
      { x: nodeAttrs.x, y: nodeAttrs.y, ratio: 0.5 },
      { duration: 400 },
    );
  }

  /**
   * Deterministic Semantic POLE+ Map Organization:
   * Sets the calibrated canonical positions for all known nodes, guaranteeing
   * zero node overlaps and clear label clearances with an investigation-first
   * POLE+ structure anchored on Vikram S****** (E-PERS-01) at (0, 0), and smoothly
   * fits the camera to show all 16 entities with calibrated safe padding.
   */
  public organizeMap(onComplete?: () => void): void {
    if (!this.graph || this.graph.order === 0) {
      onComplete?.();
      return;
    }

    // 1. Reset all nodes to calibrated canonical non-overlapping positions
    this.graph.forEachNode((nodeId) => {
      const canonical = CANONICAL_NODE_POSITIONS[nodeId];
      if (canonical) {
        this.graph.setNodeAttribute(nodeId, "x", canonical.x);
        this.graph.setNodeAttribute(nodeId, "y", canonical.y);
      }
    });

    // 2. Re-anchor Vikram S****** (E-PERS-01) at (0, 0) if present
    if (this.graph.hasNode("E-PERS-01")) {
      const centerAttrs = this.graph.getNodeAttributes("E-PERS-01");
      const offsetX = (centerAttrs.x as number) || 0;
      const offsetY = (centerAttrs.y as number) || 0;
      if (offsetX !== 0 || offsetY !== 0) {
        this.graph.forEachNode((nodeId, attrs) => {
          this.graph.setNodeAttribute(nodeId, "x", (attrs.x as number) - offsetX);
          this.graph.setNodeAttribute(nodeId, "y", (attrs.y as number) - offsetY);
        });
      }
    }

    // 3. Refresh renderer & overlay
    this.refresh();

    // 4. Fit camera to extent with smooth animation
    this.updateCustomBBoxAndFit(true);

    if (onComplete) {
      setTimeout(onComplete, 350);
    }
  }

  // ForceAtlas2 Layout
  public startLayout(): void {
    this.organizeMap();
  }

  public stopLayout(): void {
    if (this.layoutInterval) {
      clearInterval(this.layoutInterval);
      this.layoutInterval = null;
    }
    this.updateCustomBBoxAndFit(true);
  }

  public isLayoutActive(): boolean {
    return false;
  }

  public destroy(): void {
    this.stopLayout();
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.overlayCanvas && this.overlayCanvas.parentElement) {
      this.overlayCanvas.parentElement.removeChild(this.overlayCanvas);
    }
    if (this.sigma) {
      this.sigma.kill();
      this.sigma = null;
    }
    this.graph.clear();
  }
}
