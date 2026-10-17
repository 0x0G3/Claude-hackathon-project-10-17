import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';

/** Model named in the architecture (4.6): fast enough for a live demo. */
export const MODEL = 'claude-sonnet-5-5';

/** Server-side refusal fallback, routed by refusal category; no model list to maintain. */
export const FALLBACK_PARAMS: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: 'default' } = {
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
};

/** API key comes from the environment only, never from git. Null means: use the rules engine. */
export function getClient(): Anthropic | null {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
}

/** The text of the final message, validated against `schema`. Throws on refusal, truncation or bad JSON. */
export function parseFinalJson<T>(message: Anthropic.Beta.BetaMessage, schema: z.ZodType<T>, label: string): T {
  if (message.stop_reason === 'refusal') throw new Error(`${label}: Claude declined the request.`);
  if (message.stop_reason === 'max_tokens') throw new Error(`${label}: reply was cut off at max_tokens.`);
  const text = message.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text');
  if (!text) throw new Error(`${label}: reply had no text block.`);
  const parsed = schema.safeParse(JSON.parse(text.text));
  if (!parsed.success) throw new Error(`${label}: reply did not match the schema: ${parsed.error.message}`);
  return parsed.data;
}
