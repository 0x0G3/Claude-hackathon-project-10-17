import {
  AgeBand,
  CheckResult,
  Condition,
  DirectoryEntry,
  EligibilityRules,
  FitStatus,
  IntakeProfile,
  MatchItem,
  MatchOutput,
  NeedMatches,
  ProgramLookup,
  Requirement,
  Tri,
} from '@/types';
import { getDirectory, getTags } from '@/lib/resources/loader';
import { either } from '@/lib/tri';

/**
 * Eligibility matcher (architecture 4.5). Plain code over the directory: every rule returns
 * meets / does_not_meet / unknown. Claude explains these results later; it never decides them.
 */

const AGE_RANGES: Record<Exclude<AgeBand, 'unknown'>, [number, number]> = {
  under_18: [0, 17],
  '18_21': [18, 21],
  '22_24': [22, 24],
  '25_59': [25, 59],
  '60_61': [60, 61],
  '62_plus': [62, 120],
};

const AGE_LABEL: Record<AgeBand, string> = {
  under_18: 'under 18',
  '18_21': '18–21',
  '22_24': '22–24',
  '25_59': '25–59',
  '60_61': '60–61',
  '62_plus': '62+',
  unknown: 'unknown',
};

function ageCheck(band: AgeBand, min: number | null, max: number | null): CheckResult['outcome'] {
  if (band === 'unknown') return 'unknown';
  const [lo, hi] = AGE_RANGES[band];
  const ruleLo = min ?? 0;
  const ruleHi = max ?? 200;
  if (lo >= ruleLo && hi <= ruleHi) return 'meets';
  if (hi < ruleLo || lo > ruleHi) return 'does_not_meet';
  return 'unknown';
}

function triCheck(value: Tri): CheckResult['outcome'] {
  return value === 'yes' ? 'meets' : value === 'no' ? 'does_not_meet' : 'unknown';
}

function sameCity(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function requirementCheck(rule: string, req: Requirement | undefined, has: Tri, label: string): CheckResult | null {
  if (req === undefined || req === false) return null;
  if (req === true) {
    return {
      rule,
      outcome: triCheck(has),
      detail: has === 'yes' ? `Needs ${label}; client has it.` : has === 'no' ? `Needs ${label}; client does not have it yet.` : `Needs ${label}; ask whether the client has it.`,
    };
  }
  // The source is silent on a blocker that matters.
  return has === 'yes'
    ? { rule, outcome: 'meets', detail: `Not stated whether ${label} is needed; client has it anyway.` }
    : { rule, outcome: 'unknown', detail: `Not stated whether ${label} is needed. Ask when you call.` };
}

function conditionCheck(c: Condition, p: IntakeProfile): CheckResult['outcome'] {
  if (c.kind === 'age') return ageCheck(p.age_band, c.min, c.max);
  if (c.kind === 'disability') return triCheck(p.disability);
  return triCheck(p.veteran);
}

function describeCondition(c: Condition): string {
  if (c.kind === 'age') {
    if (c.min !== null && c.max === null) return `age ${c.min}+`;
    if (c.min === null && c.max !== null) return `age ${c.max} or under`;
    return `age ${c.min}–${c.max}`;
  }
  return c.kind === 'disability' ? 'a disability' : 'veteran';
}

export function evaluateRules(rules: EligibilityRules, p: IntakeProfile): CheckResult[] {
  const checks: CheckResult[] = [];
  const tags = getTags();

  if (rules.age_min !== undefined || rules.age_max !== undefined) {
    const min = rules.age_min ?? null;
    const max = rules.age_max ?? null;
    const outcome = ageCheck(p.age_band, min, max);
    const range = max === null ? `${min}+` : `${min ?? 0}–${max}`;
    checks.push({ rule: 'age', outcome, detail: `Ages ${range}; client is ${AGE_LABEL[p.age_band]}.` });
  }

  if (rules.requires_city_ties?.length) {
    const cities = rules.requires_city_ties;
    const detail = rules.ties_detail ? ` (${rules.ties_detail})` : '';
    if (p.city_ties.some(t => cities.some(c => sameCity(c, t)))) {
      checks.push({ rule: 'city ties', outcome: 'meets', detail: `Needs ties to ${cities.join(' / ')}${detail}; ties recorded.` });
    } else if (p.city_ties.length === 0) {
      checks.push({ rule: 'city ties', outcome: 'unknown', detail: `Needs ties to ${cities.join(' / ')}${detail}. Ask about ties.` });
    } else {
      checks.push({
        rule: 'city ties',
        outcome: 'does_not_meet',
        detail: `Needs ties to ${cities.join(' / ')}${detail}; recorded ties are ${p.city_ties.join(', ')}.`,
      });
    }
  }

  if (rules.spa) {
    const spa = tags.spa[rules.spa];
    const name = rules.spa === 'central' ? 'Central' : 'North';
    if (!p.city) {
      checks.push({ rule: 'service area', outcome: 'unknown', detail: `Serves the ${name} SPA only. Ask which city the client was last in.` });
    } else if (spa.cities.some(c => sameCity(c, p.city!))) {
      checks.push({ rule: 'service area', outcome: 'meets', detail: `Serves the ${name} SPA; ${p.city} is in it.` });
    } else {
      checks.push({ rule: 'service area', outcome: 'does_not_meet', detail: `Serves the ${name} SPA only; ${p.city} is not listed in it.` });
    }
  }

  if (rules.households?.length) {
    const allowed = rules.households;
    checks.push({
      rule: 'household',
      outcome: p.household === 'unknown' ? 'unknown' : allowed.includes(p.household) ? 'meets' : 'does_not_meet',
      detail: `Serves: ${allowed.join(', ').replace(/_/g, ' ')}; client household is ${p.household.replace(/_/g, ' ')}.`,
    });
  }

  if (rules.requires_veteran) {
    checks.push({ rule: 'veteran', outcome: triCheck(p.veteran), detail: `Veterans only; client veteran status is ${p.veteran}.` });
  }
  if (rules.requires_medi_cal) {
    checks.push({ rule: 'Medi-Cal', outcome: triCheck(p.medi_cal), detail: `Medi-Cal members only; client Medi-Cal is ${p.medi_cal}.` });
  }
  if (rules.requires_adl_independent) {
    const outcome = triCheck(p.adl_independent);
    checks.push({
      rule: 'daily living',
      outcome,
      detail:
        outcome === 'unknown'
          ? `Must meet all Activities of Daily Living${p.mobility_device ? '; client uses a mobility device, so confirm' : ''}. Ask.`
          : `Must meet all Activities of Daily Living; client: ${p.adl_independent}.`,
    });
  }
  if (rules.requires_host_confirmed) {
    const host = p.travel?.host_confirmed ?? 'unknown';
    checks.push({ rule: 'host at destination', outcome: triCheck(host), detail: `Needs family or a safe adult who agrees to take the client in; confirmed: ${host}.` });
  }

  const reqs = [
    requirementCheck('CA ID', rules.requires_ca_id, p.has.ca_id, 'a California ID'),
    requirementCheck('bank account', rules.requires_bank_account, p.has.bank_account, 'a bank account'),
    requirementCheck('phone or email', rules.requires_phone_or_email, either(p.has.phone, p.has.email), 'an active phone or email'),
    requirementCheck('permanent residence', rules.requires_permanent_residence, p.has.permanent_residence, 'a permanent residence'),
  ];
  checks.push(...reqs.filter((c): c is CheckResult => c !== null));

  if (rules.qualifies_if_any?.length) {
    const outcomes = rules.qualifies_if_any.map(c => conditionCheck(c, p));
    const outcome = outcomes.includes('meets') ? 'meets' : outcomes.every(o => o === 'does_not_meet') ? 'does_not_meet' : 'unknown';
    checks.push({
      rule: 'qualifying group',
      outcome,
      detail: `Qualifies with any of: ${rules.qualifies_if_any.map(describeCondition).join(', ')}.`,
    });
  }

  for (const req of rules.other_requirements ?? []) {
    checks.push({ rule: 'other requirement', outcome: 'unknown', detail: `${req}. Ask when you call.` });
  }

  if (rules.gender_wording_conflict) {
    checks.push({
      rule: 'who is served',
      outcome: 'unknown',
      detail: 'The source says "women" in one place and "individuals" in another. Confirm who is served when you call.',
    });
  }

  return checks;
}

function toConfidence(value: string | null): 'high' | 'medium' | 'low' {
  return value === 'high' || value === 'medium' ? value : 'low';
}

function statusFor(checks: CheckResult[], entry: DirectoryEntry): FitStatus {
  if (checks.some(c => c.outcome === 'does_not_meet')) return 'not_a_fit';
  const unknowns = checks.filter(c => c.outcome === 'unknown').length;
  // A low-confidence listing is never the main door.
  if (unknowns === 0 && toConfidence(entry.confidence) !== 'low') return 'likely_fit';
  return 'maybe';
}

export function matchEntry(entry: DirectoryEntry, profile: IntakeProfile): MatchItem {
  const checks: CheckResult[] = entry.rules ? evaluateRules(entry.rules, profile) : [];
  if (!entry.rules) {
    checks.push({ rule: 'eligibility', outcome: 'unknown', detail: 'Eligibility is not structured for this listing yet. Read the source wording and ask when you call.' });
  }
  const latest = entry.latest_verification;
  if (latest && (latest.outcome === 'closed' || latest.outcome === 'number_wrong')) {
    checks.push({
      rule: 'staff report',
      outcome: latest.outcome === 'closed' ? 'does_not_meet' : 'unknown',
      detail: `Staff reported "${latest.outcome.replace('_', ' ')}" on ${latest.date}${latest.note ? `: ${latest.note}` : ''}.`,
    });
  }
  return {
    resource_id: entry.id,
    name: entry.name,
    status: statusFor(checks, entry),
    checks,
    unknown_count: checks.filter(c => c.outcome === 'unknown').length,
    confidence: toConfidence(entry.confidence),
    verified_date: entry.verified_date,
    warnings: entry.warnings,
    ladder_step: entry.rules?.ladder_step ?? null,
  };
}

const STATUS_RANK: Record<FitStatus, number> = { likely_fit: 0, maybe: 1, not_a_fit: 2 };
const CONFIDENCE_RANK = { high: 0, medium: 1, low: 2 } as const;

/** Rank by fit, then confidence, then fewer unknowns. Loans follow the ladder: advising before lenders. */
function rank(items: MatchItem[], need: string): MatchItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const s = STATUS_RANK[a.item.status] - STATUS_RANK[b.item.status];
      if (s !== 0) return s;
      if (need === 'loan') {
        const l = (a.item.ladder_step ?? 9) - (b.item.ladder_step ?? 9);
        if (l !== 0) return l;
      }
      const c = CONFIDENCE_RANK[a.item.confidence] - CONFIDENCE_RANK[b.item.confidence];
      if (c !== 0) return c;
      const u = a.item.unknown_count - b.item.unknown_count;
      return u !== 0 ? u : a.index - b.index;
    })
    .map(x => x.item);
}

function noSureDoor(items: MatchItem[]): boolean {
  return !items.some(i => i.status !== 'not_a_fit' && i.confidence === 'high');
}

function entriesForOtherNeed(category: string, directory: DirectoryEntry[]): DirectoryEntry[] {
  const extras = getTags().other_need_extras[category]?.resource_ids ?? [];
  return directory.filter(e => e.category === category || extras.includes(e.id));
}

const STOPWORDS = new Set(['a', 'an', 'the', 'place', 'that', 'helps', 'help', 'with', 'for', 'of', 'program', 'there', 'is', 'and', 'to', 'in', 'on', 'someone']);

/** Scenario C12: "a place that helps with deposits". Possible matches only, with the caveat. */
export function lookupProgram(query: string, directory: DirectoryEntry[]): ProgramLookup {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
    .map(t => t.replace(/(ies)$/, 'y').replace(/s$/, ''));

  const matches = directory
    .map(e => {
      const fields: [string, string][] = [
        ['name', e.name],
        ['services', e.services.join(' | ')],
        ['description', e.description],
        ['tags', e.tags.join(' ')],
      ];
      const matched_on = fields.filter(([, text]) => terms.some(t => text.toLowerCase().includes(t))).map(([f]) => f);
      return { entry: e, matched_on };
    })
    .filter(m => m.matched_on.length > 0)
    .map(m => ({
      resource_id: m.entry.id,
      name: m.entry.name,
      matched_on: m.matched_on,
      confidence: toConfidence(m.entry.confidence),
      verified_date: m.entry.verified_date,
    }));

  return {
    query,
    matches,
    caveat:
      matches.length > 0
        ? "These are possible matches from the directory. We can't confirm any of them is the program the client heard about."
        : 'No listing in the directory matches that description. That does not mean the program does not exist.',
  };
}

export function matchProfile(profile: IntakeProfile, now: Date = new Date()): MatchOutput {
  const directory = getDirectory(now);
  const needs: NeedMatches[] = [];

  for (const need of profile.questions) {
    const items = directory.filter(e => e.rules?.needs.includes(need)).map(e => matchEntry(e, profile));
    const ranked = rank(items, need);
    needs.push({ need, items: ranked, no_sure_door: noSureDoor(ranked) });
  }

  for (const category of profile.other_needs) {
    const items = entriesForOtherNeed(category, directory).map(e => matchEntry(e, profile));
    if (items.length === 0) continue;
    const ranked = rank(items, category);
    needs.push({ need: category, items: ranked, no_sure_door: noSureDoor(ranked) });
  }

  return {
    needs,
    program_lookup: profile.heard_of ? lookupProgram(profile.heard_of, directory) : null,
  };
}

/** Resource ids the Planner may cite: anything the matcher did not rule out. */
export function citableIds(matches: MatchOutput): string[] {
  const ids = new Set<string>();
  for (const n of matches.needs) for (const i of n.items) if (i.status !== 'not_a_fit') ids.add(i.resource_id);
  for (const m of matches.program_lookup?.matches ?? []) ids.add(m.resource_id);
  return [...ids];
}
