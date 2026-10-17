import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { refusalFor } from './allowlist';

/**
 * Fetcher (architecture 3b). Plain code: allowlist only, respects robots.txt and crawl delays,
 * saves a dated snapshot, and says whether the page changed since the last one.
 */

const USER_AGENT = 'NextDoorRecheck/0.1 (IHH hackathon prototype; every change is reviewed by staff)';
const UA_TOKEN = 'nextdoorrecheck';
const TIMEOUT_MS = 15_000;
const SNAPSHOT_DIR = path.join(process.cwd(), '.snapshots');

export interface FetchResult {
  ok: boolean;
  refused_reason: string | null;
  http_status: number | null;
  final_url: string | null;
  text: string;
  changed_since_last: boolean | null;
}

interface RobotsRules {
  allow: string[];
  disallow: string[];
  crawlDelaySec: number;
}

const lastFetchByHost = new Map<string, number>();

/** Minimal robots.txt reader: the group for our agent if present, else `*`. Longest match wins. */
export function parseRobots(body: string): RobotsRules {
  const groups: { agents: string[]; rules: RobotsRules }[] = [];
  let current: { agents: string[]; rules: RobotsRules } | null = null;
  let lastWasAgent = false;

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: { allow: [], disallow: [], crawlDelaySec: 0 } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' && value) current.rules.allow.push(value);
    if (key === 'disallow' && value) current.rules.disallow.push(value);
    if (key === 'crawl-delay') current.rules.crawlDelaySec = Number(value) || 0;
  }

  const mine = groups.find(g => g.agents.includes(UA_TOKEN));
  return (mine ?? groups.find(g => g.agents.includes('*')))?.rules ?? { allow: [], disallow: [], crawlDelaySec: 0 };
}

export function robotsAllows(rules: RobotsRules, pathname: string): boolean {
  const longest = (list: string[]) =>
    Math.max(-1, ...list.filter(p => pathname.startsWith(p.replace(/\*.*$/, '').replace(/\$$/, ''))).map(p => p.length));
  return longest(rules.allow) >= longest(rules.disallow);
}

async function timedFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function readRobots(origin: string): Promise<RobotsRules | 'unreachable'> {
  try {
    const res = await timedFetch(`${origin}/robots.txt`);
    // RFC 9309: a 4xx robots.txt means no rules; a 5xx means assume everything is disallowed.
    if (res.status >= 500) return 'unreachable';
    if (!res.ok) return { allow: [], disallow: [], crawlDelaySec: 0 };
    return parseRobots(await res.text());
  } catch {
    return 'unreachable';
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?(p|div|br|li|tr|h[1-6]|section|article|header|footer|table|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function saveSnapshot(resourceId: string, text: string, now: Date): boolean | null {
  const dir = path.join(SNAPSHOT_DIR, resourceId.replace(/[^a-z0-9-]/gi, '_'));
  fs.mkdirSync(dir, { recursive: true });
  const previous = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort().pop();
  const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
  const changed = previous ? hash(fs.readFileSync(path.join(dir, previous), 'utf-8')) !== hash(text) : null;
  fs.writeFileSync(path.join(dir, `${now.toISOString().slice(0, 10)}.txt`), text, 'utf-8');
  return changed;
}

function refused(reason: string, status: number | null = null): FetchResult {
  return { ok: false, refused_reason: reason, http_status: status, final_url: null, text: '', changed_since_last: null };
}

export async function fetchListing(resourceId: string, url: string, now: Date = new Date()): Promise<FetchResult> {
  const refusal = refusalFor(url);
  if (refusal) return refused(refusal);

  const { origin, hostname, pathname } = new URL(url);
  const robots = await readRobots(origin);
  if (robots === 'unreachable') return refused('robots.txt could not be read, so the page is not fetched. Staff check by hand.');
  if (!robotsAllows(robots, pathname)) return refused('robots.txt disallows this page.');

  const last = lastFetchByHost.get(hostname);
  const waitMs = robots.crawlDelaySec * 1000 - (last ? now.getTime() - last : Infinity);
  if (waitMs > 0) return refused(`Crawl delay for ${hostname}: try again in ${Math.ceil(waitMs / 1000)} seconds.`);
  lastFetchByHost.set(hostname, now.getTime());

  let res: Response;
  try {
    res = await timedFetch(url);
  } catch (error) {
    return refused(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // A redirect to a different site can mean the domain changed hands. Check where we landed.
  const landed = refusalFor(res.url);
  if (landed) return { ...refused(`Redirected to ${res.url}: ${landed}`, res.status), final_url: res.url };
  if ([401, 403, 406, 429].includes(res.status)) {
    return refused(`The site blocked the request (HTTP ${res.status}). Do not work around it; staff check by hand.`, res.status);
  }
  if (!res.ok) return refused(`HTTP ${res.status}: the link may be broken.`, res.status);

  const type = res.headers.get('content-type') ?? '';
  if (!/text\/(html|plain)/i.test(type)) return refused(`Not an HTML page (${type || 'unknown type'}). Staff check by hand.`, res.status);

  const text = htmlToText(await res.text());
  return { ok: true, refused_reason: null, http_status: res.status, final_url: res.url, text, changed_since_last: saveSnapshot(resourceId, text, now) };
}
