import Anthropic from '@anthropic-ai/sdk';
import { ActionPlan, EvidenceReference } from '@/types';
import { getResourceById } from '@/lib/resources/loader';

export interface ActionPlanParams {
  clientId: string;
  clientSummary: string;
  matchedResourceIds: string[];
  needs: string[];
  constraints: string[];
  useAi?: boolean;
}

export function generateDeterministicActionPlan(params: ActionPlanParams): ActionPlan {
  const { clientId, matchedResourceIds } = params;

  const clientNextSteps: string[] = [];
  const staffChecklist: string[] = [];
  const sourceRefs: EvidenceReference[] = [];
  const unverified: string[] = [];

  for (const id of matchedResourceIds) {
    const res = getResourceById(id);
    if (res) {
      sourceRefs.push({
        resource_id: res.id,
        resource_name: res.name,
        source_url: res.source_url,
        source_quote: res.source_quote,
        verified_date: res.verified_date,
      });

      if (!res.phone && !res.address) {
        unverified.push(`Direct contact coordinates for ${res.name} require 2-1-1 or provider routing.`);
      }
      if (res.confidence !== 'high') {
        unverified.push(`${res.name} hours or eligibility may have changed since verification on ${res.verified_date || 'unknown date'}.`);
      }
    }
  }

  if (clientId.toUpperCase() === 'C01') {
    clientNextSteps.push('Inform recuperative care nurse and case manager that discharge is scheduled for Friday and shelter referral is active.');
    clientNextSteps.push('Keep basic phone charged; expect a callback from 2-1-1 OC or navigation intake staff.');
    clientNextSteps.push('Gather any hospital discharge summaries, Medi-Cal cards, or prescription lists for shelter medical intake.');
    clientNextSteps.push('Confirm with staff that lower bunk and walker accessibility are noted on the bed hold.');

    staffChecklist.push('Submit urgent CalAIM Housing Transition Navigation authorization request.');
    staffChecklist.push('Contact Santa Ana Navigation Center and Coordinated Entry Access Point to request emergency bed reservation.');
    staffChecklist.push('Complete DMV Form DL 932 (Verification for Reduced Fee Identification Card) with client.');
    staffChecklist.push('Arrange accessible transportation (OCTA ACCESS or medical non-emergency van) from recuperative facility to intake.');
  } else {
    clientNextSteps.push('Review the matched options with your program coordinator.');
    clientNextSteps.push('Confirm which programs you feel most comfortable contacting first.');
    clientNextSteps.push('Prepare any existing documents needed for intake.');

    staffChecklist.push('Review client barriers and accessibility requirements.');
    staffChecklist.push('Verify current operating status and bed/service capacity with listed organizations.');
    staffChecklist.push('Schedule follow-up check-in within 48 hours.');
  }

  return {
    client_id: clientId,
    client_next_steps: clientNextSteps,
    staff_checklist: staffChecklist,
    source_references: sourceRefs,
    unverified_requirements: unverified,
    review_required: true, // Always require staff review
    ai_generated: false,
    generated_at: new Date().toISOString(),
  };
}

export async function generateActionPlanWithClaude(
  params: ActionPlanParams
): Promise<ActionPlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Fallback if API key is not present or user did not request AI
  if (!apiKey || !params.useAi) {
    return generateDeterministicActionPlan(params);
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const matchedResources = params.matchedResourceIds
      .map(id => getResourceById(id))
      .filter(Boolean);

    const prompt = `You are an expert case coordinator at Illumination Health + Home (IHH) in Orange County.
Generate a grounded, practical action plan for a fictional client.

CRITICAL RULES:
1. NEVER INVENT PHONE NUMBERS, ADDRESSES, ELIGIBILITY FACTS, OR BED AVAILABILITY.
2. Only reference facts provided in the resource data below. If a detail is missing, state it as "unknown" or "unverified".
3. Mark review_required as true (human staff must always approve placements).
4. Provide structured next steps for the client and a checklist for staff.

Client ID: ${params.clientId}
Summary: ${params.clientSummary}
Needs: ${params.needs.join(', ')}
Constraints: ${params.constraints.join('; ')}

Available Resources:
${JSON.stringify(matchedResources, null, 2)}

Respond with a JSON object matching this schema:
{
  "client_next_steps": ["step 1", "step 2"],
  "staff_checklist": ["task 1", "task 2"],
  "unverified_requirements": ["unverified point 1"]
}`;

    const message = await anthropic.beta.messages.create({
      model: 'claude-sonnet-5-5',
      max_tokens: 16000, // thinking counts toward max_tokens, so leave room beyond the JSON reply
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: 'You are an ethical healthcare and shelter case manager. You output only valid JSON without markdown fences.',
      messages: [{ role: 'user', content: prompt }],
    });

    if (message.stop_reason === 'refusal') {
      console.warn('Claude declined the request; falling back to deterministic plan:', message.stop_details);
      return generateDeterministicActionPlan(params);
    }

    // Responses can start with thinking blocks, so find the text block by type
    const contentBlock = message.content.find(block => block.type === 'text');
    if (contentBlock) {
      const rawText = contentBlock.text.trim();
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);

      const sourceRefs: EvidenceReference[] = matchedResources.map(r => ({
        resource_id: r!.id,
        resource_name: r!.name,
        source_url: r!.source_url,
        source_quote: r!.source_quote,
        verified_date: r!.verified_date,
      }));

      return {
        client_id: params.clientId,
        client_next_steps: parsed.client_next_steps || [],
        staff_checklist: parsed.staff_checklist || [],
        source_references: sourceRefs,
        unverified_requirements: parsed.unverified_requirements || [],
        review_required: true,
        ai_generated: true,
        generated_at: new Date().toISOString(),
      };
    }

    return generateDeterministicActionPlan(params);
  } catch (error) {
    console.error('Claude API call failed; falling back to deterministic plan:', error);
    return generateDeterministicActionPlan(params);
  }
}
