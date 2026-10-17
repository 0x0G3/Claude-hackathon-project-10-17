// ---------------------------------------------------------------------------
// Resource directory (seed shape, unchanged from oc-resources.seed.json)
// ---------------------------------------------------------------------------

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

export interface EvidenceReference {
  resource_id: string;
  resource_name: string;
  source_url: string | null;
  source_quote: string | null;
  verified_date: string | null;
}

// ---------------------------------------------------------------------------
// Intake (architecture 4.1). Structured fields only: no name, no narrative.
// ---------------------------------------------------------------------------

/** The answer to a yes/no question the client may not have answered. */
export type Tri = 'yes' | 'no' | 'unknown';

/** The four questions the tool answers. */
export type Need = 'sleep' | 'work' | 'loan' | 'travel';

export type AgeBand = 'under_18' | '18_21' | '22_24' | '25_59' | '60_61' | '62_plus' | 'unknown';

export type Household = 'alone' | 'couple' | 'with_children' | 'pregnant' | 'unknown';

export interface IntakeProfile {
  /** Scenario id (C01–C12) or "custom". Never a real client identifier. */
  id: string;
  questions: Need[];
  /** Seed categories outside the four questions, e.g. "id-documents", "benefits". */
  other_needs: string[];
  age_band: AgeBand;
  /** Last city in Orange County, if any. */
  city: string | null;
  /** Cities the client has documented ties to (lived, worked, school, family). */
  city_ties: string[];
  household: Household;
  /** Only if the client offers it. Used to flag wording conflicts, never to decide. */
  gender: 'woman' | 'man' | 'nonbinary' | 'not_shared';
  adl_independent: Tri;
  mobility_device: boolean;
  disability: Tri;
  medi_cal: Tri;
  veteran: Tri;
  has: {
    ca_id: Tri;
    birth_certificate: Tri;
    phone: Tri;
    email: Tri;
    bank_account: Tri;
    mailing_address: Tri;
    permanent_residence: Tri;
  };
  born_in_california: Tri;
  /** ISO 639-1 code for the take-home plan, e.g. "en", "es". */
  language: string;
  reads_well: boolean;
  phone_ok: boolean;
  travel: { destination: string | null; host_confirmed: Tri } | null;
  safety: { feels_unsafe: boolean; crisis: boolean };
  /** A program name the client heard about, possibly wrong (scenario C12). */
  heard_of: string | null;
  /** What the client asked, in their words. Read only by the safety gate; never sent to Claude. */
  client_words: string;
}

// ---------------------------------------------------------------------------
// Structured eligibility (architecture 4.3). Every rule quotes its source.
// ---------------------------------------------------------------------------

export type Condition =
  | { kind: 'age'; min: number | null; max: number | null }
  | { kind: 'disability' }
  | { kind: 'veteran' };

/** `true` = the source states the requirement; `"unknown"` = the source is silent on a blocker that matters. */
export type Requirement = boolean | 'unknown';

export interface EligibilityRules {
  resource_id: string;
  /** Which of the four questions this listing helps answer. */
  needs: Need[];
  /** Loans are a ladder: 1 advising, 2 lenders, 3 legal help (architecture 4.5). */
  ladder_step?: 1 | 2 | 3;
  age_min?: number;
  age_max?: number;
  requires_city_ties?: string[];
  ties_detail?: string;
  spa?: 'central' | 'north';
  households?: Household[];
  requires_veteran?: boolean;
  requires_medi_cal?: boolean;
  requires_adl_independent?: boolean;
  requires_ca_id?: Requirement;
  requires_bank_account?: Requirement;
  requires_phone_or_email?: Requirement;
  requires_permanent_residence?: Requirement;
  /** Travel: someone at the destination has agreed to host. */
  requires_host_confirmed?: boolean;
  /** Stated requirements no intake field can answer. Always shown as "ask when you call". */
  other_requirements?: string[];
  /** Qualifies if any one condition is met (e.g. OCTA: 60+ or a disability). */
  qualifies_if_any?: Condition[];
  /** Source wording disagrees about who is served. Flag it; never decide. */
  gender_wording_conflict?: boolean;
  /** Verbatim quotes from the record's `eligibility` or `notes` text that each rule is based on. */
  basis: string[];
  review: { status: 'draft' | 'approved'; by: string | null; date: string | null };
}

// ---------------------------------------------------------------------------
// Directory entries with derived data (architecture 4.3)
// ---------------------------------------------------------------------------

export type Warning =
  | 'stale'
  | 'conflict'
  | 'referral_only'
  | 'low_confidence'
  | 'confidential_location'
  | 'staff_reported_problem';

export type VerificationOutcome = 'confirmed' | 'closed' | 'number_wrong' | 'changed';

export interface Verification {
  resource_id: string;
  date: string;
  outcome: VerificationOutcome;
  note: string;
}

export interface DirectoryEntry extends Resource {
  rules: EligibilityRules | null;
  warnings: Warning[];
  latest_verification: Verification | null;
  confidential_location: boolean;
}

// ---------------------------------------------------------------------------
// Safety gate (architecture 4.2)
// ---------------------------------------------------------------------------

export type SafetyRoute = 'ok' | 'danger' | 'crisis' | 'medical';

export interface SafetyLine {
  resource_id: string | null;
  name: string;
  phone: string;
  hours: string | null;
}

export interface SafetyResult {
  route: SafetyRoute;
  /** True when the search must not run at all. */
  stop: boolean;
  triggers: string[];
  message: string;
  lines: SafetyLine[];
  staff_steps: string[];
  /** Things the directory can't supply, said out loud (e.g. no DV hotline in the seed). */
  missing: string[];
  /** Non-blocking: a legal or immigration question was asked. Services may be listed; advice never. */
  notices: string[];
}

// ---------------------------------------------------------------------------
// Prerequisites (architecture 4.4)
// ---------------------------------------------------------------------------

export type BlockerId = 'ca_id' | 'birth_certificate' | 'phone_or_email' | 'bank_account' | 'mailing_address';

export interface Blocker {
  id: BlockerId;
  label: string;
  /** Does the client have it? */
  has: Tri;
  blocks: { resource_id: string | null; name: string; note: string | null }[];
  unblockers: { resource_id: string; name: string; note: string }[];
  unknowns: string[];
}

// ---------------------------------------------------------------------------
// Matcher (architecture 4.5)
// ---------------------------------------------------------------------------

export type CheckOutcome = 'meets' | 'does_not_meet' | 'unknown';

export interface CheckResult {
  rule: string;
  outcome: CheckOutcome;
  detail: string;
}

export type FitStatus = 'likely_fit' | 'maybe' | 'not_a_fit';

export interface MatchItem {
  resource_id: string;
  name: string;
  status: FitStatus;
  checks: CheckResult[];
  unknown_count: number;
  confidence: 'high' | 'medium' | 'low';
  verified_date: string | null;
  warnings: Warning[];
  ladder_step: 1 | 2 | 3 | null;
}

export interface NeedMatches {
  /** One of the four questions, or an extra seed category. */
  need: string;
  items: MatchItem[];
  /** No high-confidence listing fits. Say so; never stretch a weak match. */
  no_sure_door: boolean;
}

export interface ProgramLookup {
  query: string;
  matches: { resource_id: string; name: string; matched_on: string[]; confidence: 'high' | 'medium' | 'low'; verified_date: string | null }[];
  caveat: string;
}

export interface MatchOutput {
  needs: NeedMatches[];
  program_lookup: ProgramLookup | null;
}

// ---------------------------------------------------------------------------
// Gap register and travel workflow (architecture 4.7)
// ---------------------------------------------------------------------------

export interface GapEntry {
  id: string;
  needs: string[];
  text: string;
  /** "IHH internal option" slots stay unknown until IHH staff fill them in. */
  kind: 'gap' | 'ihh_internal_slot';
  filled_by: string | null;
  filled_date: string | null;
}

export type StepState = 'done' | 'not_done' | 'unknown';

export interface TravelStep {
  id: string;
  label: string;
  state: StepState;
  note: string;
}

// ---------------------------------------------------------------------------
// Claude layer (architecture 4.6): Planner reasons, Writer phrases.
// ---------------------------------------------------------------------------

export interface FactUsed {
  field: string;
  value: string;
}

export interface PlanStep {
  order: number;
  resource_id: string;
  why_this: string;
  what_to_do_today: string;
  facts_used: FactUsed[];
  unknowns_to_ask: string[];
  warnings: string[];
}

export interface PlanQuestion {
  question: string;
  steps: PlanStep[];
  gaps: string[];
}

export interface PlanOutput {
  questions: PlanQuestion[];
  ordering_notes: string[];
}

export interface PlanLine {
  when: 'today' | 'this_week';
  resource_id: string | null;
  text: string;
}

export interface ClientPlan {
  language: string;
  lines: PlanLine[];
  /** English copy for staff, printed below the client's language. Empty when language is English. */
  english_lines: PlanLine[];
}

// ---------------------------------------------------------------------------
// Session (one case worker run through the online path)
// ---------------------------------------------------------------------------

export interface FactCheckReport {
  passed: boolean;
  problems: string[];
}

export interface SessionResult {
  profile_id: string;
  status: 'stopped_by_safety' | 'ok' | 'could_not_generate_safely';
  safety: SafetyResult;
  prerequisites: Blocker[];
  matches: MatchOutput | null;
  gaps: GapEntry[];
  travel_steps: TravelStep[] | null;
  plan: PlanOutput | null;
  client_plan: ClientPlan | null;
  fact_check: FactCheckReport & { writer_attempts: number; planner_rejected: string[] };
  engine: { planner: 'claude' | 'rules'; writer: 'claude' | 'rules' };
  /** Masked directory entries for every listing the session mentions, for the review screen. */
  records: Record<string, Omit<DirectoryEntry, 'rules'>>;
  checked_on: string;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Offline pipeline (architecture 3b): Fetcher → Extractor → Verifier → staff
// ---------------------------------------------------------------------------

export interface ExtractedField {
  field: 'name' | 'phone' | 'address' | 'hours' | 'eligibility' | 'website';
  value: string;
  quote: string;
}

export interface ExtractedFlag {
  kind: 'closure' | 'operator_change' | 'conflicting_number' | 'hijacked_domain' | 'other';
  quote: string;
  note: string;
}

export interface Extraction {
  fields: ExtractedField[];
  needs: string[];
  flags: ExtractedFlag[];
}

export interface RecheckProposal {
  field: ExtractedField['field'];
  current: string | null;
  proposed: string;
  quote: string;
  quote_found: boolean;
  format_ok: boolean;
  changed: boolean;
}

export interface RecheckResult {
  resource_id: string;
  url: string;
  allowed: boolean;
  refused_reason: string | null;
  http_status: number | null;
  fetched_at: string;
  changed_since_last: boolean | null;
  extractor: 'claude' | 'rules' | null;
  proposals: RecheckProposal[];
  flags: (ExtractedFlag & { quote_found: boolean })[];
}

// ---------------------------------------------------------------------------
// Case management scaffold (Firestore; unchanged)
// ---------------------------------------------------------------------------

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
