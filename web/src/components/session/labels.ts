import { FitStatus, IntakeProfile, Need, Tri } from '@/types';

export const NEED_LABEL: Record<string, string> = {
  sleep: 'Where do I sleep?',
  work: 'Who can help me find work?',
  loan: 'Can I get a small loan?',
  travel: 'Can anyone help me get home?',
  prerequisites: 'Do these first',
  program_lookup: 'The program the client heard about',
  'id-documents': 'ID and documents',
  benefits: 'Benefits',
  food: 'Food',
  transportation: 'Getting around',
  veterans: 'Veterans',
  'phone-internet': 'Phone',
  legal: 'Legal help (a service, not advice)',
  'behavioral-health': 'Mental health and substance use',
};

export const QUESTIONS: Need[] = ['sleep', 'work', 'loan', 'travel'];

export const OTHER_NEEDS = ['id-documents', 'benefits', 'food', 'transportation', 'veterans', 'phone-internet', 'legal', 'behavioral-health'];

export const STATUS_LABEL: Record<FitStatus, string> = {
  likely_fit: 'Likely a fit. Not a promise.',
  maybe: 'Maybe: ask first',
  not_a_fit: 'Not a fit',
};

export const OUTCOME_ICON = { meets: '✓', does_not_meet: '✕', unknown: '?' } as const;

export const OUTCOME_LABEL = { meets: 'Meets', does_not_meet: 'Does not meet', unknown: 'Unknown, ask' } as const;

export const TRI_LABEL: Record<Tri, string> = { yes: 'Yes', no: 'No', unknown: 'Not known' };

/** Copy exists only in English and Spanish; other languages fall back to English (see the handoff). */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'vi', label: 'Tiếng Việt (English copy for now)' },
  { code: 'ko', label: '한국어 (English copy for now)' },
  { code: 'zh', label: '中文 (English copy for now)' },
  { code: 'tl', label: 'Tagalog (English copy for now)' },
];

export const BLANK_PROFILE: IntakeProfile = {
  id: 'custom',
  questions: [],
  other_needs: [],
  age_band: 'unknown',
  city: null,
  city_ties: [],
  household: 'unknown',
  gender: 'not_shared',
  adl_independent: 'unknown',
  mobility_device: false,
  disability: 'unknown',
  medi_cal: 'unknown',
  veteran: 'unknown',
  has: { ca_id: 'unknown', birth_certificate: 'unknown', phone: 'unknown', email: 'unknown', bank_account: 'unknown', mailing_address: 'unknown', permanent_residence: 'unknown' },
  born_in_california: 'unknown',
  language: 'en',
  reads_well: true,
  phone_ok: true,
  travel: null,
  safety: { feels_unsafe: false, crisis: false },
  heard_of: null,
  client_words: '',
};
