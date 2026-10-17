import { describe, it, expect, beforeAll } from 'vitest';
import { runSession } from '@/lib/session/run';
import { scanText } from '@/lib/factcheck/checker';
import { getAllResources, getScenarioProfiles } from '@/lib/resources/loader';
import { SessionResult } from '@/types';

/**
 * The 12 made-up scenarios as tests (architecture section 6), run through the whole online path
 * with the rules engine. Run these after every change.
 */

const NOW = new Date('2026-10-17T12:00:00Z');
const results = new Map<string, SessionResult>();

beforeAll(async () => {
  for (const p of getScenarioProfiles()) results.set(p.id, await runSession(p, { now: NOW }));
});

const r = (id: string) => results.get(id)!;
const planText = (id: string) => (r(id).client_plan?.lines ?? []).map(l => l.text).join('\n');
const planIds = (id: string) => r(id).plan?.questions.flatMap(q => q.steps.map(s => s.resource_id)) ?? [];
const status = (id: string, need: string, resource: string) =>
  r(id).matches?.needs.find(n => n.need === need)?.items.find(i => i.resource_id === resource)?.status;

describe('Scenario suite', () => {
  it('fails if any phone number, address or hour appears that is not in the directory', () => {
    const directory = getAllResources();
    for (const [id, result] of results) {
      const lines = [...(result.client_plan?.lines ?? []), ...(result.client_plan?.english_lines ?? [])];
      for (const line of lines) expect(scanText(line.text, directory, id), line.text).toEqual([]);
    }
  });

  it('every non-safety scenario produces a plan that passes the fact checker', () => {
    for (const [id, result] of results) {
      if (result.status === 'stopped_by_safety') continue;
      expect(result.status, `${id}: ${result.fact_check.problems.join('; ')}`).toBe('ok');
    }
  });

  it('C01 Ray: CES and Central SPA path, CalOptima, HB daily-living rule flagged, ID blocker first', () => {
    expect(planIds('C01')).toEqual(expect.arrayContaining(['oc-coordinated-entry-system', 'yale-navigation-center', 'caloptima-health-calaim']));
    const hb = r('C01').matches!.needs[0].items.find(i => i.resource_id === 'huntington-beach-navigation-center')!;
    expect(hb.checks.some(c => c.rule === 'daily living' && c.outcome === 'unknown')).toBe(true);
    expect(r('C01').prerequisites.find(b => b.id === 'ca_id')!.unblockers[0].resource_id).toBe('dmv-no-fee-and-reduced-fee-id');
    expect(r('C01').plan!.questions[0].question).toBe('prerequisites');
  });

  it('C02 Marisol: Spanish plan with English for staff, advising first, never mentions immigration', () => {
    const plan = r('C02').client_plan!;
    expect(plan.language).toBe('es');
    expect(plan.english_lines.length).toBe(plan.lines.length);
    const loanSteps = r('C02').plan!.questions.find(q => q.question === 'loan')!.steps;
    expect(['ocie-sbdc', 'oc-workforce-solutions-business-accelerator']).toContain(loanSteps[0].resource_id);
    expect(planIds('C02')).toContain('public-law-center');
    expect(JSON.stringify(r('C02').plan) + planText('C02')).not.toMatch(/immigra|inmigra/i);
    expect(status('C02', 'loan', 'jfla-zero-interest-loans')).toBe('not_a_fit');
  });

  it('C03 Devon: states the gap honestly, low-confidence options marked, IHH slot unknown, travel checklist', () => {
    expect(r('C03').matches!.needs[0].no_sure_door).toBe(true);
    expect(r('C03').client_plan!.lines[0].text).toMatch(/did not find a sure option/);
    expect(r('C03').gaps.map(g => g.id)).toEqual(expect.arrayContaining(['ihh-travel-home', 'no-adult-reunification-program']));
    expect(r('C03').travel_steps!.map(s => s.id)).toEqual(['host', 'id', 'funding', 'ticket', 'arrival']);
    expect(r('C03').travel_steps!.find(s => s.id === 'funding')!.state).toBe('unknown');
  });

  it('C04 Tanya: Chrysalis, Working Wardrobes and the WORK Center; legal aid as a service only', () => {
    expect(planIds('C04')).toEqual(expect.arrayContaining(['chrysalis-orange-county', 'working-wardrobes-rebuilding-careers', 'santa-ana-work-center-resume-help', 'community-legal-aid-socal']));
    expect(planText('C04')).not.toMatch(/expunge|your record/i);
  });

  it('C05 Walt: Texas birth certificate route is unknown, and the affidavit signer question is flagged', () => {
    const bc = r('C05').prerequisites.find(b => b.id === 'birth_certificate')!;
    expect(bc.unknowns.join(' ')).toMatch(/outside California.*not in the directory/);
    expect(bc.unknowns.join(' ')).toMatch(/Affidavit of Homeless Status: unknown, ask IHH/);
  });

  it('C06 Gloria: in-person options first, with relay for phone numbers', () => {
    expect(r('C06').client_plan!.lines[0].text).toMatch(/^Go in person/);
    expect(planText('C06')).toMatch(/7-1-1/);
  });

  it('C07 Andre: OCTA reduced fare is not assumed, GR bus passes listed, no low-income fare found', () => {
    expect(status('C07', 'transportation', 'octa-reduced-fares')).not.toBe('likely_fit');
    expect(planIds('C07')).toContain('oc-general-relief');
    expect(r('C07').gaps.map(g => g.id)).toContain('low-income-fare');
  });

  it('C08 Jas: LifeLine offered; Home Free (12–21) never offered at 23', () => {
    expect(planIds('C08')).toContain('california-lifeline');
    expect(planIds('C08')).not.toContain('home-free-national-runaway-safeline');
  });

  it('C09 Hank: VA CRRC and the County Veterans Service Office', () => {
    expect(planIds('C09')).toEqual(expect.arrayContaining(['va-crrc-santa-ana', 'oc-veterans-service-office']));
  });

  it('C10 Lena: safety gate fires; no places, no plan, no printout', () => {
    expect(r('C10').status).toBe('stopped_by_safety');
    expect(r('C10').safety.route).toBe('danger');
    expect(r('C10').matches).toBeNull();
    expect(r('C10').client_plan).toBeNull();
    expect(r('C10').records).toEqual({});
  });

  it('C11 Bob: refuses the medicine question and points to the care team', () => {
    expect(r('C11').safety.route).toBe('medical');
    expect(r('C11').safety.message).toMatch(/nurse or care team/);
    expect(r('C11').plan).toBeNull();
  });

  it('C12 Sam: WISEPlace and CalOptima as possible matches, with the "can’t confirm" caveat', () => {
    const lookup = r('C12').matches!.program_lookup!;
    expect(lookup.matches.map(m => m.resource_id)).toEqual(expect.arrayContaining(['wiseplace', 'caloptima-health-calaim']));
    expect(lookup.matches.every(m => m.verified_date && m.confidence)).toBe(true);
    expect(lookup.caveat).toMatch(/can't confirm/);
    expect(planText('C12')).toMatch(/may not be the program you heard about/);
  });
});
