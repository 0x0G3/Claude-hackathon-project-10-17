import { betaZodOutputFormat, betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import {
  Blocker,
  DirectoryEntry,
  FactUsed,
  GapEntry,
  IntakeProfile,
  MatchItem,
  MatchOutput,
  PlanOutput,
  PlanQuestion,
  PlanStep,
} from '@/types';
import { PlanOutputSchema } from '@/schemas';
import { getDirectoryEntry, withoutRules } from '@/lib/resources/loader';
import { WARNING_TEXT } from '@/lib/warnings';
import { FALLBACK_PARAMS, MODEL, getClient, parseFinalJson } from './client';

/**
 * Planner (architecture 3b / 4.6). Orders the steps, weighs trade-offs, spots blockers and states
 * gaps, over the matcher's results only. It never decides eligibility and never adds a fact.
 */

export interface PlannerContext {
  profile: IntakeProfile;
  matches: MatchOutput;
  blockers: Blocker[];
  gaps: GapEntry[];
  /** Resource ids the plan may cite: matcher survivors plus unblockers. */
  allowedIds: string[];
  now: Date;
}

const MAX_STEPS_PER_QUESTION = 4;

/** Blockers whose unblocker becomes a "do this first" step. Mail help is city-specific, so it stays in the blockers panel. */
const PLAN_FIRST_BLOCKERS = new Set(['ca_id', 'birth_certificate', 'phone_or_email']);

/** Loans are a ladder, not a list: up to two advisors, the best lender, then legal help. */
const LOAN_LADDER: [step: 1 | 2 | 3, take: number][] = [
  [1, 2],
  [2, 1],
  [3, 1],
];

function pickSteps(need: string, items: MatchItem[]): MatchItem[] {
  const usable = items.filter(i => i.status !== 'not_a_fit');
  if (need !== 'loan') return usable.slice(0, MAX_STEPS_PER_QUESTION);
  return LOAN_LADDER.flatMap(([step, take]) => usable.filter(i => i.ladder_step === step).slice(0, take));
}

// ---------------------------------------------------------------------------
// Rules planner: deterministic, no API key needed, and the fallback for Claude.
// ---------------------------------------------------------------------------

function factsFor(entry: DirectoryEntry, profile: IntakeProfile): FactUsed[] {
  const facts: FactUsed[] = [];
  if (entry.phone) facts.push({ field: 'phone', value: entry.phone });
  if (entry.address && (!profile.phone_ok || !entry.phone || entry.how_to_access === 'walk-in')) {
    facts.push({ field: 'address', value: entry.address });
  }
  if (entry.hours) facts.push({ field: 'hours', value: entry.hours });
  return facts;
}

function todayAction(entry: DirectoryEntry, profile: IntakeProfile): string {
  const inPersonFirst = !profile.phone_ok && entry.address && !entry.warnings.includes('referral_only');
  if (inPersonFirst) return `Go in person to ${entry.address}.`;
  if (entry.warnings.includes('referral_only')) {
    return entry.phone
      ? `Call ${entry.phone} and ask for a referral. Do not go to the address without one.`
      : 'Ask your case worker to request a referral. Do not go to the address without one.';
  }
  if (entry.phone) return `Call ${entry.phone}.`;
  if (entry.address) return `Go in person to ${entry.address}.`;
  return 'Ask your case worker how to reach this program.';
}

function whyThis(item: MatchItem): string {
  const meets = item.checks.filter(c => c.outcome === 'meets').map(c => c.detail);
  const lead = item.status === 'likely_fit' ? 'Likely a fit. Not a promise.' : 'Maybe: ask first.';
  if (meets.length === 0) return `${lead} No eligibility limits block this based on the intake.`;
  return `${lead} ${meets.join(' ')}`;
}

function stepFor(item: MatchItem, order: number, ctx: PlannerContext): PlanStep | null {
  const entry = getDirectoryEntry(item.resource_id, ctx.now);
  if (!entry) return null;
  return {
    order,
    resource_id: entry.id,
    why_this: whyThis(item),
    what_to_do_today: todayAction(entry, ctx.profile),
    facts_used: factsFor(entry, ctx.profile),
    unknowns_to_ask: [
      ...item.checks.filter(c => c.outcome === 'unknown').map(c => c.detail),
      ...(entry.hours ? [] : ['Hours: not stated by source. Ask when you call.']),
    ],
    warnings: entry.warnings.map(w => WARNING_TEXT[w]),
  };
}

export function planWithRules(ctx: PlannerContext): PlanOutput {
  const questions: PlanQuestion[] = [];
  const ordering_notes: string[] = [];

  // A listing appears once, under the first question that uses it.
  const used = new Set<string>();

  const missing = ctx.blockers.filter(b => b.has === 'no' && b.unblockers.length > 0 && PLAN_FIRST_BLOCKERS.has(b.id));
  if (missing.length) {
    const steps: PlanStep[] = [];
    for (const blocker of missing) {
      for (const u of blocker.unblockers) {
        const entry = getDirectoryEntry(u.resource_id, ctx.now);
        if (!entry || used.has(entry.id)) continue;
        used.add(entry.id);
        steps.push({
          order: steps.length + 1,
          resource_id: entry.id,
          why_this: `Unblocks: ${blocker.label}. ${u.note}`,
          what_to_do_today: todayAction(entry, ctx.profile),
          facts_used: factsFor(entry, ctx.profile),
          unknowns_to_ask: [...blocker.unknowns, ...(entry.hours ? [] : ['Hours: not stated by source. Ask when you call.'])],
          warnings: entry.warnings.map(w => WARNING_TEXT[w]),
        });
      }
    }
    questions.push({ question: 'prerequisites', steps, gaps: [] });
    if (missing.some(b => b.id === 'ca_id')) {
      ordering_notes.push('Get the no-fee ID first: General Relief and several other programs need ID.');
    }
  }

  for (const need of ctx.matches.needs) {
    const usable = pickSteps(need.need, need.items.filter(i => !used.has(i.resource_id)));
    usable.forEach(i => used.add(i.resource_id));
    const steps = usable.map((item, i) => stepFor(item, i + 1, ctx)).filter((s): s is PlanStep => s !== null);
    const gaps = ctx.gaps.filter(g => g.needs.includes(need.need)).map(g => g.text);
    if (need.no_sure_door) {
      gaps.unshift('No sure door: no high-confidence listing fits this question. Talk it through with the case manager.');
    }
    questions.push({ question: need.need, steps, gaps });
    if (need.need === 'loan') {
      ordering_notes.push('Advising first. Every lender listed has a barrier a client leaving care is likely to hit.');
    }
  }

  const lookup = ctx.matches.program_lookup;
  if (lookup) {
    const steps: PlanStep[] = [];
    for (const m of lookup.matches.slice(0, MAX_STEPS_PER_QUESTION)) {
      const entry = getDirectoryEntry(m.resource_id, ctx.now);
      if (!entry || used.has(entry.id)) continue;
      used.add(entry.id);
      steps.push({
        order: steps.length + 1,
        resource_id: entry.id,
        why_this: `Possible match for "${lookup.query}" (matched on ${m.matched_on.join(', ')}). ${lookup.caveat}`,
        what_to_do_today: todayAction(entry, ctx.profile),
        facts_used: factsFor(entry, ctx.profile),
        unknowns_to_ask: ['Whether this is the program the client heard about.', ...(entry.hours ? [] : ['Hours: not stated by source. Ask when you call.'])],
        warnings: entry.warnings.map(w => WARNING_TEXT[w]),
      });
    }
    questions.push({ question: 'program_lookup', steps, gaps: [lookup.caveat] });
  }

  return { questions, ordering_notes };
}

// ---------------------------------------------------------------------------
// Claude planner: a reasoning agent with three read-only tools.
// ---------------------------------------------------------------------------

const SYSTEM = `You plan next steps for a client of Illumination Health + Home (IHH) who is leaving recuperative care in Orange County. A case worker reviews your plan before the client sees anything.

Hard rules:
- Use only resource ids from the allowed list. Never invent a program.
- Eligibility is already decided by code. Do not re-decide it; explain the check results you were given.
- Every phone number, address, hour or website you mention must be copied verbatim into facts_used from a record you looked up with get_record, naming the field it came from. If a field is null, write "unknown" in unknowns_to_ask instead of a value.
- Put blockers first (for example: ID before General Relief). For loans, advising comes before lenders.
- State gaps honestly. Do not stretch a weak or low-confidence match into a promise. Never write "you qualify".
- No medical, legal or immigration advice. Legal help may be listed as a service only.
- Write for the case worker in plain English. The Writer turns your plan into the client's language later.`;

/** What Claude sees of the intake (architecture 4.6): no id, and none of the client's own words. */
export function deidentify(profile: IntakeProfile): Omit<IntakeProfile, 'id' | 'client_words'> {
  // client_words stays behind: it is read only by the safety gate.
  const copy: Partial<IntakeProfile> = { ...profile };
  delete copy.id;
  delete copy.client_words;
  return copy as Omit<IntakeProfile, 'id' | 'client_words'>;
}

function matcherSummary(matches: MatchOutput) {
  return {
    needs: matches.needs.map(n => ({
      need: n.need,
      no_sure_door: n.no_sure_door,
      items: n.items.map(i => ({
        resource_id: i.resource_id,
        name: i.name,
        status: i.status,
        confidence: i.confidence,
        verified_date: i.verified_date,
        warnings: i.warnings,
        ladder_step: i.ladder_step,
        checks: i.checks,
      })),
    })),
    program_lookup: matches.program_lookup,
  };
}

export async function planWithClaude(ctx: PlannerContext): Promise<PlanOutput> {
  const client = getClient();
  if (!client) throw new Error('Planner: ANTHROPIC_API_KEY is not set.');

  const allowed = new Set(ctx.allowedIds);

  const getRecord = betaZodTool({
    name: 'get_record',
    description: 'Look up one directory record by resource_id. Returns its fields (phone, address, hours, notes, etc.), warnings and the latest staff verification. Only allowed ids are returned.',
    inputSchema: z.object({ resource_id: z.string() }),
    run: async ({ resource_id }) => {
      if (!allowed.has(resource_id)) return JSON.stringify({ error: `"${resource_id}" is not in the allowed list.` });
      const entry = getDirectoryEntry(resource_id, ctx.now);
      if (!entry) return JSON.stringify({ error: `No record "${resource_id}".` });
      return JSON.stringify(withoutRules(entry));
    },
  });

  const getPrerequisites = betaZodTool({
    name: 'get_prerequisites',
    description: "Blockers the client lacks or hasn't confirmed (ID, birth certificate, phone, bank account, mailing address): what each blocks and which listing unblocks it.",
    inputSchema: z.object({}),
    run: async () => JSON.stringify(ctx.blockers),
  });

  const readGapRegister = betaZodTool({
    name: 'read_gap_register',
    description: 'Known holes in the directory and IHH internal slots that are still unknown, for the needs in this session.',
    inputSchema: z.object({}),
    run: async () => JSON.stringify(ctx.gaps),
  });

  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'medium', format: betaZodOutputFormat(PlanOutputSchema) },
    ...FALLBACK_PARAMS,
    system: SYSTEM,
    tools: [getRecord, getPrerequisites, readGapRegister],
    max_iterations: 12,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          profile: deidentify(ctx.profile),
          allowed_resource_ids: ctx.allowedIds,
          matcher_results: matcherSummary(ctx.matches),
          instructions:
            'Plan one question per need in matcher_results, plus a "prerequisites" question if blockers need unblocking first, plus "program_lookup" if program_lookup is present. Look up each record you cite.',
        }),
      },
    ],
  });

  const final = await runner.done();
  return parseFinalJson(final, PlanOutputSchema, 'Planner');
}
