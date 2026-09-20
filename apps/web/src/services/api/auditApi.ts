import { mockFetch, type ApiResponse } from "./client";
import { get } from "./real_client";
import { MOCK_AUDIT_LOGS } from "@/mock/audit";
import type { AuditLogEntry, AuditFilter } from "@/types/audit";

// Working mutable copy for in-memory audit additions during session
let workingAuditLogs: AuditLogEntry[] = [...MOCK_AUDIT_LOGS];

function generateMockHash(): string {
  const chars = "0123456789abcdef";
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export async function listAuditLogs(
  caseId?: string,
  filter?: AuditFilter,
): Promise<ApiResponse<AuditLogEntry[]>> {
  try {
    const data = await get(`/cases/${caseId}/audit`);
    return { data, meta: { requestId: '1', timestamp: '', durationMs: 0, securityClassification: '' } };
  } catch(e) {
    console.warn('Backend failed, fallback to mock');

  let logs = workingAuditLogs;

  if (caseId) {
    logs = logs.filter((l) => l.caseId === caseId);
  }

  if (filter) {
    if (filter.action) {
      logs = logs.filter((l) => l.action === filter.action);
    }
    if (filter.actorBadgeNumber) {
      logs = logs.filter((l) => l.actorBadgeNumber === filter.actorBadgeNumber);
    }
    if (filter.targetType) {
      logs = logs.filter((l) => l.targetType === filter.targetType);
    }
    if (filter.targetId) {
      logs = logs.filter((l) => l.targetId === filter.targetId);
    }
    if (filter.startDate) {
      const startMs = new Date(filter.startDate).getTime();
      logs = logs.filter((l) => new Date(l.timestamp).getTime() >= startMs);
    }
    if (filter.endDate) {
      const endMs = new Date(filter.endDate).getTime();
      logs = logs.filter((l) => new Date(l.timestamp).getTime() <= endMs);
    }
  }

  // Return sorted with latest events first
  logs = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return mockFetch(logs, 160);
  }
}

export async function recordAuditEvent(
  entry: Omit<AuditLogEntry, "id" | "timestamp" | "hash" | "previousHash">,
): Promise<ApiResponse<AuditLogEntry>> {
  const previousEntry = workingAuditLogs[workingAuditLogs.length - 1];
  const newEntry: AuditLogEntry = {
    id: `AUD-${String(workingAuditLogs.length + 1).padStart(3, "0")}`,
    timestamp: new Date().toISOString(),
    action: entry.action,
    actorBadgeNumber: entry.actorBadgeNumber,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    caseId: entry.caseId,
    targetType: entry.targetType,
    targetId: entry.targetId,
    ipAddress: entry.ipAddress || "127.0.0.1",
    details: entry.details || {},
    hash: generateMockHash(),
    previousHash: previousEntry?.hash,
  };

  workingAuditLogs = [...workingAuditLogs, newEntry];
  return mockFetch(newEntry, 100);
}

export interface ChainVerificationResult {
  isValid: boolean;
  totalBlocks: number;
  validBlocks: number;
  brokenBlockId?: string;
  brokenReason?: string;
  verifiedAt: string;
}

export function verifyAuditChain(logs: AuditLogEntry[]): ChainVerificationResult {
  const chronological = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (chronological.length === 0) {
    return {
      isValid: true,
      totalBlocks: 0,
      validBlocks: 0,
      verifiedAt: new Date().toISOString(),
    };
  }

  let validBlocks = 1;
  for (let i = 1; i < chronological.length; i++) {
    const prev = chronological[i - 1];
    const curr = chronological[i];

    if (!curr.previousHash || curr.previousHash !== prev.hash) {
      return {
        isValid: false,
        totalBlocks: chronological.length,
        validBlocks,
        brokenBlockId: curr.id,
        brokenReason: `Hash mismatch at block ${curr.id}. Expected previousHash to equal ${prev.hash.slice(0, 12)}..., but got ${curr.previousHash ? curr.previousHash.slice(0, 12) + "..." : "none"}.`,
        verifiedAt: new Date().toISOString(),
      };
    }
    validBlocks++;
  }

  return {
    isValid: true,
    totalBlocks: chronological.length,
    validBlocks,
    verifiedAt: new Date().toISOString(),
  };
}

