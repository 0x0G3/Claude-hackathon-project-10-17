export interface Resource {
  id: string;
  name: string;
  organization: string;
  category: string;
  tags: string[];
  description: string;
  services: string[];
  eligibility: string | null;
  population: string[];
  how_to_access: string;
  referral_required: boolean | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  hours: string | null;
  languages: string[] | null;
  cost: string | null;
  website: string | null;
  source_url: string | null;
  source_quote: string | null;
  verified_date: string | null;
  confidence: 'high' | 'medium' | 'low' | string | null;
  notes: string | null;
  is_confidential_address?: boolean;
}

export interface ClientProfile {
  id: string;
  title: string;
  client: string;
  in_their_words: string;
  needs: string[];
  constraints: string[];
  city?: string;
  has_id?: boolean;
  requires_accessibility?: boolean;
}

export interface EvidenceReference {
  resource_id: string;
  resource_name: string;
  source_url: string | null;
  source_quote: string | null;
  verified_date: string | null;
}

export interface MatchedResourceItem {
  resource: Resource;
  match_reasons: string[];
  confidence: 'high' | 'medium' | 'low';
  confidence_score: number;
}

export interface ExcludedResourceItem {
  resource_id: string;
  resource_name: string;
  exclusion_reasons: string[];
}

export interface UnknownEligibilityItem {
  resource_id: string;
  resource_name: string;
  question: string;
  reason: string;
}

export interface MatchResult {
  client_id: string;
  client_summary: string;
  matched_resources: MatchedResourceItem[];
  excluded_resources: ExcludedResourceItem[];
  unknown_eligibility: UnknownEligibilityItem[];
  access_barriers: string[];
  evidence_references: EvidenceReference[];
  suggested_staff_actions: string[];
}

export interface ActionPlan {
  client_id: string;
  client_next_steps: string[];
  staff_checklist: string[];
  source_references: EvidenceReference[];
  unverified_requirements: string[];
  review_required: boolean;
  ai_generated: boolean;
  generated_at: string;
}

export type CaseStatus =
  | 'intake'
  | 'matched'
  | 'in_review'
  | 'action_plan_ready'
  | 'referred'
  | 'closed';

export interface DemoCase {
  caseId: string;
  fictionalClientId: string;
  needCategory: string;
  status: CaseStatus;
  assignedCoordinator: string;
  createdAt: string;
  updatedAt: string;
}

export type CaseActionType =
  | 'status_change'
  | 'resource_match'
  | 'staff_note'
  | 'referral_initiated'
  | 'plan_generated';

export interface CaseActivity {
  activityId?: string;
  caseId: string;
  actionType: CaseActionType;
  resourceId: string | null;
  status: string;
  notes: string;
  timestamp: string;
}

export interface ResourceOverride {
  resourceId: string;
  verificationStatus: 'verified' | 'unverified' | 'stale';
  lastCheckedAt: string;
  verifiedBy: string;
  notes: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}
