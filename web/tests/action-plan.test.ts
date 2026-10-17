import { describe, it, expect } from 'vitest';
import { generateDeterministicActionPlan } from '@/lib/ai/claude';

describe('Action Plan Fallback Engine', () => {
  it('generates a complete structured action plan without Anthropic API key', () => {
    const plan = generateDeterministicActionPlan({
      clientId: 'C01',
      clientSummary: 'Ray, 62. Recuperative care discharge.',
      matchedResourceIds: ['211-orange-county', 'oc-coordinated-entry-system'],
      needs: ['shelter', 'id-documents'],
      constraints: ['Uses walker', 'No ID'],
      useAi: false,
    });

    expect(plan.client_id).toBe('C01');
    expect(plan.client_next_steps.length).toBeGreaterThan(0);
    expect(plan.staff_checklist.length).toBeGreaterThan(0);
    expect(plan.review_required).toBe(true);
    expect(plan.ai_generated).toBe(false);
    expect(plan.source_references.length).toBe(2);
  });

  it('includes CalAIM and DMV assistance in C01 staff checklist', () => {
    const plan = generateDeterministicActionPlan({
      clientId: 'C01',
      clientSummary: 'Ray, 62',
      matchedResourceIds: ['211-orange-county'],
      needs: ['shelter', 'id-documents'],
      constraints: ['Uses walker'],
    });

    const checklistText = plan.staff_checklist.join(' ');
    expect(checklistText).toContain('CalAIM');
    expect(checklistText).toContain('DMV');
  });
});
