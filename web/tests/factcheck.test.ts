import { describe, it, expect } from 'vitest';
import { checkClientPlan, checkPlan, scanText } from '@/lib/factcheck/checker';
import { getResourceById } from '@/lib/resources/loader';
import { ClientPlan, PlanOutput } from '@/types';

function plan(lines: string[], resource_id: string | null = 'yale-navigation-center'): ClientPlan {
  return { language: 'en', lines: lines.map(text => ({ when: 'today', resource_id, text })), english_lines: [] };
}

const YALE = ['yale-navigation-center'];

describe('Fact checker (QC step #2)', () => {
  it('passes a phone, address and hours copied from the cited record', () => {
    const problems = checkClientPlan(
      plan(['Call (800) 364-2221 and ask for a referral. The center is at 2229 S. Yale St., Santa Ana.']),
      YALE
    );
    expect(problems).toEqual([]);
  });

  it('accepts the same digits written another way, but not a made-up number', () => {
    expect(checkClientPlan(plan(['Call 800-364-2221.']), YALE)).toEqual([]);
    expect(checkClientPlan(plan(['Call (714) 555-0199.']), YALE)).toHaveLength(1);
  });

  it('accepts a phone number that appears only in the record’s notes (a known alternate)', () => {
    expect(checkClientPlan(plan(['Or call 714-785-9889.']), YALE)).toEqual([]);
  });

  it('rejects an address that is not in any cited record', () => {
    const problems = checkClientPlan(plan(['Go to 100 Main Street.']), YALE);
    expect(problems.join(' ')).toMatch(/address "100 Main Street/);
  });

  it('rejects an hour that is not in the cited record', () => {
    const problems = scanText('Open 9 a.m. to 3 p.m.', [getResourceById('chrysalis-orange-county')!], 'x');
    expect(problems.join(' ')).toMatch(/3 p\.m\./);
  });

  it('matches times regardless of spacing and dots', () => {
    expect(scanText('Open 8am to 12pm.', [getResourceById('chrysalis-orange-county')!], 'x')).toEqual([]);
  });

  it('allows the universal 9-1-1, 2-1-1 and 7-1-1 numbers', () => {
    expect(checkClientPlan(plan(['Call 9-1-1 in an emergency. Use 7-1-1 relay.'], null), [])).toEqual([]);
  });

  it('blocks eligibility promises and medicine advice, in English and Spanish', () => {
    expect(checkClientPlan(plan(['You qualify for this shelter.']), YALE).join(' ')).toMatch(/promises eligibility/);
    expect(checkClientPlan(plan(['Usted califica para este programa.']), YALE).join(' ')).toMatch(/promises eligibility/);
    expect(checkClientPlan(plan(['You can stop taking your pills.'], null), []).join(' ')).toMatch(/medicine advice/);
  });

  it('rejects a line that cites a resource outside the approved plan', () => {
    const problems = checkClientPlan(plan(['Call them.'], 'bridges-at-kraemer-place'), YALE);
    expect(problems.join(' ')).toMatch(/not in the approved plan/);
  });

  describe('Planner output', () => {
    const step = (patch: Partial<PlanOutput['questions'][number]['steps'][number]>) => ({
      questions: [
        {
          question: 'sleep',
          gaps: [],
          steps: [
            {
              order: 1,
              resource_id: 'yale-navigation-center',
              why_this: 'Central SPA.',
              what_to_do_today: 'Call for a referral.',
              facts_used: [{ field: 'phone', value: '(800) 364-2221' }],
              unknowns_to_ask: [],
              warnings: [],
              ...patch,
            },
          ],
        },
      ],
      ordering_notes: [],
    });

    it('accepts facts copied verbatim from the named field', () => {
      expect(checkPlan(step({}), YALE)).toEqual([]);
    });

    it('rejects a fact that is not in the named field', () => {
      expect(checkPlan(step({ facts_used: [{ field: 'phone', value: '(800) 364-9999' }] }), YALE)).toHaveLength(1);
      expect(checkPlan(step({ facts_used: [{ field: 'hours', value: '24/7' }] }), YALE)).toHaveLength(1);
    });

    it('rejects a resource that does not exist or was ruled out', () => {
      expect(checkPlan(step({ resource_id: 'made-up-shelter' }), YALE).join(' ')).toMatch(/does not exist/);
      expect(checkPlan(step({ resource_id: 'bridges-at-kraemer-place', facts_used: [] }), YALE).join(' ')).toMatch(/ruled out/);
    });

    it('rejects a confidential address even if Claude somehow had it', () => {
      // WISEPlace has no address in the seed; any address cited for it must fail.
      const problems = checkPlan(step({ resource_id: 'wiseplace', facts_used: [{ field: 'address', value: '1411 N Broadway' }] }), ['wiseplace']);
      expect(problems).toHaveLength(1);
    });
  });
});
