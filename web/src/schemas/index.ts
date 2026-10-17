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

export const ClientProfileSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  client: z.string().min(1),
  in_their_words: z.string(),
  needs: z.array(z.string()).min(1),
  constraints: z.array(z.string()),
  city: z.string().optional(),
  has_id: z.boolean().optional(),
  requires_accessibility: z.boolean().optional(),
});

export const MatchRequestSchema = z.object({
  clientId: z.string().optional(),
  profile: ClientProfileSchema.optional(),
}).refine(data => data.clientId || data.profile, {
  message: "Either clientId or profile must be provided",
});

export const EvidenceReferenceSchema = z.object({
  resource_id: z.string(),
  resource_name: z.string(),
  source_url: z.string().nullable(),
  source_quote: z.string().nullable(),
  verified_date: z.string().nullable(),
});

export const ActionPlanRequestSchema = z.object({
  clientId: z.string().min(1),
  clientSummary: z.string().min(1),
  matchedResourceIds: z.array(z.string()).min(1),
  needs: z.array(z.string()),
  constraints: z.array(z.string()),
  useAi: z.boolean().optional().default(false),
});

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
