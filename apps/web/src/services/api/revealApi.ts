import { post, type ApiResponse } from "./real_client";
import type { RevealRequest, RevealResult } from "@/types/reveal";

export async function requestPiiReveal(request: RevealRequest): Promise<ApiResponse<RevealResult>> {
  const payload = {
    case_id: request.caseId,
    reason: request.justification,
  };
  const rawData = await post(`/entities/${request.entityId}/reveal`, payload);
  const result: RevealResult = {
    requestId: rawData.audit_id || `req-${Date.now()}`,
    caseId: request.caseId,
    entityId: request.entityId,
    identifierType: request.identifierType,
    maskedValue: request.maskedValue,
    unmaskedValue: rawData.value || rawData.unmaskedValue || null,
    status: "APPROVED",
    authorizedBy: "INVESTIGATOR",
    authorizedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    auditId: rawData.audit_id || "audit-unmask",
  };
  return { data: result, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
