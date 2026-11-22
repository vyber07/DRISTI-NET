import { get, type ApiResponse } from "./real_client";

import type { TimelineFilter, TimelineResponse } from "@/types/timeline";

export async function getTimelineEvents(caseId: string, filter?: TimelineFilter): Promise<ApiResponse<TimelineResponse>> {
  let url = `/cases/${caseId}/timeline`;
  if (filter) {
    const params = new URLSearchParams();
    if (filter.t_from) params.append("t_from", filter.t_from);
    if (filter.t_to) params.append("t_to", filter.t_to);
    if (filter.entity_id) params.append("entity_id", filter.entity_id);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const data = await get(url);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
