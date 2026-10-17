import { Resource } from '@/types';
import { getRawResources } from '@/lib/resources/loader';

/**
 * Fetch allowlist (architecture 3b). Organizations' own pages and sources whose terms allow reuse.
 * Blocked sources are never fetched, and a block or bot check is never worked around.
 */

export const BLOCKED: { domain: string; reason: string }[] = [
  { domain: 'findhelp.org', reason: 'Terms forbid screen-scraping and storing or compiling its materials.' },
  { domain: '211oc.org', reason: 'No terms text, Crawl-delay: 10, "ask before any automated use". Ask Orange County United Way.' },
  { domain: 'ocnavigator.org', reason: 'robots.txt disallows /m/ocn/.' },
  { domain: 'caloptima.org', reason: 'Blocks automated requests (429). Staff check this by hand.' },
  { domain: 'kiva.org', reason: 'Blocks automated requests. Staff check this by hand.' },
  { domain: 'score.org', reason: 'Blocks automated requests. Staff check this by hand.' },
  { domain: 'anaheim.net', reason: 'Blocks automated requests (403). Staff check this by hand.' },
  { domain: 'costamesaca.gov', reason: 'Answers only to browser-like headers. Staff check this by hand rather than faking a browser.' },
  { domain: 'swcommunitycenter.org', reason: 'Domain no longer belongs to the organization (unrelated content).' },
  { domain: 'someonecareskitchen.org', reason: 'Domain no longer belongs to the organization (redirect).' },
];

/** Sources named in the architecture beyond the seed's own URLs. */
const EXTRA_ALLOWED_HOSTS = ['findtreatment.gov', 'sba.gov', 'ceo.oc.gov', 'capoc.org'];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function blockedReason(url: string): string | null {
  const host = hostOf(url);
  if (!host) return 'Not a valid URL.';
  return BLOCKED.find(b => matchesDomain(host, b.domain))?.reason ?? null;
}

let allowedHosts: Set<string> | null = null;

function getAllowedHosts(): Set<string> {
  if (!allowedHosts) {
    const fromSeed = getRawResources()
      .flatMap(r => [r.source_url, r.website])
      .filter((u): u is string => Boolean(u))
      .filter(u => blockedReason(u) === null)
      .map(hostOf)
      .filter((h): h is string => Boolean(h));
    allowedHosts = new Set([...fromSeed, ...EXTRA_ALLOWED_HOSTS]);
  }
  return allowedHosts;
}

/** Null when the URL may be fetched; otherwise the reason it may not. */
export function refusalFor(url: string): string | null {
  const blocked = blockedReason(url);
  if (blocked) return blocked;
  const host = hostOf(url)!;
  if (!new URL(url).protocol.startsWith('http')) return 'Only http(s) pages are fetched.';
  const ok = [...getAllowedHosts()].some(allowed => matchesDomain(host, allowed));
  return ok ? null : `${host} is not on the fetch allowlist.`;
}

/** The page a re-check reads: the record's own source page, else its website. */
export function recheckUrl(resource: Resource): string | null {
  return resource.source_url ?? resource.website;
}
