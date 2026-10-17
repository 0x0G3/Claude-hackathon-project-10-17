import fs from 'fs';
import path from 'path';
import { Resource, ClientProfile } from '@/types';

let cachedResources: Resource[] | null = null;
let cachedScenarios: ClientProfile[] | null = null;

function sanitizeResource(resource: Resource): Resource {
  const isSurvivorOrConfidential = Boolean(
    resource.tags.some(t =>
      ['domestic-violence', 'survivors', 'human-trafficking', 'confidential'].includes(
        t.toLowerCase()
      )
    ) ||
    resource.population.some(p =>
      p.toLowerCase().includes('survivor') || p.toLowerCase().includes('domestic violence')
    ) ||
    (resource.notes && resource.notes.toLowerCase().includes('confidential'))
  );

  if (isSurvivorOrConfidential && resource.address) {
    return {
      ...resource,
      address: '[Confidential Location - Disclosed directly upon verified referral]',
      is_confidential_address: true,
    };
  }

  return {
    ...resource,
    is_confidential_address: isSurvivorOrConfidential,
  };
}

export function getAllResources(): Resource[] {
  if (cachedResources) {
    return cachedResources;
  }

  const dataPath = path.join(process.cwd(), 'src', 'data', 'oc-resources.seed.json');
  if (!fs.existsSync(dataPath)) {
    console.warn(`Resource seed file not found at ${dataPath}`);
    return [];
  }

  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const resources: Resource[] = (parsed.resources || []).map(sanitizeResource);
    cachedResources = resources;
    return resources;
  } catch (error) {
    console.error('Error loading resources:', error);
    return [];
  }
}

export function getResourceById(id: string): Resource | undefined {
  const all = getAllResources();
  return all.find(r => r.id === id);
}

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
    list = list.filter(r => {
      // Direct category match
      if (r.category.toLowerCase() === cat) return true;
      // Tag match
      if (r.tags.some(t => t.toLowerCase() === cat)) return true;
      // Microloans maps to microenterprise category
      if (cat === 'microloans' && r.category === 'microenterprise') return true;
      if (cat === 'travel' && r.category === 'family-reunification-travel') return true;
      return false;
    });
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

export function getClientScenarios(): ClientProfile[] {
  if (cachedScenarios) {
    return cachedScenarios;
  }

  const scenarioPath = path.join(process.cwd(), 'src', 'data', 'client-scenarios.json');
  if (!fs.existsSync(scenarioPath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(scenarioPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const scenarios: ClientProfile[] = parsed.scenarios || [];
    cachedScenarios = scenarios;
    return scenarios;
  } catch (error) {
    console.error('Error loading client scenarios:', error);
    return [];
  }
}

export function getClientScenarioById(id: string): ClientProfile | undefined {
  const scenarios = getClientScenarios();
  return scenarios.find(s => s.id.toUpperCase() === id.toUpperCase());
}
