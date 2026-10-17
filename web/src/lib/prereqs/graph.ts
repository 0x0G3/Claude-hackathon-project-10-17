import { Blocker, BlockerId, IntakeProfile, Tri } from '@/types';
import { getResourceById } from '@/lib/resources/loader';
import { either } from '@/lib/tri';

/**
 * "What's blocking the door" (architecture 4.4). A small dependency graph from the seed:
 * which programs need each thing, and which listing unblocks it. Shown before the matches.
 */

interface BlockerDef {
  id: BlockerId;
  label: string;
  has: (p: IntakeProfile) => Tri;
  blocks: { resource_id: string | null; name?: string; note: string | null }[];
  unblockers: (p: IntakeProfile) => { resource_id: string; note: string }[];
  unknowns: (p: IntakeProfile) => string[];
}

const DEFS: BlockerDef[] = [
  {
    id: 'ca_id',
    label: 'California ID',
    has: p => p.has.ca_id,
    blocks: [
      { resource_id: 'jfla-zero-interest-loans', note: null },
      { resource_id: 'oc-general-relief', note: 'Identification is a required verification.' },
      { resource_id: 'octa-reduced-fares', note: 'Proving age or disability needs ID documents.' },
      { resource_id: 'homeless-fee-exempt-birth-certificate', note: 'In person, valid government photo ID is required.' },
    ],
    unblockers: p => [
      {
        resource_id: 'dmv-no-fee-and-reduced-fee-id',
        note:
          p.age_band === '62_plus'
            ? 'No-fee ID for people experiencing homelessness, and a senior no-fee card at 62+. Identity must still be proven.'
            : 'No-fee ID for people experiencing homelessness. Identity must still be proven.',
      },
    ],
    unknowns: () => ['What proof of homelessness the DMV wants for the no-fee card: not stated on the DMV page. Ask the DMV.'],
  },
  {
    id: 'birth_certificate',
    label: 'Birth certificate',
    has: p => p.has.birth_certificate,
    blocks: [{ resource_id: 'dmv-no-fee-and-reduced-fee-id', note: 'Needed to prove identity for a first California card.' }],
    unblockers: () => [
      {
        resource_id: 'homeless-fee-exempt-birth-certificate',
        note: 'Free with an Affidavit of Homeless Status signed by a homeless services provider. The Clerk-Recorder serves people born in Orange County.',
      },
    ],
    unknowns: p => [
      'Whether IHH staff can sign the Affidavit of Homeless Status: unknown, ask IHH.',
      ...(p.born_in_california === 'no'
        ? ["Born outside California: that state's birth certificate process is not in the directory. Unknown."]
        : p.born_in_california === 'unknown'
          ? ['Where the client was born decides which office issues the birth certificate. Ask.']
          : []),
    ],
  },
  {
    id: 'phone_or_email',
    label: 'Phone or email',
    has: p => either(p.has.phone, p.has.email),
    blocks: [{ resource_id: 'chrysalis-orange-county', note: 'An active phone number or email address is needed.' }],
    unblockers: () => [{ resource_id: 'california-lifeline', note: 'Discounted phone service for qualified households.' }],
    unknowns: () => ['Which programs qualify someone for California LifeLine: not listed on the page. Unknown.'],
  },
  {
    id: 'bank_account',
    label: 'Bank account',
    has: p => p.has.bank_account,
    blocks: [{ resource_id: null, name: 'Small loans', note: 'Implied for loans; not stated in the directory.' }],
    unblockers: () => [],
    unknowns: () => ['The directory has no program that helps open a bank account.'],
  },
  {
    id: 'mailing_address',
    label: 'Mailing address',
    has: p => p.has.mailing_address,
    blocks: [{ resource_id: null, name: 'Many applications', note: null }],
    unblockers: () => [{ resource_id: 'hub-resource-center-orange', note: 'Lists mail services, for the City of Orange.' }],
    unknowns: () => ['Mail services outside the City of Orange are not covered in the directory.'],
  },
];

/** Blockers the client lacks (`no`) or hasn't said (`unknown`). Things the client has are left out. */
export function checkPrerequisites(profile: IntakeProfile): Blocker[] {
  return DEFS.map(def => {
    const has = def.has(profile);
    return {
      id: def.id,
      label: def.label,
      has,
      blocks: def.blocks.map(b => ({
        resource_id: b.resource_id,
        name: b.resource_id ? (getResourceById(b.resource_id)?.name ?? b.resource_id) : (b.name ?? ''),
        note: b.note,
      })),
      unblockers: def.unblockers(profile).map(u => ({
        resource_id: u.resource_id,
        name: getResourceById(u.resource_id)?.name ?? u.resource_id,
        note: u.note,
      })),
      unknowns: def.unknowns(profile),
    };
  }).filter(b => b.has !== 'yes');
}

/** Resource ids the Planner may cite as unblocker steps. */
export function unblockerIds(blockers: Blocker[]): string[] {
  return blockers.filter(b => b.has === 'no').flatMap(b => b.unblockers.map(u => u.resource_id));
}
