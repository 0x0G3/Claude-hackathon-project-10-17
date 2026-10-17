import { GapEntry, IntakeProfile, MatchOutput, TravelStep } from '@/types';
import { getGapRegister } from '@/lib/resources/loader';

/** Gap-register entries for the needs in this session (architecture 4.7). */
export function gapsFor(needs: string[]): GapEntry[] {
  const wanted = new Set(needs);
  return getGapRegister().filter(g => g.needs.some(n => wanted.has(n)));
}

/** Every need a session touches, including blockers that map to a gap (e.g. no birth certificate). */
export function sessionNeeds(profile: IntakeProfile): string[] {
  const needs = new Set<string>([...profile.questions, ...profile.other_needs]);
  if (profile.has.ca_id === 'no' || profile.has.birth_certificate === 'no') needs.add('id-documents');
  if (profile.has.bank_account === 'no' && profile.questions.includes('loan')) needs.add('loan');
  return [...needs];
}

/**
 * Travel home is a process more than a directory hit, so it gets a checklist the case worker
 * steps through. Each step is done / not done / unknown; nothing here is sent.
 */
export function travelChecklist(profile: IntakeProfile, matches: MatchOutput): TravelStep[] {
  const travel = matches.needs.find(n => n.need === 'travel');
  const options = (travel?.items ?? []).filter(i => i.status !== 'not_a_fit');
  const host = profile.travel?.host_confirmed ?? 'unknown';
  const destination = profile.travel?.destination ?? 'the destination';

  return [
    {
      id: 'host',
      label: 'Host confirmed by the client',
      state: host === 'yes' ? 'done' : host === 'no' ? 'not_done' : 'unknown',
      note: `The client confirms someone in ${destination} will take them in. The case worker can draft a message for the client to send; the tool sends nothing.`,
    },
    {
      id: 'id',
      label: 'ID in hand',
      state: profile.has.ca_id === 'yes' ? 'done' : profile.has.ca_id === 'no' ? 'not_done' : 'unknown',
      note: profile.has.ca_id === 'no' ? 'See "What\'s blocking the door" for the no-fee ID.' : 'Most bus and train tickets need photo ID.',
    },
    {
      id: 'funding',
      label: 'Funding source',
      state: 'unknown',
      note:
        options.length > 0
          ? `Possible, not confirmed: ${options.map(o => o.name).join('; ')}. IHH internal option: unknown (staff to fill in).`
          : 'No listing in the directory fits. IHH internal option: unknown (staff to fill in).',
    },
    { id: 'ticket', label: 'Ticket', state: 'not_done', note: 'Book only after funding is confirmed.' },
    {
      id: 'arrival',
      label: 'Contact on arrival',
      state: 'unknown',
      note: `Someone in ${destination} the client can call when they arrive. Services there are not in this directory.`,
    },
  ];
}
