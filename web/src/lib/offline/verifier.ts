import { Extraction, RecheckProposal, RecheckResult, Resource } from '@/types';
import { digits } from '@/lib/factcheck/checker';

/**
 * Verifier (architecture 3b). Plain code: every quote must appear verbatim in the snapshot,
 * phone numbers must look like phone numbers, and each value is diffed against the record.
 * It never approves anything; a person does.
 */

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function phoneFormatOk(value: string): boolean {
  const d = digits(value);
  return d.length === 10 || (d.length === 11 && d.startsWith('1')) || /^\d-\d-\d$/.test(value.trim());
}

function isChange(field: RecheckProposal['field'], proposed: string, record: Resource): boolean {
  const current = record[field];
  if (field === 'phone') {
    // A number already in the record's phone or notes (a known alternate) is not news.
    const known = digits(`${record.phone ?? ''} ${record.notes ?? ''}`);
    return !known.includes(digits(proposed).replace(/^1(?=\d{10}$)/, ''));
  }
  return !current || !norm(current).includes(norm(proposed));
}

export function verifyExtraction(extraction: Extraction, snapshot: string, record: Resource): Pick<RecheckResult, 'proposals' | 'flags'> {
  const page = norm(snapshot);
  const proposals = extraction.fields
    .filter(f => f.value.trim().toLowerCase() !== 'unknown')
    .map(f => ({
      field: f.field,
      current: record[f.field],
      proposed: f.value,
      quote: f.quote,
      quote_found: f.quote.trim().length > 0 && page.includes(norm(f.quote)),
      format_ok: f.field === 'phone' ? phoneFormatOk(f.value) : true,
      changed: isChange(f.field, f.value, record),
    }));
  const flags = extraction.flags.map(f => ({ ...f, quote_found: page.includes(norm(f.quote)) }));
  return { proposals, flags };
}
