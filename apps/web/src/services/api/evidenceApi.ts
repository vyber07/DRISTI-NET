import { mockFetch, type ApiResponse } from "./client";
import { get } from "./real_client";
import {
  MOCK_CASE_ID,
  MOCK_PROVENANCE_RECORDS,
} from "@/mock/caseGraphData";
import type { EvidenceItem, EvidenceFilter } from "@/types/evidence";
import { maskSensitiveText } from "@/lib/pii";

const MOCK_EVIDENCE_ITEMS: EvidenceItem[] = [
  {
    id: "DOC-CDR-2026-412",
    caseId: MOCK_CASE_ID,
    documentId: "DOC-CDR-2026-412",
    title: "Bharti Airtel Call Detail Record Intercept",
    fileName: "CDR_TRANSCRIPT_AIRTEL_SOG_ANNEX_B.pdf",
    documentType: "CDR_RECORD",
    sourceType: "TELECOM",
    sourceAgency:
      MOCK_PROVENANCE_RECORDS["PROV-R-02"].sourceAgency,
    ingestedAt: MOCK_PROVENANCE_RECORDS["PROV-R-02"].ingestedAt,
    evidenceTier: MOCK_PROVENANCE_RECORDS["PROV-R-02"].evidenceTier,
    sha256Hash: MOCK_PROVENANCE_RECORDS["PROV-R-02"].sha256Hash,
    rawArtifactId: MOCK_PROVENANCE_RECORDS["PROV-R-02"].rawArtifactId,
    rawArtifactSha256:
      MOCK_PROVENANCE_RECORDS["PROV-R-02"].rawArtifactSha256,
    provenanceRecordId: "PROV-R-02",
    relatedEntityIds: ["E-PERS-01", "E-PERS-02", "E-CYB-01"],
    relatedRelationshipIds: ["R-01", "R-02", "R-11", "R-12"],
    analystSignoff: MOCK_PROVENANCE_RECORDS["PROV-R-02"].analystSignoff,
    extractionStatus: "CORROBORATED",
    extractedSnippet:
      MOCK_PROVENANCE_RECORDS["PROV-R-02"].extractedTextSnippet,
    confidence:
      MOCK_PROVENANCE_RECORDS["PROV-R-02"].extractionConfidence,
    mimeType: "application/pdf",
    fileSizeBytes: 245120,
    isCourtAdmissible: false,
  },
  {
    id: "DOC-CONTRADICTION-412",
    caseId: MOCK_CASE_ID,
    documentId: "DOC-CONTRADICTION-412",
    title: "Spatio-Temporal Contradiction Report (Tower vs Toll ANPR)",
    fileName: "TOWER_CDR_VS_TOLL_ANPR_ARBITRATION_REPORT.pdf",
    documentType: "TOWER_DUMP_ANALYSIS",
    sourceType: "SPATIAL_ANPR",
    sourceAgency:
      MOCK_PROVENANCE_RECORDS["PROV-R-04"].sourceAgency,
    ingestedAt: MOCK_PROVENANCE_RECORDS["PROV-R-04"].ingestedAt,
    evidenceTier: MOCK_PROVENANCE_RECORDS["PROV-R-04"].evidenceTier,
    sha256Hash: MOCK_PROVENANCE_RECORDS["PROV-R-04"].sha256Hash,
    rawArtifactId: MOCK_PROVENANCE_RECORDS["PROV-R-04"].rawArtifactId,
    rawArtifactSha256:
      MOCK_PROVENANCE_RECORDS["PROV-R-04"].rawArtifactSha256,
    provenanceRecordId: "PROV-R-04",
    relatedEntityIds: ["E-PERS-01", "E-LOC-01", "E-EVT-03"],
    relatedRelationshipIds: ["R-04", "R-18"],
    analystSignoff: MOCK_PROVENANCE_RECORDS["PROV-R-04"].analystSignoff,
    extractionStatus: "FLAGGED_CONTRADICTION",
    extractedSnippet:
      MOCK_PROVENANCE_RECORDS["PROV-R-04"].extractedTextSnippet,
    confidence:
      MOCK_PROVENANCE_RECORDS["PROV-R-04"].extractionConfidence,
    mimeType: "application/pdf",
    fileSizeBytes: 512400,
    isCourtAdmissible: false,
  },
  {
    id: "DOC-BANK-HDFC-9901",
    caseId: MOCK_CASE_ID,
    documentId: "DOC-BANK-HDFC-9901",
    title: "HDFC Ledger Statement & KYC Records (Demo)",
    fileName: "HDFC_STATEMENT_MARWAR_GOLD.pdf",
    documentType: "BANK_STATEMENT",
    sourceType: "BANKING",
    sourceAgency:
      MOCK_PROVENANCE_RECORDS["PROV-R-06"].sourceAgency,
    ingestedAt: MOCK_PROVENANCE_RECORDS["PROV-R-06"].ingestedAt,
    evidenceTier: MOCK_PROVENANCE_RECORDS["PROV-R-06"].evidenceTier,
    sha256Hash: MOCK_PROVENANCE_RECORDS["PROV-R-06"].sha256Hash,
    rawArtifactId: MOCK_PROVENANCE_RECORDS["PROV-R-06"].rawArtifactId,
    rawArtifactSha256:
      MOCK_PROVENANCE_RECORDS["PROV-R-06"].rawArtifactSha256,
    provenanceRecordId: "PROV-R-06",
    relatedEntityIds: ["E-ORG-01", "E-FIN-01", "E-LOC-03"],
    relatedRelationshipIds: ["R-06", "R-08", "R-17"],
    analystSignoff: MOCK_PROVENANCE_RECORDS["PROV-R-06"].analystSignoff,
    extractionStatus: "SUPERVISOR_APPROVED",
    extractedSnippet:
      MOCK_PROVENANCE_RECORDS["PROV-R-06"].extractedTextSnippet,
    confidence:
      MOCK_PROVENANCE_RECORDS["PROV-R-06"].extractionConfidence,
    mimeType: "application/pdf",
    fileSizeBytes: 384000,
    isCourtAdmissible: true,
    bsaSection: "Source Verified (Demo)",
  },
];

export async function listEvidence(
  caseId: string,
  filter?: EvidenceFilter,
): Promise<ApiResponse<EvidenceItem[]>> {
  try {
    const data = await get(`/cases/${caseId}/evidence`);
    return { data, meta: { requestId: '1', timestamp: '', durationMs: 0, securityClassification: '' } };
  } catch(e) {
    console.warn('Backend failed, fallback to mock');

  let items = MOCK_EVIDENCE_ITEMS.filter(
    (item) => !caseId || item.caseId === caseId,
  );

  if (filter) {
    if (filter.sourceTypes && filter.sourceTypes.length > 0) {
      items = items.filter((item) =>
        filter.sourceTypes!.includes(item.sourceType),
      );
    }
    if (filter.tiers && filter.tiers.length > 0) {
      items = items.filter((item) => filter.tiers!.includes(item.evidenceTier));
    }
    if (filter.relatedEntityId) {
      items = items.filter((item) =>
        item.relatedEntityIds.includes(filter.relatedEntityId!),
      );
    }
    if (filter.searchTerm) {
      const q = filter.searchTerm.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.fileName.toLowerCase().includes(q) ||
          item.sourceAgency.toLowerCase().includes(q),
      );
    }
  }

  const sanitizedItems = items.map((item) => ({
    ...item,
    title: maskSensitiveText(item.title),
    sourceAgency: maskSensitiveText(item.sourceAgency),
    extractedSnippet: maskSensitiveText(item.extractedSnippet),
  }));

  return mockFetch(sanitizedItems, 180);
  }
}

export async function getEvidenceById(
  evidenceId: string,
): Promise<ApiResponse<EvidenceItem | null>> {
  try {
    const data = await get(`/evidence/${evidenceId}`);
    return { data, meta: { requestId: '1', timestamp: '', durationMs: 0, securityClassification: '' } };
  } catch(e) {
    console.warn('Backend failed, fallback to mock');

  const item =
    MOCK_EVIDENCE_ITEMS.find(
      (e) => e.id === evidenceId || e.documentId === evidenceId,
    ) || null;
  const sanitized = item
    ? {
        ...item,
        title: maskSensitiveText(item.title),
        sourceAgency: maskSensitiveText(item.sourceAgency),
        extractedSnippet: maskSensitiveText(item.extractedSnippet),
      }
    : null;
  return mockFetch(sanitized, 150);
  }
}

export async function getEvidenceByProvenanceId(
  provenanceId: string,
): Promise<ApiResponse<EvidenceItem | null>> {
  const item =
    MOCK_EVIDENCE_ITEMS.find((e) => e.provenanceRecordId === provenanceId) ||
    null;
  const sanitized = item
    ? {
        ...item,
        title: maskSensitiveText(item.title),
        sourceAgency: maskSensitiveText(item.sourceAgency),
        extractedSnippet: maskSensitiveText(item.extractedSnippet),
      }
    : null;
  return mockFetch(sanitized, 150);
}
