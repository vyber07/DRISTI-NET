export interface TimelineEntity {
  entity_id: string;
  kind: string;
  label: string;
}

export interface TimelineEvent {
  claim_id: string;
  time: string;
  rel_type: string;
  source: TimelineEntity;
  target: TimelineEntity | null;
  evidence_id: string;
  relevance: string;
  missing: boolean;
  confidence: number;
}

export interface TimelineResponse {
  case_id: string;
  reference_time: string | null;
  count: number;
  events: TimelineEvent[];
}

export interface TimelineFilter {
  t_from?: string;
  t_to?: string;
  entity_id?: string;
}
