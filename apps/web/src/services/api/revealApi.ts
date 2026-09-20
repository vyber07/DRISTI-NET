import { mockFetch, type ApiResponse } from "./client";
import { post } from "./real_client";
import { MOCK_ENTITIES } from "@/mock/caseGraphData";
import { recordAuditEvent } from "./auditApi";
import type { RevealRequest, RevealResult } from "@/types/reveal";

// Store active approved reveals with time-to-live
const activeReveals = new Map<string, RevealResult>();

function buildRevealKey(entityId: string, identifierType: string): string {
  return `${entityId}:${identifierType}`;
}

export async function requestPiiReveal(
  request: RevealRequest,
): Promise<ApiResponse<RevealResult>> {
  try {
    const data = await post(`/entities/${request.entityId}/reveal`, request);
    return { data, meta: { requestId: '1', timestamp: '', durationMs: 0, securityClassification: '' } };
  } catch(e) {
    console.warn('Backend failed, fallback to mock');

  const requestId = `REV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const auditId = `AUD-${Date.now()}`;

  // Log the explicit requested unmasking attempt in the audit subsystem
  await recordAuditEvent({
    action: "REVEAL_PII_REQUESTED",
    actorBadgeNumber: request.requesterBadge,
    actorName: request.requesterName,
    actorRole: request.requesterRole,
    caseId: request.caseId,
    targetType: "PII",
    targetId: request.entityId,
    ipAddress: "10.42.18.101",
    details: {
      actionDescription: `Requested statutory unmasking of ${request.identifierType} on entity ${request.entityId}`,
      identifierType: request.identifierType,
      justification: request.justification,
      officerClearance: request.officerClearance,
      emergencyBypass: request.emergencyBypass ?? false,
    },
  });

  // Clearance rule: Level 2 or higher required for PII unmasking
  if (request.officerClearance < 2 && !request.emergencyBypass) {
    const deniedResult: RevealResult = {
      requestId,
      caseId: request.caseId,
      entityId: request.entityId,
      identifierType: request.identifierType,
      maskedValue: request.maskedValue,
      unmaskedValue: null,
      status: "DENIED",
      auditId,
      denialReason:
        "Insufficient clearance level: Minimum Level 2 (Investigator) required for PII unmasking under Sec 91 BNSS.",
    };

    // Log the denied access attempt in the audit subsystem
    await recordAuditEvent({
      action: "REVEAL_PII_DENIED",
      actorBadgeNumber: request.requesterBadge,
      actorName: request.requesterName,
      actorRole: request.requesterRole,
      caseId: request.caseId,
      targetType: "PII",
      targetId: request.entityId,
      ipAddress: "10.42.18.101",
      details: {
        actionDescription: `Denied statutory unmasking for ${request.identifierType} on ${request.entityId} — insufficient officer clearance`,
        identifierType: request.identifierType,
        justification: request.justification,
        reason: deniedResult.denialReason,
      },
    });

    return mockFetch(deniedResult, 220);
  }

  // Find the entity in authoritative mock dataset to retrieve unmasked value
  const entity = MOCK_ENTITIES.find((e) => e.id === request.entityId);
  const identifier = entity?.identifiers.find(
    (i) => i.type === request.identifierType,
  );
  const unmaskedValue = identifier?.value ?? "UNAVAILABLE";

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15-minute time-limited reveal window

  const approvedResult: RevealResult = {
    requestId,
    caseId: request.caseId,
    entityId: request.entityId,
    identifierType: request.identifierType,
    maskedValue: request.maskedValue,
    unmaskedValue,
    status: "APPROVED",
    authorizedBy:
      request.officerClearance >= 3
        ? request.requesterBadge
        : "USR-8840 (DySP S. C. Verma)",
    authorizedAt: new Date().toISOString(),
    expiresAt,
    auditId,
  };

  // Cache in memory
  activeReveals.set(
    buildRevealKey(request.entityId, request.identifierType),
    approvedResult,
  );

  // Log the approved access in audit subsystem
  await recordAuditEvent({
    action: "REVEAL_PII_APPROVED",
    actorBadgeNumber: request.requesterBadge,
    actorName: request.requesterName,
    actorRole: request.requesterRole,
    caseId: request.caseId,
    targetType: "PII",
    targetId: request.entityId,
    ipAddress: "10.42.18.101",
    details: {
      actionDescription: `Approved time-limited 15-minute unmasking of ${request.identifierType} on ${request.entityId}`,
      identifierType: request.identifierType,
      justification: request.justification,
      authorizedBy: approvedResult.authorizedBy,
      expiresAt,
      auditReference: requestId,
    },
  });

  return mockFetch(approvedResult, 200);
  }
}

export async function revokePiiReveal(
  entityId: string,
  identifierType: string,
  requesterBadge = "USR-9921",
): Promise<ApiResponse<{ success: boolean }>> {
  const key = buildRevealKey(entityId, identifierType);
  activeReveals.delete(key);

  // Log revocation in audit log
  await recordAuditEvent({
    action: "UPDATE_TIER",
    actorBadgeNumber: requesterBadge,
    actorName: "Insp. V. Rathore",
    actorRole: "Lead Investigating Officer",
    caseId: "DR-2026-00421",
    targetType: "PII",
    targetId: entityId,
    ipAddress: "10.42.18.101",
    details: {
      actionDescription: `Session unmasking revoked for ${identifierType} on ${entityId}. Field returned to default masked state.`,
      identifierType,
    },
  });

  return mockFetch({ success: true }, 100);
}

export async function getRevealStatus(
  entityId: string,
  identifierType: string,
): Promise<ApiResponse<RevealResult | null>> {
  const key = buildRevealKey(entityId, identifierType);
  const cached = activeReveals.get(key) || null;

  if (cached && cached.expiresAt) {
    if (new Date(cached.expiresAt).getTime() < Date.now()) {
      // Expired reveal session
      activeReveals.delete(key);
      return mockFetch(null, 100);
    }
  }

  return mockFetch(cached, 100);
}
