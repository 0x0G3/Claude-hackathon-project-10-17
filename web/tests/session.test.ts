import { describe, it, expect, vi } from 'vitest';
import { runSession, Planner, Writer } from '@/lib/session/run';
import { planWithRules, deidentify } from '@/lib/ai/planner';
import { writeWithRules } from '@/lib/ai/writer';
import { getScenarioProfile } from '@/lib/resources/loader';
import { ClientPlan } from '@/types';

const NOW = new Date('2026-10-17T12:00:00Z');
const ray = () => getScenarioProfile('C01')!;
const claudeEngine = { planner: 'claude', writer: 'claude' } as const;

const rulesPlanner: Planner = async ctx => planWithRules(ctx);
const invent = (plan: ClientPlan): ClientPlan => ({
  ...plan,
  lines: [...plan.lines, { when: 'today', resource_id: null, text: 'Or call (714) 555-0199 any time.' }],
});

describe('Session runner: Claude stays inside the guard rails', () => {
  it('a Writer that invents a phone number gets one retry with the failures, then passes', async () => {
    const writer = vi.fn<Writer>(async (plan, ctx, feedback) => {
      const good = writeWithRules(plan, ctx);
      return feedback.length === 0 ? invent(good) : good;
    });
    const r = await runSession(ray(), { planner: rulesPlanner, writer, engine: claudeEngine, now: NOW });
    expect(r.status).toBe('ok');
    expect(r.fact_check.writer_attempts).toBe(2);
    expect(writer.mock.calls[1][2].join(' ')).toMatch(/555-0199/);
  });

  it('a Writer that keeps inventing facts ends in "could not generate safely" with no plan shown', async () => {
    const writer: Writer = async (plan, ctx) => invent(writeWithRules(plan, ctx));
    const r = await runSession(ray(), { planner: rulesPlanner, writer, engine: claudeEngine, now: NOW });
    expect(r.status).toBe('could_not_generate_safely');
    expect(r.client_plan).toBeNull();
    expect(r.fact_check.writer_attempts).toBe(2);
    expect(r.fact_check.problems.join(' ')).toMatch(/555-0199/);
    // The matches stay visible so the case worker can still work from them.
    expect(r.matches?.needs.length).toBeGreaterThan(0);
  });

  it('a Planner that cites a ruled-out listing is replaced by the rules planner', async () => {
    const planner: Planner = async ctx => {
      const plan = planWithRules(ctx);
      plan.questions[0].steps[0].resource_id = 'bridges-at-kraemer-place';
      return plan;
    };
    const r = await runSession(ray(), { planner, writer: async (p, c) => writeWithRules(p, c), engine: claudeEngine, now: NOW });
    expect(r.fact_check.planner_rejected.join(' ')).toMatch(/ruled out/);
    expect(r.engine.planner).toBe('rules');
    expect(r.status).toBe('ok');
    expect(r.plan!.questions.flatMap(q => q.steps.map(s => s.resource_id))).not.toContain('bridges-at-kraemer-place');
  });

  it('API failures fall back to the rules engine instead of failing the session', async () => {
    const r = await runSession(ray(), {
      planner: async () => { throw new Error('network down'); },
      writer: async () => { throw new Error('network down'); },
      engine: claudeEngine,
      now: NOW,
    });
    expect(r.status).toBe('ok');
    expect(r.engine).toEqual({ planner: 'rules', writer: 'rules' });
  });

  it('a safety stop never reaches the Planner or Writer', async () => {
    const planner = vi.fn<Planner>(rulesPlanner);
    const r = await runSession(getScenarioProfile('C10')!, { planner, now: NOW });
    expect(r.status).toBe('stopped_by_safety');
    expect(planner).not.toHaveBeenCalled();
    expect(r.matches).toBeNull();
  });

  it('Claude never sees the client’s own words or the scenario id', () => {
    const sent = JSON.stringify(deidentify(ray()));
    expect(sent).not.toContain('under the bridge');
    expect(sent).not.toContain('C01');
  });
});
