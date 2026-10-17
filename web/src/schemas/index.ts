import { z } from 'zod';

export const ResourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  organization: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()),
  description: z.string(),
  services: z.array(z.string()),
  eligibility: z.string().nullable(),
  population: z.array(z.string()),
  how_to_access: z.string(),
  referral_required: z.boolean().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  hours: z.string().nullable(),
  languages: z.array(z.string()).nullable(),
  cost: z.string().nullable(),
  website: z.string().nullable(),
  source_url: z.string().nullable(),
  source_quote: z.string().nullable(),
  verified_date: z.string().nullable(),
  confidence: z.string().nullable(),
  notes: z.string().nullable(),
  is_confidential_address: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

const Tri = z.enum(['yes', 'no', 'unknown']);
export const NeedEnum = z.enum(['sleep', 'work', 'loan', 'travel']);

export const IntakeProfileSchema = z.object({
  id: z.string().min(1).max(40),
  questions: z.array(NeedEnum),
  other_needs: z.array(z.string().max(40)).max(10),
  age_band: z.enum(['under_18', '18_21', '22_24', '25_59', '60_61', '62_plus', 'unknown']),
  city: z.string().max(60).nullable(),
  city_ties: z.array(z.string().max(60)).max(10),
  household: z.enum(['alone', 'couple', 'with_children', 'pregnant', 'unknown']),
  gender: z.enum(['woman', 'man', 'nonbinary', 'not_shared']),
  adl_independent: Tri,
  mobility_device: z.boolean(),
  disability: Tri,
  medi_cal: Tri,
  veteran: Tri,
  has: z.object({
    ca_id: Tri,
    birth_certificate: Tri,
    phone: Tri,
    email: Tri,
    bank_account: Tri,
    mailing_address: Tri,
    permanent_residence: Tri,
  }),
  born_in_california: Tri,
  language: z.string().min(2).max(10),
  reads_well: z.boolean(),
  phone_ok: z.boolean(),
  travel: z.object({ destination: z.string().max(80).nullable(), host_confirmed: Tri }).nullable(),
  safety: z.object({ feels_unsafe: z.boolean(), crisis: z.boolean() }),
  heard_of: z.string().max(120).nullable(),
  client_words: z.string().max(1000),
});

export const SessionRequestSchema = z.object({
  profile: IntakeProfileSchema,
  /** Off by default so the demo runs without an API key; the rules engine is the safe fallback. */
  useAi: z.boolean().optional().default(false),
});

export const MatchRequestSchema = z
  .object({
    scenarioId: z.string().optional(),
    profile: IntakeProfileSchema.optional(),
  })
  .refine(data => data.scenarioId || data.profile, {
    message: 'Either scenarioId or profile must be provided',
  });

// ---------------------------------------------------------------------------
// Verification overlay ("I called")
// ---------------------------------------------------------------------------

export const VerificationInputSchema = z.object({
  resource_id: z.string().min(1),
  outcome: z.enum(['confirmed', 'closed', 'number_wrong', 'changed']),
  note: z.string().max(500).default(''),
});

// ---------------------------------------------------------------------------
// Claude outputs. Kept to plain types so they translate to structured-output JSON schema.
// ---------------------------------------------------------------------------

export const PlanOutputSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe('One of sleep, work, loan, travel, prerequisites, or an extra category'),
      steps: z.array(
        z.object({
          order: z.number().int(),
          resource_id: z.string().describe('Must be one of the resource ids you were given'),
          why_this: z.string().describe('Plain-language reason based only on the check results'),
          what_to_do_today: z.string(),
          facts_used: z.array(
            z.object({
              field: z.string().describe('Record field the value is copied from: phone, address, hours, website, name, how_to_access or notes'),
              value: z.string().describe('Copied verbatim from that field'),
            })
          ),
          unknowns_to_ask: z.array(z.string()),
          warnings: z.array(z.string()),
        })
      ),
      gaps: z.array(z.string()),
    })
  ),
  ordering_notes: z.array(z.string()),
});

const PlanLineSchema = z.object({
  when: z.enum(['today', 'this_week']),
  resource_id: z.string().nullable(),
  text: z.string(),
});

export const ClientPlanSchema = z.object({
  language: z.string(),
  lines: z.array(PlanLineSchema),
  english_lines: z.array(PlanLineSchema),
});

export const ExtractionSchema = z.object({
  fields: z.array(
    z.object({
      field: z.enum(['name', 'phone', 'address', 'hours', 'eligibility', 'website']),
      value: z.string().describe('The value as the page states it, or "unknown"'),
      quote: z.string().describe('Exact text copied from the page that states the value'),
    })
  ),
  needs: z.array(z.enum(['sleep', 'work', 'loan', 'travel', 'other'])),
  flags: z.array(
    z.object({
      kind: z.enum(['closure', 'operator_change', 'conflicting_number', 'hijacked_domain', 'other']),
      quote: z.string(),
      note: z.string(),
    })
  ),
});

export const RecheckRequestSchema = z.object({
  resource_id: z.string().min(1),
  useAi: z.boolean().optional().default(false),
});

export const RecheckApprovalSchema = z.object({
  resource_id: z.string().min(1),
  approved: z.array(
    z.object({
      field: z.string(),
      current: z.string().nullable(),
      proposed: z.string(),
      quote: z.string(),
    })
  ),
});

// ---------------------------------------------------------------------------
// Case management scaffold (Firestore; unchanged)
// ---------------------------------------------------------------------------

export const CaseStatusEnum = z.enum([
  'intake',
  'matched',
  'in_review',
  'action_plan_ready',
  'referred',
  'closed',
]);

export const CreateCaseSchema = z.object({
  fictionalClientId: z.string().min(1, "Client ID required"),
  needCategory: z.string().min(1, "Need category required"),
  status: CaseStatusEnum.optional().default('intake'),
  assignedCoordinator: z.string().min(1, "Coordinator required"),
});

export const UpdateCaseSchema = z.object({
  status: CaseStatusEnum.optional(),
  assignedCoordinator: z.string().optional(),
  notes: z.string().optional(),
});

export const CreateActivitySchema = z.object({
  actionType: z.enum([
    'status_change',
    'resource_match',
    'staff_note',
    'referral_initiated',
    'plan_generated',
  ]),
  resourceId: z.string().nullable().optional(),
  status: z.string().min(1),
  notes: z.string().min(1),
});
