import { describe, it, expect } from 'vitest';
import { getRawResources, getRules, getScenarioProfiles, getTags, getGapRegister } from '@/lib/resources/loader';
import { IntakeProfileSchema } from '@/schemas';

/** QC step #1 (architecture 4.3): rules come only from the source text, and a person still has to approve them. */
describe('Structured eligibility data', () => {
  const records = new Map(getRawResources().map(r => [r.id, r]));

  it('every rule points at a real seed record', () => {
    for (const rule of getRules()) {
      expect(records.has(rule.resource_id), rule.resource_id).toBe(true);
    }
  });

  it('every basis quote appears verbatim in that record’s eligibility or notes', () => {
    for (const rule of getRules()) {
      const r = records.get(rule.resource_id)!;
      const source = `${r.eligibility ?? ''}\n${r.notes ?? ''}`;
      for (const quote of rule.basis) {
        expect(source.includes(quote), `${rule.resource_id}: "${quote}"`).toBe(true);
      }
    }
  });

  it('a rule that restricts anything has at least one quote behind it', () => {
    const restricting = ['age_min', 'age_max', 'requires_city_ties', 'spa', 'households', 'requires_veteran', 'requires_medi_cal', 'requires_adl_independent', 'requires_ca_id', 'requires_permanent_residence', 'qualifies_if_any'] as const;
    for (const rule of getRules()) {
      if (restricting.some(k => rule[k] !== undefined)) {
        expect(rule.basis.length, rule.resource_id).toBeGreaterThan(0);
      }
    }
  });

  it('no rule is marked approved without a reviewer and date', () => {
    for (const rule of getRules()) {
      if (rule.review.status === 'approved') {
        expect(rule.review.by && rule.review.date, rule.resource_id).toBeTruthy();
      }
    }
  });

  it('SPA city lists are copied from the notes of their source records', () => {
    for (const spa of Object.values(getTags().spa)) {
      const notes = records.get(spa.source_resource_id)!.notes ?? '';
      expect(notes).toContain(spa.cities.join(', '));
    }
  });

  it('every other-need extra is backed by a quote from its source record', () => {
    for (const extra of Object.values(getTags().other_need_extras)) {
      expect(records.get(extra.basis_resource_id)!.notes).toContain(extra.basis);
    }
  });

  it('IHH internal slots in the gap register stay unknown until staff fill them in', () => {
    for (const gap of getGapRegister().filter(g => g.kind === 'ihh_internal_slot')) {
      if (gap.filled_by === null) expect(gap.text.toLowerCase()).toContain('unknown');
    }
  });

  it('all 12 scenario profiles are valid intake profiles', () => {
    const profiles = getScenarioProfiles();
    expect(profiles.map(p => p.id)).toEqual(['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12']);
    for (const p of profiles) {
      const parsed = IntakeProfileSchema.safeParse(p);
      expect(parsed.success, `${p.id}: ${parsed.error?.message}`).toBe(true);
    }
  });
});
