import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Extraction, Resource } from '@/types';
import { ExtractionSchema } from '@/schemas';
import { FALLBACK_PARAMS, MODEL, getClient, parseFinalJson } from '@/lib/ai/client';

/**
 * Extractor (architecture 3b). One pass reads and classifies a changed page: fields with a verbatim
 * quote each, the need it serves, and flags for closures, operator changes, conflicting numbers and
 * hijacked domains. It never fills a field the page does not state.
 */

/** Pages longer than this are sent to staff instead of being cut short. */
const MAX_PAGE_CHARS = 400_000;

const SYSTEM = `You read one web page about a social service in Orange County and report what it states, so a staff member can compare it with the directory record.

Rules:
- For each field you report, copy the exact text from the page that states it into quote. The quote must appear on the page character for character.
- If the page does not state a field, leave that field out. Never guess or fill from the record.
- Flag closures, a change of operator, phone numbers that conflict with each other or with the record, and pages that no longer belong to the organization (hijacked_domain).
- needs: which of sleep, work, loan, travel the service helps with, or other.`;

export async function extractWithClaude(pageText: string, record: Resource): Promise<Extraction> {
  const client = getClient();
  if (!client) throw new Error('Extractor: ANTHROPIC_API_KEY is not set.');
  if (pageText.length > MAX_PAGE_CHARS) throw new Error(`Extractor: page is ${pageText.length} characters; send it to staff to check by hand.`);

  const message = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low', format: betaZodOutputFormat(ExtractionSchema) },
    ...FALLBACK_PARAMS,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          current_record: { name: record.name, organization: record.organization, phone: record.phone, address: record.address, hours: record.hours, website: record.website },
          page_text: pageText,
        }),
      },
    ],
  });
  return parseFinalJson(message, ExtractionSchema, 'Extractor');
}

const PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/g;
const CLOSURE = /\b(permanently closed|has closed|no longer (operating|open|accepting|available)|ceased operations|program (has )?ended)\b/i;
const NAME_STOPWORDS = new Set(['the', 'and', 'for', 'of', 'orange', 'county', 'center', 'program', 'services', 'help', 'free']);

function lineAround(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? undefined : end).trim().slice(0, 240);
}

/** No-API-key extractor: phone numbers, closure wording and a name check, each with its quote. */
export function extractWithRules(pageText: string, record: Resource): Extraction {
  const fields: Extraction['fields'] = [];
  const seen = new Set<string>();
  for (const m of pageText.matchAll(PHONE)) {
    if (seen.has(m[0]) || fields.length >= 5) continue;
    seen.add(m[0]);
    fields.push({ field: 'phone', value: m[0], quote: lineAround(pageText, m.index ?? 0) });
  }

  const flags: Extraction['flags'] = [];
  const closure = CLOSURE.exec(pageText);
  if (closure) flags.push({ kind: 'closure', quote: lineAround(pageText, closure.index), note: 'The page uses closure wording. Confirm by phone.' });

  const nameWords = `${record.name} ${record.organization}`
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(w => w.length > 3 && !NAME_STOPWORDS.has(w));
  const lower = pageText.toLowerCase();
  if (nameWords.length > 0 && !nameWords.some(w => lower.includes(w))) {
    flags.push({ kind: 'hijacked_domain', quote: pageText.slice(0, 160), note: "The page never names the organization. The domain may have changed hands." });
  }

  return { fields, needs: [], flags };
}
