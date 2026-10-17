import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ClientPlan, IntakeProfile, PlanLine, PlanOutput, Resource } from '@/types';
import { ClientPlanSchema } from '@/schemas';
import { getResourceById } from '@/lib/resources/loader';
import { FALLBACK_PARAMS, MODEL, getClient, parseFinalJson } from './client';

/**
 * Writer (architecture 3b / 4.6). Turns the approved plan into plain words, about grade 5, in the
 * client's language. Phone numbers, addresses, hours and program names are copied, never translated.
 */

export interface WriterContext {
  profile: Pick<IntakeProfile, 'language' | 'phone_ok' | 'reads_well'>;
}

type Lang = 'en' | 'es';

const COPY: Record<Lang, {
  call: (name: string, phone: string) => string;
  referral: (name: string, phone: string) => string;
  referralNoPhone: (name: string) => string;
  inPerson: (name: string, address: string) => string;
  noContact: (name: string) => string;
  hours: (hours: string) => string;
  askHours: string;
  askFit: string;
  confirmFirst: string;
  unsure: string;
  relay: string;
  noSureDoor: (q: string) => string;
  maybeNotThis: string;
  questions: Record<string, string>;
}> = {
  en: {
    call: (n, p) => `Call ${n}: ${p}.`,
    referral: (n, p) => `Call ${p} and ask for a referral to ${n}. Do not go to the address without a referral.`,
    referralNoPhone: n => `Ask your case worker for a referral to ${n}. Do not go to the address without a referral.`,
    inPerson: (n, a) => `Go in person to ${n}: ${a}.`,
    noContact: n => `Ask your case worker how to reach ${n}.`,
    hours: h => `Hours: ${h}`,
    askHours: 'Ask about hours when you call.',
    askFit: 'Ask if this program can help you.',
    confirmFirst: 'Call to confirm first.',
    unsure: 'It is not sure this is still running. Call to confirm.',
    relay: 'If calling is hard, use the 7-1-1 relay service.',
    noSureDoor: q => `We did not find a sure option for ${q}. Your case worker will help.`,
    maybeNotThis: 'This may not be the program you heard about.',
    questions: { sleep: 'a place to sleep', work: 'work', loan: 'a small loan', travel: 'getting home', prerequisites: 'papers you need first' },
  },
  es: {
    call: (n, p) => `Llame a ${n}: ${p}.`,
    referral: (n, p) => `Llame al ${p} y pida una referencia para ${n}. No vaya a la dirección sin una referencia.`,
    referralNoPhone: n => `Pida a su trabajador social una referencia para ${n}. No vaya a la dirección sin una referencia.`,
    inPerson: (n, a) => `Vaya en persona a ${n}: ${a}.`,
    noContact: n => `Pregunte a su trabajador social cómo comunicarse con ${n}.`,
    hours: h => `Horario (en inglés): ${h}`,
    askHours: 'Pregunte por el horario cuando llame.',
    askFit: 'Pregunte si este programa le puede ayudar.',
    confirmFirst: 'Llame primero para confirmar.',
    unsure: 'No es seguro que este programa siga funcionando. Llame para confirmar.',
    relay: 'Si le cuesta llamar, use el servicio de relevo 7-1-1.',
    noSureDoor: q => `No encontramos una opción segura para ${q}. Su trabajador social le ayudará.`,
    maybeNotThis: 'Puede que este no sea el programa del que le hablaron.',
    questions: { sleep: 'un lugar para dormir', work: 'trabajo', loan: 'un préstamo pequeño', travel: 'regresar a casa', prerequisites: 'los papeles que necesita primero' },
  },
};

/** Joins sentences, adding the full stop a source field may lack ("… Monday - Friday" + "Ask …"). */
function sentences(parts: string[]): string {
  return parts.map(p => (/[.!?)]$/.test(p.trim()) ? p.trim() : `${p.trim()}.`)).join(' ');
}

function linesFor(plan: PlanOutput, lang: Lang, ctx: WriterContext): PlanLine[] {
  const t = COPY[lang];
  const lines: PlanLine[] = [];
  let first = true;

  for (const q of plan.questions) {
    // No sure door: say so first. A weak option is never the main thing to do today.
    const noSureDoor = q.gaps.some(g => g.startsWith('No sure door'));
    if (noSureDoor) {
      lines.push({ when: 'today', resource_id: null, text: t.noSureDoor(t.questions[q.question] ?? q.question) });
      first = false;
    }
    for (const step of q.steps) {
      const r = getResourceById(step.resource_id);
      if (!r) continue;
      const when = !noSureDoor && (first || q.question === 'prerequisites') ? 'today' : 'this_week';
      first = false;
      const referral = r.referral_required === true;
      const inPerson = !ctx.profile.phone_ok && r.address && !referral;
      const action = inPerson
        ? t.inPerson(r.name, r.address!)
        : referral
          ? r.phone ? t.referral(r.name, r.phone) : t.referralNoPhone(r.name)
          : r.phone ? t.call(r.name, r.phone) : r.address ? t.inPerson(r.name, r.address) : t.noContact(r.name);

      // "Ask about hours when you call" only makes sense when there is a number to call.
      const extra = r.hours ? [t.hours(r.hours)] : r.phone ? [t.askHours] : [];
      if (step.unknowns_to_ask.some(u => !u.startsWith('Hours'))) extra.push(t.askFit);
      if (r.confidence === 'medium') extra.push(t.confirmFirst);
      if (r.confidence !== 'high' && r.confidence !== 'medium') extra.push(t.unsure);
      if (q.question === 'program_lookup') extra.push(t.maybeNotThis);

      lines.push({ when, resource_id: r.id, text: sentences([action, ...extra]) });
    }
  }
  if (!ctx.profile.phone_ok) lines.push({ when: 'today', resource_id: null, text: t.relay });
  return lines.sort((a, b) => (a.when === b.when ? 0 : a.when === 'today' ? -1 : 1));
}

/** Template writer: no API key needed. English and Spanish; other languages fall back to English. */
export function writeWithRules(plan: PlanOutput, ctx: WriterContext): ClientPlan {
  const lang: Lang = ctx.profile.language === 'es' ? 'es' : 'en';
  return {
    language: lang,
    lines: linesFor(plan, lang, ctx),
    english_lines: lang === 'en' ? [] : linesFor(plan, 'en', ctx),
  };
}

const SYSTEM = `You write a take-home plan for a client leaving recuperative care, from a plan a case worker will approve.

Rules:
- Plain words, about a grade 5 reading level. One action per line. "today" lines first, then "this_week".
- Write in the requested language. Also give the same lines in English in english_lines (empty if the language is English).
- Copy phone numbers, addresses, hours and program names exactly as given in records. Never translate or reformat them.
- Use only facts in the records you are given. If hours are missing, say to ask about hours when calling.
- Never say the client qualifies or will be accepted. Never give medical, legal or immigration advice.
- Set resource_id on each line to the record it is about, or null for a general line.`;

function recordsFor(plan: PlanOutput): Pick<Resource, 'id' | 'name' | 'phone' | 'address' | 'hours' | 'referral_required' | 'confidence'>[] {
  const ids = [...new Set(plan.questions.flatMap(q => q.steps.map(s => s.resource_id)))];
  return ids
    .map(id => getResourceById(id))
    .filter((r): r is Resource => Boolean(r))
    .map(({ id, name, phone, address, hours, referral_required, confidence }) => ({ id, name, phone, address, hours, referral_required, confidence }));
}

export async function writeWithClaude(plan: PlanOutput, ctx: WriterContext, feedback: string[] = []): Promise<ClientPlan> {
  const client = getClient();
  if (!client) throw new Error('Writer: ANTHROPIC_API_KEY is not set.');

  const message = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low', format: betaZodOutputFormat(ClientPlanSchema) },
    ...FALLBACK_PARAMS,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          language: ctx.profile.language,
          channel: {
            phone_calls_are_hard: !ctx.profile.phone_ok,
            large_print: !ctx.profile.reads_well,
          },
          plan: plan.questions.map(q => ({
            question: q.question,
            steps: q.steps.map(s => ({ resource_id: s.resource_id, what_to_do_today: s.what_to_do_today, unknowns_to_ask: s.unknowns_to_ask })),
            gaps: q.gaps,
          })),
          records: recordsFor(plan),
          ...(feedback.length ? { fact_check_failures_to_fix: feedback } : {}),
        }),
      },
    ],
  });

  return parseFinalJson(message, ClientPlanSchema, 'Writer');
}
