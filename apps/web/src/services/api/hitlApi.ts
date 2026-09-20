import { mockFetch, type ApiResponse } from "./client";
import { get, post } from "./real_client";
import { MOCK_HITL_TASKS } from "@/mock/hitl";
import { recordAuditEvent } from "./auditApi";
import type {
  HITLTask,
  HITLFilter,
  HITLTaskDecision,
  HITLStats,
} from "@/types/hitl";

let workingTasks: HITLTask[] = [...MOCK_HITL_TASKS];

export async function listHITLTasks(
  filter?: HITLFilter,
): Promise<ApiResponse<HITLTask[]>> {
  try {
    const data = await get(`/cases/${filter?.caseId || ""}/candidates`);
    return { data, meta: { requestId: '1', timestamp: '', durationMs: 0, securityClassification: '' } };
  } catch(e) {
    console.warn('Backend failed, fallback to mock');

  let tasks = [...workingTasks];

  if (filter) {
    if (filter.caseId) {
      tasks = tasks.filter((t) => t.caseId === filter.caseId);
    }
    if (filter.status && filter.status !== "ALL") {
      tasks = tasks.filter((t) => t.status === filter.status);
    }
    if (filter.type && filter.type !== "ALL") {
      tasks = tasks.filter((t) => t.type === filter.type);
    }
    if (filter.priority && filter.priority !== "ALL") {
      tasks = tasks.filter((t) => t.priority === filter.priority);
    }
    if (filter.searchQuery && filter.searchQuery.trim().length > 0) {
      const q = filter.searchQuery.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.entityAName.toLowerCase().includes(q) ||
          (t.entityBName && t.entityBName.toLowerCase().includes(q)) ||
          (t.relationshipId && t.relationshipId.toLowerCase().includes(q)),
      );
    }
  }

  // Sort: CRITICAL first, then by priority, then by SLA/created date
  const priorityWeight: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  tasks.sort((a, b) => {
    const pDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    if (pDiff !== 0) return pDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return mockFetch(tasks, 140);
  }
}

export async function getHITLTask(
  taskId: string,
): Promise<ApiResponse<HITLTask | null>> {
  const task = workingTasks.find((t) => t.id === taskId) || null;
  return mockFetch(task, 120);
}

export async function submitTaskDecision(
  taskId: string,
  decision: HITLTaskDecision,
): Promise<ApiResponse<HITLTask>> {
  try {
    const data = await post(`/candidates/${taskId}/decision`, decision);
    return { data, meta: { requestId: '1', timestamp: '', durationMs: 0, securityClassification: '' } };
  } catch(e) {
    console.warn('Backend failed, fallback to mock');

  const index = workingTasks.findIndex((t) => t.id === taskId);
  if (index === -1) {
    return mockFetch(null as unknown as HITLTask, 100);
  }

  const existingTask = workingTasks[index];

  let nextStatus: HITLTask["status"] = "APPROVED";
  if (decision.action === "REJECT_MERGE") {
    nextStatus = "REJECTED";
  } else if (decision.action === "ESCALATE") {
    nextStatus = "ESCALATED";
  } else if (decision.action === "FLAG_CONTRADICTION") {
    nextStatus = "IN_REVIEW";
  }

  const updatedTask: HITLTask = {
    ...existingTask,
    status: nextStatus,
    decision,
    updatedAt: new Date().toISOString(),
  };

  workingTasks = [
    ...workingTasks.slice(0, index),
    updatedTask,
    ...workingTasks.slice(index + 1),
  ];

  // Discretionary Audit Recording
  const auditAction =
    decision.action === "ESCALATE"
      ? "ESCALATE_HITL_TASK"
      : decision.action === "REJECT_MERGE"
        ? "REJECT_HITL_TASK"
        : existingTask.type === "TIER_ELEVATION"
          ? "UPDATE_TIER"
          : existingTask.hasContradiction
            ? "ARBITRATE_CONTRADICTION"
            : "APPROVE_HITL_TASK";

  try {
    await recordAuditEvent({
      action: auditAction,
      actorBadgeNumber: decision.officerBadge,
      actorName: decision.officerName,
      actorRole: "Investigating Officer",
      caseId: existingTask.caseId,
      targetType: existingTask.relationshipId ? "RELATIONSHIP" : "HITL_TASK",
      targetId: existingTask.relationshipId || existingTask.id,
      ipAddress: "127.0.0.1",
      details: {
        taskId: existingTask.id,
        decisionAction: decision.action,
        justification: decision.justification,
        taskType: existingTask.type,
        newTier: decision.newTier,
        targetEntityA: existingTask.entityAName,
        targetEntityB: existingTask.entityBName,
      },
    });
  } catch {
    // Retain working state even if audit write fails in test mock
  }

  return mockFetch(updatedTask, 180);
  }
}

export async function assignTask(
  taskId: string,
  analyst: { name: string; badge: string },
): Promise<ApiResponse<HITLTask>> {
  const index = workingTasks.findIndex((t) => t.id === taskId);
  if (index === -1) {
    return mockFetch(null as unknown as HITLTask, 100);
  }

  const updatedTask: HITLTask = {
    ...workingTasks[index],
    status: "IN_REVIEW",
    assignedAnalyst: analyst,
    updatedAt: new Date().toISOString(),
  };

  workingTasks = [
    ...workingTasks.slice(0, index),
    updatedTask,
    ...workingTasks.slice(index + 1),
  ];

  return mockFetch(updatedTask, 120);
}

export async function getHITLStats(
  caseId?: string,
): Promise<ApiResponse<HITLStats>> {
  let tasks = workingTasks;
  if (caseId) {
    tasks = tasks.filter((t) => t.caseId === caseId);
  }

  const stats: HITLStats = {
    totalTasks: tasks.length,
    pendingCount: tasks.filter((t) => t.status === "PENDING").length,
    inReviewCount: tasks.filter((t) => t.status === "IN_REVIEW").length,
    resolvedCount: tasks.filter((t) => t.status === "APPROVED" || t.status === "REJECTED").length,
    criticalCount: tasks.filter((t) => t.priority === "CRITICAL" && t.status !== "APPROVED").length,
    contradictionsCount: tasks.filter((t) => t.hasContradiction).length,
    identityMergesCount: tasks.filter((t) => t.type === "ENTITY_MERGE").length,
  };

  return mockFetch(stats, 100);
}
