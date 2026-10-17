import { ClientPlan, IntakeProfile, PlanOutput, SessionResult } from '@/types';
import { runSafetyGate } from '@/lib/safety/gate';
import { checkPrerequisites, unblockerIds } from '@/lib/prereqs/graph';
import { citableIds, matchProfile } from '@/lib/matching/engine';
import { gapsFor, sessionNeeds, travelChecklist } from '@/lib/gaps/register';
import { checkClientPlan, checkPlan } from '@/lib/factcheck/checker';
import { PlannerContext, planWithClaude, planWithRules } from '@/lib/ai/planner';
import { WriterContext, writeWithClaude, writeWithRules } from '@/lib/ai/writer';
import { getDirectory, getSeedGeneratedDate, withoutRules } from '@/lib/resources/loader';

/**
 * One case worker session through the online path (architecture 3b):
 * intake → safety gate → prerequisites → matcher → Planner → Writer → fact checker.
 * The Planner and Writer are injectable so tests run without the API.
 */

export type Planner = (ctx: PlannerContext) => Promise<PlanOutput>;
export type Writer = (plan: PlanOutput, ctx: WriterContext, feedback: string[]) => Promise<ClientPlan>;

export interface SessionOptions {
  planner?: Planner;
  writer?: Writer;
  engine?: SessionResult['engine'];
  now?: Date;
}

const rulesPlanner: Planner = async ctx => planWithRules(ctx);
const rulesWriter: Writer = async (plan, ctx) => writeWithRules(plan, ctx);

export function claudeOptions(): SessionOptions {
  return { planner: planWithClaude, writer: writeWithClaude, engine: { planner: 'claude', writer: 'claude' } };
}

function citedIds(plan: PlanOutput): string[] {
  return [...new Set(plan.questions.flatMap(q => q.steps.map(s => s.resource_id)))];
}

function recordsFor(ids: string[], now: Date): SessionResult['records'] {
  const wanted = new Set(ids);
  const records: SessionResult['records'] = {};
  for (const entry of getDirectory(now)) {
    if (wanted.has(entry.id)) records[entry.id] = withoutRules(entry);
  }
  return records;
}

export async function runSession(profile: IntakeProfile, options: SessionOptions = {}): Promise<SessionResult> {
  const now = options.now ?? new Date();
  const engine = { ...(options.engine ?? { planner: 'rules', writer: 'rules' }) } as SessionResult['engine'];
  const base = {
    profile_id: profile.id,
    checked_on: getSeedGeneratedDate(),
    generated_at: now.toISOString(),
  };

  // 1. Safety gate runs first. A stop means no search, no plan, no addresses.
  const safety = runSafetyGate(profile);
  if (safety.stop) {
    return {
      ...base,
      status: 'stopped_by_safety',
      safety,
      prerequisites: [],
      matches: null,
      gaps: [],
      travel_steps: null,
      plan: null,
      client_plan: null,
      fact_check: { passed: true, problems: [], writer_attempts: 0, planner_rejected: [] },
      engine: { planner: 'rules', writer: 'rules' },
      // Crisis lines only; never a place.
      records: recordsFor(safety.lines.map(l => l.resource_id).filter((id): id is string => id !== null), now),
    };
  }

  // 2–3. Plain code: blockers and eligibility.
  const prerequisites = checkPrerequisites(profile);
  const matches = matchProfile(profile, now);
  const gaps = gapsFor(sessionNeeds(profile));
  const allowedIds = [...new Set([...citableIds(matches), ...unblockerIds(prerequisites)])];
  const ctx: PlannerContext = { profile, matches, blockers: prerequisites, gaps, allowedIds, now };

  // 4. Planner. If its output cites a fact that isn't in the record, fall back to the rules planner.
  let plan: PlanOutput;
  let plannerRejected: string[] = [];
  try {
    plan = await (options.planner ?? rulesPlanner)(ctx);
    plannerRejected = checkPlan(plan, allowedIds);
  } catch (error) {
    plan = planWithRules(ctx);
    plannerRejected = [error instanceof Error ? error.message : String(error)];
    engine.planner = 'rules';
  }
  if (plannerRejected.length && engine.planner === 'claude') {
    plan = planWithRules(ctx);
    engine.planner = 'rules';
  }
  const ruleProblems = checkPlan(plan, allowedIds);

  // 5–6. Writer, then fact checker: one retry with the failures, then "could not generate safely".
  const writerCtx: WriterContext = { profile };
  let writer = options.writer ?? rulesWriter;
  const cited = citedIds(plan);
  let clientPlan: ClientPlan | null = null;
  let problems: string[] = [...ruleProblems];
  let attempts = 0;

  if (ruleProblems.length === 0) {
    for (attempts = 1; attempts <= 2; attempts++) {
      try {
        clientPlan = await writer(plan, writerCtx, attempts === 1 ? [] : problems);
        problems = checkClientPlan(clientPlan, cited);
      } catch (error) {
        // An API failure (not a fact-check failure): the template writer can still produce a safe plan.
        console.error('Writer failed; using the rules writer:', error);
        writer = rulesWriter;
        engine.writer = 'rules';
        clientPlan = writeWithRules(plan, writerCtx);
        problems = checkClientPlan(clientPlan, cited);
      }
      if (problems.length === 0) break;
    }
    attempts = Math.min(attempts, 2);
  }

  const passed = problems.length === 0 && clientPlan !== null;
  return {
    ...base,
    status: passed ? 'ok' : 'could_not_generate_safely',
    safety,
    prerequisites,
    matches,
    gaps,
    travel_steps: profile.questions.includes('travel') ? travelChecklist(profile, matches) : null,
    plan,
    client_plan: passed ? clientPlan : null,
    fact_check: { passed, problems, writer_attempts: attempts, planner_rejected: plannerRejected },
    engine,
    records: recordsFor(
      [
        ...matches.needs.flatMap(n => n.items.map(i => i.resource_id)),
        ...(matches.program_lookup?.matches.map(m => m.resource_id) ?? []),
        ...prerequisites.flatMap(b => b.unblockers.map(u => u.resource_id)),
      ],
      now
    ),
  };
}
