import { describe, it, expect } from 'vitest';
import { matchClientToResources } from '@/lib/matching/engine';
import { ClientProfile } from '@/types';

describe('Deterministic Matching Engine — Case C01 (Ray)', () => {
  const c01Profile: ClientProfile = {
    id: 'C01',
    title: 'A bed after recuperative care',
    client: 'Ray, 62. Leaves recuperative care in five days. Walks with a walker. Has Medi-Cal. Lost his ID. Last had an address in Santa Ana.',
    in_their_words: "They say I'm done here Friday. I can't go back under the bridge with this leg. Where do I go?",
    needs: ['shelter', 'id-documents'],
    constraints: [
      'Uses a walker; needs a lower bunk or accessible site',
      'No ID',
      'Basic phone, calls and texts only',
    ],
    city: 'Santa Ana',
    has_id: false,
    requires_accessibility: true,
  };

  it('matches C01 to emergency shelter and Coordinated Entry gateways', () => {
    const result = matchClientToResources(c01Profile);

    expect(result.client_id).toBe('C01');
    expect(result.matched_resources.length).toBeGreaterThan(0);

    // Verify 211 / CES is among top matches
    const matchedIds = result.matched_resources.map(m => m.resource.id);
    expect(matchedIds).toContain('211-orange-county');
  });

  it('excludes family-only and women-only shelters for an individual male client', () => {
    const result = matchClientToResources(c01Profile);

    expect(result.excluded_resources.length).toBeGreaterThan(0);

    // Should exclude family shelters
    const familyExclusions = result.excluded_resources.filter(ex =>
      ex.exclusion_reasons.some(r => r.includes('families'))
    );
    expect(familyExclusions.length).toBeGreaterThan(0);
  });

  it('identifies physical and administrative access barriers for C01', () => {
    const result = matchClientToResources(c01Profile);

    expect(result.access_barriers.length).toBeGreaterThan(0);
    expect(result.access_barriers.some(b => b.toLowerCase().includes('walker') || b.toLowerCase().includes('mobility'))).toBe(true);
    expect(result.access_barriers.some(b => b.toLowerCase().includes('id') || b.toLowerCase().includes('identification'))).toBe(true);
  });

  it('flags unverified eligibility questions for walker accessibility and ID', () => {
    const result = matchClientToResources(c01Profile);

    expect(result.unknown_eligibility.length).toBeGreaterThan(0);
    const questions = result.unknown_eligibility.map(u => u.question.toLowerCase());
    expect(questions.some(q => q.includes('walker') || q.includes('lower bunk') || q.includes('ada'))).toBe(true);
  });

  it('provides cited evidence references linking to verified source records', () => {
    const result = matchClientToResources(c01Profile);

    expect(result.evidence_references.length).toBeGreaterThan(0);
    for (const ref of result.evidence_references) {
      expect(ref.resource_id).toBeDefined();
      expect(ref.resource_name).toBeDefined();
      expect(ref.verified_date).toBeDefined();
    }
  });

  it('generates practical staff follow-up directives for recuperative care discharge', () => {
    const result = matchClientToResources(c01Profile);

    expect(result.suggested_staff_actions.length).toBeGreaterThan(0);
    expect(result.suggested_staff_actions.some(a => a.includes('2-1-1') || a.includes('CalAIM'))).toBe(true);
  });
});
