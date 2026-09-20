import { get } from "./real_client";
import type { ApiResponse } from "./client";
import type { any, TimelineFilter } from "@/types/timeline";

export async function getTimelineEvents(caseId: string, filter?: TimelineFilter): Promise<ApiResponse<any[]>> {
  const data = await get(`/cases/${caseId}/timeline`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
