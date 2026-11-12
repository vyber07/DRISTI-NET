import { get, getPaged, patch, post, type Paged } from "./real_client";

/** Mirrors apps/api/app/services/user_requests.py. Times are UTC ISO strings ending in Z. */
export type RequestStatus = "DRAFT" | "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";
export type RequestPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type RequestAction = "edit" | "submit" | "cancel" | "claim" | "release" | "approve" | "reject" | "complete";

export interface Person { user_id: string; username: string | null; display_name: string | null; role: string | null }

export interface CategoryField {
  name: string; label: string; kind: "text" | "choice" | "case" | "integer"; required: boolean;
  choices: string[]; min: number | null; max: number | null; help: string;
}
export interface RequestCategory {
  code: string; label: string; description: string; fulfilment: "AUTO" | "MANUAL"; fulfilment_text: string; fields: CategoryField[];
}
export interface RequestMeta {
  categories: RequestCategory[]; priorities: RequestPriority[]; statuses: RequestStatus[]; max_open_per_user: number; reason_min: number;
}

export interface HistoryEntry {
  event: string; from_status: RequestStatus | null; to_status: RequestStatus | null; actor: Person | null; actor_role: string;
  at: string; reason: string | null; detail: Record<string, unknown>;
}

export interface UserRequest {
  request_id: number; reference: string; category: string; category_label: string; fulfilment: "AUTO" | "MANUAL";
  title: string; justification: string; details: Record<string, string | number>; priority: RequestPriority;
  status: RequestStatus; case_id: string | null; requester: Person; reviewer: Person | null;
  decision_reason: string | null; decided_at: string | null; completed_by: Person | null; completed_at: string | null;
  completion_note: string | null; created_at: string; submitted_at: string | null; updated_at: string;
  version: number; allowed_actions: RequestAction[];
  history?: HistoryEntry[];
  review_context?: { requester_active: boolean; requester_role: string | null; requester_jurisdiction: string | null;
                     case?: { case_id: string; title: string; jurisdiction: string } | null; can_apply?: boolean };
}

export interface RequestSummary { scope: "mine" | "all"; by_status: Record<RequestStatus, number>; open: number; assigned_to_me: number }

export interface RequestFilters {
  scope: "mine" | "all"; status?: string; category?: string; priority?: string; q?: string; requester?: string;
  assigned_to_me?: boolean; created_from?: string; created_to?: string; sort?: string; limit: number; offset: number;
}

export interface NewRequest {
  category: string; title: string; justification: string; priority: RequestPriority;
  details: Record<string, string | number>; submit: boolean;
}

export const getRequestMeta = () => get<RequestMeta>("/user-requests/categories");
export const listRequests = (f: RequestFilters): Promise<Paged<UserRequest>> =>
  getPaged<UserRequest>("/user-requests", { ...f, assigned_to_me: f.assigned_to_me || undefined });
export const getRequestSummary = (scope: "mine" | "all") => get<RequestSummary>(`/user-requests/summary?scope=${scope}`);
export const getRequest = (id: number) => get<UserRequest>(`/user-requests/${id}`);
export const createRequest = (body: NewRequest) => post<UserRequest>("/user-requests", body);
export const editRequest = (id: number, body: { version: number } & Partial<Omit<NewRequest, "submit" | "category">>) =>
  patch<UserRequest>(`/user-requests/${id}`, body);
export const actOnRequest = (id: number, action: Exclude<RequestAction, "edit">, version: number, reason?: string) =>
  post<UserRequest>(`/user-requests/${id}/${action}`, { version, ...(reason ? { reason } : {}) });

export const STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT: "Draft", PENDING: "Pending", UNDER_REVIEW: "Under review", APPROVED: "Approved", REJECTED: "Rejected",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
};
export const STATUS_TONE: Record<RequestStatus, "neutral" | "amber" | "blue" | "emerald" | "red" | "gray" | "purple"> = {
  DRAFT: "gray", PENDING: "amber", UNDER_REVIEW: "blue", APPROVED: "purple", REJECTED: "red", COMPLETED: "emerald", CANCELLED: "neutral",
};
