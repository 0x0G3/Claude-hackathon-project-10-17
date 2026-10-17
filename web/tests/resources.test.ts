import { describe, it, expect } from 'vitest';
import { getAllResources, filterResources, getResourceById } from '@/lib/resources/loader';
import { ResourceSchema } from '@/schemas';

describe('Resource Catalog and Data Parsing', () => {
  it('loads valid resources from seed data', () => {
    const resources = getAllResources();
    expect(resources.length).toBeGreaterThan(10);

    // Validate the first resource against Zod schema
    const first = resources[0];
    const validation = ResourceSchema.safeParse(first);
    expect(validation.success).toBe(true);
  });

  it('preserves source tracing fields on every resource', () => {
    const resources = getAllResources();
    for (const res of resources) {
      expect(res.id).toBeDefined();
      expect(res.name).toBeDefined();
      expect(res.organization).toBeDefined();
      // Should have verified_date and confidence
      expect(res.verified_date).toBeDefined();
    }
  });

  it('filters resources by category accurately', () => {
    const shelters = filterResources({ category: 'shelter' });
    expect(shelters.length).toBeGreaterThan(0);
    expect(shelters.every(s => s.category === 'shelter' || s.tags.includes('shelter'))).toBe(true);

    const microenterprise = filterResources({ category: 'microenterprise' });
    expect(microenterprise.length).toBeGreaterThan(0);
  });

  it('filters resources by city correctly', () => {
    const santaAna = filterResources({ city: 'Santa Ana' });
    expect(santaAna.length).toBeGreaterThan(0);
    expect(santaAna.every(s => s.city?.toLowerCase().includes('santa ana'))).toBe(true);
  });

  it('suppresses confidential addresses for survivor and domestic violence programs', () => {
    const resources = getAllResources();
    const confidentialPrograms = resources.filter(r => r.is_confidential_address);

    expect(confidentialPrograms.map(p => p.id)).toContain('wiseplace');
    for (const p of confidentialPrograms) {
      expect(p.address).toBeNull();
    }
  });

  it('retrieves individual resource by ID', () => {
    const res = getResourceById('211-orange-county');
    expect(res).toBeDefined();
    expect(res?.name).toContain('211 Orange County');
  });
});
