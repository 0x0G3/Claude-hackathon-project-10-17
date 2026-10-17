import fs from 'fs';
import path from 'path';
import {
  DirectoryEntry,
  EligibilityRules,
  GapEntry,
  IntakeProfile,
  Resource,
  Verification,
  Warning,
} from '@/types';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

export interface DirectoryTags {
  stale_after_days: number;
  confidential_location: string[];
  conflict: string[];
  spa: Record<'central' | 'north', { source_resource_id: string; cities: string[] }>;
  other_need_extras: Record<string, { resource_ids: string[]; basis_resource_id: string; basis: string }>;
}

export interface ScenarioText {
  id: string;
  title: string;
  client: string;
  in_their_words: string;
  needs: string[];
  constraints: string[];
}

const cache = new Map<string, unknown>();

function readJson<T>(file: string): T {
  if (cache.has(file)) return cache.get(file) as T;
  const parsed = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')) as T;
  cache.set(file, parsed);
  return parsed;
}

// ---------------------------------------------------------------------------
// Seed records
// ---------------------------------------------------------------------------

/** Unmasked seed records. Server-only: the fact checker needs real addresses to block them. */
export function getRawResources(): Resource[] {
  return readJson<{ resources: Resource[] }>('oc-resources.seed.json').resources;
}

export function getSeedGeneratedDate(): string {
  return readJson<{ generated: string }>('oc-resources.seed.json').generated;
}

export function getTags(): DirectoryTags {
  return readJson<DirectoryTags>('directory-tags.json');
}

function isConfidential(resource: Resource): boolean {
  const flagged = getTags().confidential_location.includes(resource.id);
  const looksSurvivorServing =
    resource.tags.some(t => ['domestic-violence', 'survivors', 'human-trafficking', 'confidential'].includes(t.toLowerCase())) ||
    resource.population.some(p => p.toLowerCase().includes('domestic violence')) ||
    Boolean(resource.notes && /deliberately omitted|confidential/i.test(resource.notes));
  // Over-suppressing an address is safe; leaking a survivor program's address is not.
  // Without an address there is nothing to hide, so don't badge a hotline as a confidential location.
  return flagged || (looksSurvivorServing && Boolean(resource.address));
}

function maskResource(resource: Resource): Resource {
  const confidential = isConfidential(resource);
  if (confidential && resource.address) {
    return { ...resource, address: null, is_confidential_address: true };
  }
  return { ...resource, is_confidential_address: confidential };
}

/** Seed records with survivor-program addresses removed. Safe to send to the browser or to Claude. */
export function getAllResources(): Resource[] {
  if (!cache.has('masked')) cache.set('masked', getRawResources().map(maskResource));
  return cache.get('masked') as Resource[];
}

export function getResourceById(id: string): Resource | undefined {
  return getAllResources().find(r => r.id === id);
}

// ---------------------------------------------------------------------------
// Structured eligibility
// ---------------------------------------------------------------------------

export function getRules(): EligibilityRules[] {
  return readJson<{ rules: EligibilityRules[] }>('eligibility-rules.json').rules;
}

export function getRulesFor(id: string): EligibilityRules | null {
  return getRules().find(r => r.resource_id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Staff-verified overlay. Read fresh every time: case workers write to it during a session.
// ---------------------------------------------------------------------------

function verificationsPath(): string {
  return path.join(DATA_DIR, 'verifications.json');
}

export function readVerifications(): Verification[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(verificationsPath(), 'utf-8'));
    return Array.isArray(parsed.verifications) ? parsed.verifications : [];
  } catch {
    return [];
  }
}

export function appendVerification(v: Verification): Verification {
  const file = verificationsPath();
  let doc: { about?: string; verifications: Verification[] } = { verifications: [] };
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    // Start a fresh file.
  }
  doc.verifications = [...(doc.verifications ?? []), v];
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
  return v;
}

function latestVerification(id: string, all: Verification[]): Verification | null {
  const mine = all.filter(v => v.resource_id === id);
  if (mine.length === 0) return null;
  // Same-day entries keep file order, so the last one logged wins.
  return mine.reduce((latest, v) => (v.date >= latest.date ? v : latest));
}

// ---------------------------------------------------------------------------
// Directory entries with derived warnings
// ---------------------------------------------------------------------------

export function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`).getTime();
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - from) / 86_400_000);
}

function deriveWarnings(r: Resource, latest: Verification | null, now: Date): Warning[] {
  const tags = getTags();
  const warnings: Warning[] = [];
  if (!r.verified_date || daysBetween(r.verified_date, now) > tags.stale_after_days) warnings.push('stale');
  if (tags.conflict.includes(r.id)) warnings.push('conflict');
  if (r.referral_required === true) warnings.push('referral_only');
  if (r.confidence !== 'high' && r.confidence !== 'medium') warnings.push('low_confidence');
  if (r.is_confidential_address) warnings.push('confidential_location');
  if (latest && latest.outcome !== 'confirmed') warnings.push('staff_reported_problem');
  return warnings;
}

export function getDirectory(now: Date = new Date()): DirectoryEntry[] {
  const verifications = readVerifications();
  return getAllResources().map(r => {
    const latest = latestVerification(r.id, verifications);
    return {
      ...r,
      rules: getRulesFor(r.id),
      warnings: deriveWarnings(r, latest, now),
      latest_verification: latest,
      confidential_location: Boolean(r.is_confidential_address),
    };
  });
}

/** A directory entry without its structured rules: what the browser and Claude get to see. */
export function withoutRules(entry: DirectoryEntry): Omit<DirectoryEntry, 'rules'> {
  const copy: Partial<DirectoryEntry> = { ...entry };
  delete copy.rules;
  return copy as Omit<DirectoryEntry, 'rules'>;
}

export function getDirectoryEntry(id: string, now: Date = new Date()): DirectoryEntry | undefined {
  return getDirectory(now).find(e => e.id === id);
}

// ---------------------------------------------------------------------------
// Gap register
// ---------------------------------------------------------------------------

export function getGapRegister(): GapEntry[] {
  return readJson<{ gaps: GapEntry[] }>('gap-register.json').gaps;
}

// ---------------------------------------------------------------------------
// Scenarios (made-up clients)
// ---------------------------------------------------------------------------

export function getClientScenarios(): ScenarioText[] {
  return readJson<{ scenarios: ScenarioText[] }>('client-scenarios.json').scenarios;
}

export function getScenarioProfiles(): IntakeProfile[] {
  return readJson<{ profiles: IntakeProfile[] }>('scenario-profiles.json').profiles;
}

export function getScenarioProfile(id: string): IntakeProfile | undefined {
  return getScenarioProfiles().find(p => p.id.toUpperCase() === id.toUpperCase());
}

// ---------------------------------------------------------------------------
// Catalog filtering for /api/resources
// ---------------------------------------------------------------------------

export interface ResourceFilters {
  category?: string;
  city?: string;
  id?: string;
  search?: string;
}

export function filterResources(filters: ResourceFilters): Resource[] {
  let list = getAllResources();

  if (filters.id) {
    return list.filter(r => r.id === filters.id);
  }

  if (filters.category && filters.category !== 'all') {
    const cat = filters.category.toLowerCase();
    list = list.filter(r => r.category.toLowerCase() === cat || r.tags.some(t => t.toLowerCase() === cat));
  }

  if (filters.city) {
    const city = filters.city.toLowerCase();
    list = list.filter(r => r.city && r.city.toLowerCase().includes(city));
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.organization.toLowerCase().includes(q) ||
        r.services.some(s => s.toLowerCase().includes(q))
    );
  }

  return list;
}
