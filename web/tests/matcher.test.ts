import { describe, it, expect } from 'vitest';
import { matchProfile, evaluateRules, citableIds } from '@/lib/matching/engine';
import { getRulesFor, getScenarioProfile } from '@/lib/resources/loader';
import { IntakeProfile, MatchOutput } from '@/types';

const NOW = new Date('2026-10-17T12:00:00Z');

function scenario(id: string, patch: Partial<IntakeProfile> = {}): IntakeProfile {
  return { ...getScenarioProfile(id)!, ...patch };
}

function item(out: MatchOutput, need: string, id: string) {
  const found = out.needs.find(n => n.need === need)?.items.find(i => i.resource_id === id);
  if (!found) throw new Error(`${id} not listed under ${need}`);
  return found;
}

describe('Eligibility matcher (plain code)', () => {
  it('every check is meets, does not meet, or unknown', () => {
    const out = matchProfile(scenario('C01'), NOW);
    for (const n of out.needs) for (const i of n.items) for (const c of i.checks) {
      expect(['meets', 'does_not_meet', 'unknown']).toContain(c.outcome);
    }
  });

  it('C01 Ray: Central SPA shelter and CES are open; other SPAs and city-ties shelters are not', () => {
    const out = matchProfile(scenario('C01'), NOW);
    expect(item(out, 'sleep', 'oc-coordinated-entry-system').status).toBe('likely_fit');
    expect(item(out, 'sleep', 'yale-navigation-center').status).toBe('likely_fit');
    expect(item(out, 'sleep', 'caloptima-health-calaim').status).toBe('likely_fit');
    expect(item(out, 'sleep', 'bridges-at-kraemer-place').status).toBe('not_a_fit');
    expect(item(out, 'sleep', 'costa-mesa-bridge-shelter').status).toBe('not_a_fit');
  });

  it('C01 Ray: Huntington Beach’s daily-living rule is flagged, not decided', () => {
    const hb = item(matchProfile(scenario('C01'), NOW), 'sleep', 'huntington-beach-navigation-center');
    const adl = hb.checks.find(c => c.rule === 'daily living')!;
    expect(adl.outcome).toBe('unknown');
    expect(adl.detail).toMatch(/mobility device/);
  });

  it('a "not a fit" listing keeps its reason so a case worker can override a wrong rule', () => {
    const cm = item(matchProfile(scenario('C01'), NOW), 'sleep', 'costa-mesa-bridge-shelter');
    expect(cm.checks.find(c => c.outcome === 'does_not_meet')!.detail).toMatch(/Costa Mesa/);
  });

  it('no ties recorded means ask, not rule out', () => {
    const cm = item(matchProfile(scenario('C01', { city_ties: [] }), NOW), 'sleep', 'costa-mesa-bridge-shelter');
    expect(cm.status).toBe('maybe');
  });

  it('a low-confidence listing is never a likely fit, even with no failed checks', () => {
    const out = matchProfile(scenario('C03'), NOW);
    expect(item(out, 'travel', 'costa-mesa-reconnection-program').status).toBe('maybe');
    expect(out.needs.find(n => n.need === 'travel')!.no_sure_door).toBe(true);
  });

  it('age rules: Home Free (12–21) is out for 29 and 23, in for 18–21', () => {
    expect(item(matchProfile(scenario('C03'), NOW), 'travel', 'home-free-national-runaway-safeline').status).toBe('not_a_fit');
    const young = scenario('C03', { age_band: '18_21' });
    expect(item(matchProfile(young, NOW), 'travel', 'home-free-national-runaway-safeline').status).toBe('likely_fit');
    const jas = scenario('C08', { questions: ['travel'], travel: { destination: null, host_confirmed: 'yes' } });
    expect(item(matchProfile(jas, NOW), 'travel', 'home-free-national-runaway-safeline').status).toBe('not_a_fit');
  });

  it('OCTA reduced fare: qualifies with 60+ or a disability; unknown otherwise', () => {
    const rules = getRulesFor('octa-reduced-fares')!;
    const group = (p: IntakeProfile) => evaluateRules(rules, p).find(c => c.rule === 'qualifying group')!.outcome;
    expect(group(scenario('C07'))).toBe('unknown');
    expect(group(scenario('C07', { disability: 'no' }))).toBe('does_not_meet');
    expect(group(scenario('C07', { age_band: '62_plus', disability: 'no' }))).toBe('meets');
    expect(group(scenario('C07', { disability: 'yes' }))).toBe('meets');
  });

  it('C02 Marisol: loans rank advising before lenders, and JFLA’s residence rule rules it out', () => {
    const out = matchProfile(scenario('C02'), NOW);
    const loan = out.needs.find(n => n.need === 'loan')!;
    expect(item(out, 'loan', 'jfla-zero-interest-loans').status).toBe('not_a_fit');
    // Within each fit status, the ladder order holds: advising (1), lenders (2), legal help (3).
    for (const status of ['likely_fit', 'maybe'] as const) {
      const steps = loan.items.filter(i => i.status === status).map(i => i.ladder_step ?? 9);
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
    }
  });

  it('a blocker the source is silent on comes back unknown, never assumed', () => {
    const accessity = item(matchProfile(scenario('C02'), NOW), 'loan', 'accessity-small-business-loans');
    expect(accessity.checks.find(c => c.rule === 'bank account')!.outcome).toBe('unknown');
  });

  it('C12 Sam: the program lookup finds the deposit programs, with the caveat', () => {
    const out = matchProfile(scenario('C12'), NOW);
    expect(out.program_lookup!.matches.map(m => m.resource_id)).toEqual(expect.arrayContaining(['wiseplace', 'caloptima-health-calaim']));
    expect(out.program_lookup!.caveat).toMatch(/can't confirm/);
  });

  it('only listings that were not ruled out can be cited by the Planner', () => {
    const out = matchProfile(scenario('C01'), NOW);
    const ids = citableIds(out);
    expect(ids).toContain('yale-navigation-center');
    expect(ids).not.toContain('bridges-at-kraemer-place');
  });
});
