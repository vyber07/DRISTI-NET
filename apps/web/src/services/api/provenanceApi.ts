import { mockFetch, type ApiResponse } from "./client";
import { MOCK_PROVENANCE_RECORDS } from "@/mock/caseGraphData";
import type { ProvenanceRecord } from "@/types/entity";

export async function getProvenanceByRecordId(
  recordId: string,
): Promise<ApiResponse<ProvenanceRecord | null>> {
  const record =
    MOCK_PROVENANCE_RECORDS[recordId] ||
    Object.values(MOCK_PROVENANCE_RECORDS).find(
      (p) => p.documentId === recordId || p.recordId === recordId,
    ) ||
    null;
  return mockFetch(record, 180);
}

export async function getProvenanceByRelationshipId(
  relationshipId: string,
): Promise<ApiResponse<ProvenanceRecord | null>> {
  const record =
    MOCK_PROVENANCE_RECORDS[`PROV-${relationshipId}`] ||
    Object.values(MOCK_PROVENANCE_RECORDS).find(
      (p) => p.relationshipId === relationshipId,
    ) ||
    (relationshipId === "R-01" ? MOCK_PROVENANCE_RECORDS["PROV-R-01"] : null) ||
    null;
  return mockFetch(record, 180);
}
