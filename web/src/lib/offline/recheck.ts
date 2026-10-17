import { Extraction, RecheckResult } from '@/types';
import { getResourceById } from '@/lib/resources/loader';
import { recheckUrl } from './allowlist';
import { fetchListing } from './fetcher';
import { extractWithClaude, extractWithRules } from './extractor';
import { verifyExtraction } from './verifier';

/**
 * "Re-check this listing" (architecture 3b, hackathon scope): Fetcher → Extractor → Verifier on one
 * seed entry, then a diff for a person to approve. A scheduled crawl is a next step.
 */
export async function recheckListing(resourceId: string, useAi: boolean, now: Date = new Date()): Promise<RecheckResult> {
  const record = getResourceById(resourceId);
  if (!record) throw new Error(`No record "${resourceId}".`);
  const url = recheckUrl(record);
  const base = { resource_id: resourceId, url: url ?? '', fetched_at: now.toISOString() };

  if (!url) {
    return { ...base, allowed: false, refused_reason: 'This record has no source page.', http_status: null, changed_since_last: null, extractor: null, proposals: [], flags: [] };
  }

  const fetched = await fetchListing(resourceId, url, now);
  if (!fetched.ok) {
    return { ...base, allowed: false, refused_reason: fetched.refused_reason, http_status: fetched.http_status, changed_since_last: null, extractor: null, proposals: [], flags: [] };
  }

  let extraction: Extraction;
  let extractor: RecheckResult['extractor'] = 'rules';
  if (useAi) {
    try {
      extraction = await extractWithClaude(fetched.text, record);
      extractor = 'claude';
    } catch (error) {
      console.error('Extractor failed; using the rules extractor:', error);
      extraction = extractWithRules(fetched.text, record);
    }
  } else {
    extraction = extractWithRules(fetched.text, record);
  }

  return {
    ...base,
    url: fetched.final_url ?? url,
    allowed: true,
    refused_reason: null,
    http_status: fetched.http_status,
    changed_since_last: fetched.changed_since_last,
    extractor,
    ...verifyExtraction(extraction, fetched.text, record),
  };
}
