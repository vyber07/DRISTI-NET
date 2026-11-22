/**
 * Pure graph filter predicates — no Sigma, no Graphology instance required.
 *
 * GraphEngine calls these after extracting node/edge attributes from the graph,
 * so the predicate logic can be unit-tested without spinning up a full renderer.
 *
 * Extracted from components/graph/engine/GraphEngine.ts (Stage 5, 2026-11-06).
 */

import type { GraphEngineFilters } from "@/components/graph/engine/GraphEngine";
import type { EntityType, GraphEdgeAttributes, GraphNodeAttributes, RelationshipType } from "@/types/entity";
import { RELATIONSHIP_TYPES } from "@/types/entity";
import { maskPersonName, maskSensitiveText } from "@/lib/pii";
import { recordedTimeMs } from "@/lib/utils";

/** Entity types with known filter semantics — unmapped types remain visible. */
export const KNOWN_ENTITY_TYPES: ReadonlySet<string> = new Set([
  "PERSON", "ORGANIZATION", "LOCATION", "EVENT", "FINANCIAL", "CYBER",
]);

/** Relationship types with known filter semantics — unmapped types remain visible. */
export const KNOWN_RELATIONSHIP_TYPES: ReadonlySet<string> = new Set(RELATIONSHIP_TYPES);

/**
 * Returns true if a node should be rendered given the current filter state.
 *
 * Does NOT check endpoint visibility for edges — call isNodeVisible for each
 * endpoint separately before calling isEdgeVisible.
 */
export function isNodeVisibleForFilters(
  attr: GraphNodeAttributes,
  filters: GraphEngineFilters,
): boolean {
  const entityType = attr.entityType as EntityType;

  // Filter by entity type. Hide only explicitly deselected KNOWN types; an unmapped backend kind
  // (e.g. VEHICLE) stays visible rather than silently disappearing.
  if (KNOWN_ENTITY_TYPES.has(entityType) && !filters.activeEntityTypes.has(entityType)) {
    return false;
  }

  // Filter by search term
  const search = filters.searchTerm.trim().toLowerCase();
  if (search) {
    const rawLabel = ((attr.maskedLabel || attr.label || "") as string).toLowerCase();
    const safeLabel = (
      entityType === "PERSON" ? maskPersonName(rawLabel) : maskSensitiveText(rawLabel)
    ).toLowerCase();
    if (!rawLabel.includes(search) && !safeLabel.includes(search)) {
      return false;
    }
  }

  return true;
}

/**
 * Returns true if an edge should be rendered given the current filter state.
 *
 * GUARANTEE: sourceVisible and targetVisible must already be the result of
 * isNodeVisibleForFilters() for the edge's endpoints — an edge is NEVER visible
 * unless BOTH its endpoints are visible.
 */
export function isEdgeVisibleForFilters(
  attr: GraphEdgeAttributes,
  sourceVisible: boolean,
  targetVisible: boolean,
  filters: GraphEngineFilters,
): boolean {
  // CRITICAL: Both endpoints must be visible
  if (!sourceVisible || !targetVisible) return false;

  // Filter by relationship type. Hide only types the user has explicitly deselected.
  // A rel_type outside the known vocabulary is SHOWN so frontend/backend vocabulary
  // drift never silently hides every relationship.
  const relType = attr.relationshipType as RelationshipType;
  if (
    filters.activeRelationshipTypes &&
    KNOWN_RELATIONSHIP_TYPES.has(relType) &&
    !filters.activeRelationshipTypes.has(relType)
  ) {
    return false;
  }

  // Filter by date range (FE-058: same time base as the slider)
  const edgeTimeStr = (attr.firstSeen || attr.lastSeen || attr.timestamp) as string | undefined;
  const timestamp = recordedTimeMs(edgeTimeStr);
  if (filters.dateRange && !isNaN(timestamp)) {
    if (timestamp < filters.dateRange[0] || timestamp > filters.dateRange[1]) {
      return false;
    }
  }

  // Filter by temporal playback
  if (!isNaN(timestamp) && timestamp > filters.currentTimestamp) {
    return false;
  }

  // Filter by contradiction
  if (filters.onlyContradictions && !attr.hasContradiction) {
    return false;
  }

  // Minimum extraction confidence (DEF-063). Edges with no recorded confidence are kept.
  const minConf = filters.minConfidence ?? 0;
  if (minConf > 0 && typeof attr.minConfidence === "number" && attr.minConfidence < minConf) {
    return false;
  }

  return true;
}
