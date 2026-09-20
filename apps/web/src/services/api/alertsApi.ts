import { mockFetch, type ApiResponse } from "./client";
import { MOCK_ALERTS } from "@/mock/alerts";
import type { AlertItem, AlertFilter } from "@/types/alert";

let workingAlerts: AlertItem[] = [...MOCK_ALERTS];

export async function listAlerts(
  filter?: AlertFilter,
): Promise<ApiResponse<AlertItem[]>> {
  let alerts = [...workingAlerts];

  if (filter) {
    if (filter.caseId) {
      alerts = alerts.filter((a) => a.caseId === filter.caseId);
    }
    if (filter.category && filter.category !== "ALL") {
      alerts = alerts.filter((a) => a.category === filter.category);
    }
    if (filter.priority && filter.priority !== "ALL") {
      alerts = alerts.filter((a) => a.priority === filter.priority);
    }
    if (filter.status && filter.status !== "ALL") {
      alerts = alerts.filter((a) => a.status === filter.status);
    }
    if (filter.searchQuery && filter.searchQuery.trim().length > 0) {
      const q = filter.searchQuery.toLowerCase();
      alerts = alerts.filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (a.affectedEntityName && a.affectedEntityName.toLowerCase().includes(q)),
      );
    }
  }

  const priorityWeight: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    INFO: 1,
  };

  alerts.sort((a, b) => {
    const pDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    if (pDiff !== 0) return pDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return mockFetch(alerts, 120);
}

export async function acknowledgeAlert(
  alertId: string,
): Promise<ApiResponse<AlertItem | null>> {
  const index = workingAlerts.findIndex((a) => a.id === alertId);
  if (index === -1) return mockFetch(null, 100);

  const updated: AlertItem = {
    ...workingAlerts[index],
    status: "ACKNOWLEDGED",
  };
  workingAlerts = [
    ...workingAlerts.slice(0, index),
    updated,
    ...workingAlerts.slice(index + 1),
  ];
  return mockFetch(updated, 120);
}

export async function resolveAlert(
  alertId: string,
): Promise<ApiResponse<AlertItem | null>> {
  const index = workingAlerts.findIndex((a) => a.id === alertId);
  if (index === -1) return mockFetch(null, 100);

  const updated: AlertItem = {
    ...workingAlerts[index],
    status: "RESOLVED",
  };
  workingAlerts = [
    ...workingAlerts.slice(0, index),
    updated,
    ...workingAlerts.slice(index + 1),
  ];
  return mockFetch(updated, 120);
}
