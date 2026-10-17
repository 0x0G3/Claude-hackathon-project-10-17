import { IntakeProfile, SafetyLine, SafetyResult } from '@/types';
import { getResourceById } from '@/lib/resources/loader';

/**
 * Safety gate (architecture 4.2). Plain code, runs before the matcher and before Claude.
 * Danger, crisis and medicine questions stop the search. Legal and immigration questions
 * add a notice: services may be listed, advice never.
 */

type Rule = { label: string; pattern: RegExp };

// Word-boundary patterns in English and Spanish. "Can't go back under the bridge" (C01) must not fire,
// so "can't go back" alone is not a danger phrase; "he'll find me" (C10) is.
const DANGER: Rule[] = [
  { label: 'someone may find or follow them', pattern: /\b(he|she|they)('ll| will| is going to| are going to)? (find|follow|track) me\b/i },
  { label: 'afraid of a person', pattern: /\b(afraid|scared) of (him|her|them)\b/i },
  { label: 'hurt or threatened', pattern: /\b(hit|hits|beat|beats|hurt|hurts|choke|chokes|threaten(ed|s)?) me\b/i },
  { label: 'abuse or domestic violence', pattern: /\b(abuse[rd]?|abusive|domestic violence|dv)\b/i },
  { label: 'not safe', pattern: /\b(not safe|unsafe)\b/i },
  { label: 'danger (es)', pattern: /\b(me va a encontrar|me pega|me golpea|violencia|abuso|peligro|no estoy segura?)\b/i },
];

const CRISIS: Rule[] = [
  { label: 'suicide or self-harm', pattern: /\b(kill myself|suicid\w*|end my life|want to die|hurt myself|self[- ]harm|no reason to live)\b/i },
  { label: 'suicide or self-harm (es)', pattern: /\b(matarme|quitarme la vida|suicid\w*|no quiero vivir)\b/i },
];

const MEDICAL: Rule[] = [
  { label: 'medicine question', pattern: /\b(pills?|medication|medicines?|meds|dose|dosage|prescriptions?|side effects?)\b/i },
  { label: 'stopping treatment', pattern: /\bstop taking\b/i },
  { label: 'medicine question (es)', pattern: /\b(pastillas?|medicinas?|medicamentos?|dosis|receta)\b/i },
];

const LEGAL: Rule[] = [
  { label: 'legal question', pattern: /\b(lawyer|attorney|court|warrant|judge|sue|lawsuit|expunge\w*|evict\w*|probation|parole)\b/i },
  { label: 'legal question (es)', pattern: /\b(abogad[oa]|corte|tribunal|orden de arresto|desalojo)\b/i },
];

const IMMIGRATION: Rule[] = [
  { label: 'immigration question', pattern: /\b(immigration|deport\w*|green card|visa|undocumented|citizenship)\b/i },
  { label: 'immigration question (es)', pattern: /\b(inmigraci[oó]n|deport\w*|indocumentad[oa]|sin papeles|ciudadan[ií]a)\b/i },
];

function hits(rules: Rule[], text: string): string[] {
  return rules.filter(r => r.pattern.test(text)).map(r => r.label);
}

function directoryLine(id: string): SafetyLine | null {
  const r = getResourceById(id);
  if (!r || !r.phone) return null;
  return { resource_id: r.id, name: r.name, phone: r.phone, hours: r.hours };
}

/** 9-1-1 is on every client screen (help strip), not a directory fact. */
const EMERGENCY_LINE: SafetyLine = { resource_id: null, name: 'Emergency', phone: '9-1-1', hours: null };

export function runSafetyGate(profile: Pick<IntakeProfile, 'client_words' | 'safety'>): SafetyResult {
  const text = profile.client_words ?? '';
  const notices: string[] = [];

  const legal = hits(LEGAL, text);
  if (legal.length) {
    notices.push(
      'A legal question came up. The tool does not give legal advice. Community Legal Aid SoCal and Public Law Center can be offered as services.'
    );
  }
  const immigration = hits(IMMIGRATION, text);
  if (immigration.length) {
    notices.push('An immigration question came up. Do not ask about immigration status. Bring in staff; the tool gives no immigration advice.');
  }

  const danger = [...(profile.safety.feels_unsafe ? ['case worker checked "feels unsafe"'] : []), ...hits(DANGER, text)];
  if (danger.length) {
    return {
      route: 'danger',
      stop: true,
      triggers: danger,
      message: 'Safety first. Bring in staff now. No places or addresses are shown on this path.',
      lines: [EMERGENCY_LINE],
      staff_steps: [
        'Bring in a staff member now. Do not leave the client alone with the screen.',
        "Give a domestic violence hotline from IHH's own list.",
        'Assume a shared device: use Quick exit when done and clear the screen.',
        'Do not print or send a plan from this screen.',
        'Ask the client where they feel safe to go next; do not suggest an address from this tool.',
      ],
      missing: ["The directory has no domestic violence hotline yet. Staff give one from IHH's own list."],
      notices,
    };
  }

  const crisis = [...(profile.safety.crisis ? ['case worker checked "crisis"'] : []), ...hits(CRISIS, text)];
  if (crisis.length) {
    return {
      route: 'crisis',
      stop: true,
      triggers: crisis,
      message: 'Crisis support first. Bring in staff now.',
      lines: [EMERGENCY_LINE, directoryLine('988-suicide-and-crisis-lifeline'), directoryLine('oc-links')].filter(
        (l): l is SafetyLine => l !== null
      ),
      staff_steps: [
        'Bring in a staff member now.',
        'Offer 988 or OC Links with the client, on the client’s terms.',
        'Call 9-1-1 if there is immediate danger.',
      ],
      missing: [],
      notices,
    };
  }

  const medical = hits(MEDICAL, text);
  if (medical.length) {
    return {
      route: 'medical',
      stop: true,
      triggers: medical,
      message: 'Please ask your nurse or care team. This tool does not answer questions about medicine.',
      lines: [],
      staff_steps: ['Connect the client with their nurse or care team about the medicine question.', 'Run the plan again once the medicine question is with the care team.'],
      missing: [],
      notices,
    };
  }

  return { route: 'ok', stop: false, triggers: [], message: '', lines: [], staff_steps: [], missing: [], notices };
}
