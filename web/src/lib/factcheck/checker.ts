import { ClientPlan, PlanOutput, Resource } from '@/types';
import { getAllResources, getRawResources } from '@/lib/resources/loader';

/**
 * Fact checker (architecture 4.8). Plain code that runs after Claude and before anything is shown.
 * Claude may select and rephrase; it may never produce a phone number, address or hour that is not
 * in a record it cited.
 */

/** Fields a plan may copy facts from. */
const FACT_FIELDS = ['phone', 'address', 'hours', 'website', 'name', 'how_to_access', 'notes'] as const;

/** Universal numbers shown on every client screen (help strip, relay); not directory facts. */
const UNIVERSAL_NUMBERS = new Set(['911', '211', '711']);

const PHONE_10 = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
const PHONE_WORD = /\b1-8\d{2}-[A-Z]{4,7}\b/g;
const PHONE_SHORT = /\b(?:\d-\d-\d|988|\d{3}-\d{3})\b/g;
const ADDRESS =
  /\b\d{2,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Za-z][\w.']*\s+){1,4}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Way|Pl|Place|Parkway|Pkwy|Circle|Cir|Ln|Lane|Ct|Court)\b\.?/g;
const TIME = /\b\d{1,2}(?::\d{2})?\s?(?:a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z])/gi;

const ADVICE: { label: string; pattern: RegExp }[] = [
  { label: 'promises eligibility ("you qualify")', pattern: /\byou (qualify|are eligible|will be approved|will get a bed)\b/i },
  { label: 'promises eligibility (es)', pattern: /\b(usted )?(califica|es elegible|ser[aá] aprobad[oa])\b/i },
  { label: 'medicine advice', pattern: /\b(stop|start|skip|keep|quit) (taking )?(your )?(pills?|medications?|medicines?|meds)\b/i },
  { label: 'medicine advice (es)', pattern: /\b(deje|dejar|siga) (de )?tomar\b/i },
  { label: 'legal advice', pattern: /\b(you should (sue|plead|appeal)|your (record|conviction) (will|can) be (expunged|cleared))\b/i },
  { label: 'immigration advice', pattern: /\b(you (won't|will not) be deported|immigration status|estatus migratorio)\b/i },
];

export function digits(s: string): string {
  return s.replace(/\D/g, '');
}

/** Lowercase, drop whitespace, dots and ":00" so "8:00 a.m." and "8 AM" compare equal. */
function normTime(s: string): string {
  return s.toLowerCase().replace(/[\s.]/g, '').replace(/:00/g, '');
}

function normText(s: string): string {
  return s.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

function recordText(r: Resource): string {
  return [r.name, r.phone, r.address, r.hours, r.website, r.how_to_access, r.notes, r.eligibility].filter(Boolean).join(' \n ');
}

function phonesIn(text: string): string[] {
  const found: string[] = [];
  let rest = text;
  for (const re of [PHONE_10, PHONE_WORD, PHONE_SHORT]) {
    rest = rest.replace(re, m => {
      found.push(m);
      return ' ';
    });
  }
  return found;
}

/** Problems with phone numbers, addresses and times in `text` that no cited record contains. */
export function scanText(text: string, cited: Resource[], where: string): string[] {
  const problems: string[] = [];
  const sources = cited.map(recordText);
  const sourceDigits = sources.map(digits);
  const sourceNorm = sources.map(normText);
  const sourceTimes = sources.map(normTime);

  for (const phone of phonesIn(text)) {
    const d = digits(phone);
    if (UNIVERSAL_NUMBERS.has(d)) continue;
    const ok = /[A-Z]/.test(phone) ? sources.some(s => s.includes(phone)) : sourceDigits.some(s => s.includes(d));
    if (!ok) problems.push(`${where}: phone "${phone}" is not in any cited record.`);
  }
  for (const address of text.match(ADDRESS) ?? []) {
    if (!sourceNorm.some(s => s.includes(normText(address)))) problems.push(`${where}: address "${address}" is not in any cited record.`);
  }
  for (const time of text.match(TIME) ?? []) {
    if (!sourceTimes.some(s => s.includes(normTime(time)))) problems.push(`${where}: time "${time}" is not in any cited record.`);
  }
  return problems;
}

function confidentialAddresses(): string[] {
  const masked = new Map(getAllResources().map(r => [r.id, r]));
  return getRawResources()
    .filter(r => masked.get(r.id)?.is_confidential_address && r.address)
    .map(r => r.address as string);
}

function scanSafety(text: string, where: string): string[] {
  const problems: string[] = [];
  const norm = normText(text);
  for (const addr of confidentialAddresses()) {
    if (norm.includes(normText(addr))) problems.push(`${where}: contains a confidential location address.`);
  }
  for (const rule of ADVICE) {
    if (rule.pattern.test(text)) problems.push(`${where}: ${rule.label}.`);
  }
  return problems;
}

/** Checks 1 and 2 on the Planner's output: ids are allowed, and every fact is copied verbatim. */
export function checkPlan(plan: PlanOutput, allowedIds: string[]): string[] {
  const problems: string[] = [];
  const records = new Map(getAllResources().map(r => [r.id, r]));
  const allowed = new Set(allowedIds);

  for (const q of plan.questions) {
    for (const step of q.steps) {
      const where = `${q.question} step ${step.order}`;
      const record = records.get(step.resource_id);
      if (!record) {
        problems.push(`${where}: resource "${step.resource_id}" does not exist in the directory.`);
        continue;
      }
      if (!allowed.has(step.resource_id)) {
        problems.push(`${where}: "${step.resource_id}" was ruled out or not offered by the matcher.`);
      }
      for (const fact of step.facts_used) {
        const field = fact.field as (typeof FACT_FIELDS)[number];
        const source = FACT_FIELDS.includes(field) ? record[field] : null;
        if (typeof source !== 'string' || fact.value.trim().length < 3 || !source.includes(fact.value.trim())) {
          problems.push(`${where}: "${fact.value}" is not copied from ${record.id}.${fact.field}.`);
        }
      }
      const text = `${step.what_to_do_today}\n${step.why_this}`;
      problems.push(...scanText(text, [record], where), ...scanSafety(text, where));
    }
  }
  return problems;
}

/** Checks 3–5 on the Writer's take-home plan. */
export function checkClientPlan(clientPlan: ClientPlan, citedIds: string[]): string[] {
  const records = getAllResources();
  const cited = records.filter(r => citedIds.includes(r.id));
  const problems: string[] = [];
  const all = [...clientPlan.lines, ...clientPlan.english_lines];

  for (const [i, line] of all.entries()) {
    const where = `plan line ${i + 1}`;
    if (line.resource_id && !citedIds.includes(line.resource_id)) {
      problems.push(`${where}: cites "${line.resource_id}", which is not in the approved plan.`);
    }
    problems.push(...scanText(line.text, cited, where), ...scanSafety(line.text, where));
  }
  return problems;
}
