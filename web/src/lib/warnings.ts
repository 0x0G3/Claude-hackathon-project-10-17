import { Warning } from '@/types';

/** Plain wording for derived warnings (architecture 4.3). Safe to import in the browser. */
export const WARNING_TEXT: Record<Warning, string> = {
  stale: 'Checked more than 30 days ago.',
  conflict: 'Sources disagree on a detail (see notes).',
  referral_only: 'Referral only: do not send the client to this address without a referral.',
  low_confidence: 'Low confidence: may not operate as listed. Never the main door.',
  confidential_location: 'Confidential location: no address is shown.',
  staff_reported_problem: 'A case worker reported a problem with this listing.',
};
