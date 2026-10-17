import { describe, it, expect } from 'vitest';
import { refusalFor } from '@/lib/offline/allowlist';
import { htmlToText, parseRobots, robotsAllows } from '@/lib/offline/fetcher';
import { extractWithRules } from '@/lib/offline/extractor';
import { verifyExtraction } from '@/lib/offline/verifier';
import { getResourceById } from '@/lib/resources/loader';

const yale = getResourceById('yale-navigation-center')!;

describe('Offline pipeline: Fetcher → Extractor → Verifier', () => {
  describe('allowlist', () => {
    it('refuses every blocked source from the architecture, including subdomains', () => {
      for (const url of ['https://www.findhelp.org/x', 'https://211oc.org/providers/', 'https://www.ocnavigator.org/m/ocn/', 'https://www.caloptima.org/en', 'https://www.costamesaca.gov/x', 'https://swcommunitycenter.org']) {
        expect(refusalFor(url), url).not.toBeNull();
      }
    });

    it('allows a seed record’s own source page', () => {
      expect(refusalFor(yale.source_url!)).toBeNull();
    });

    it('refuses a host that is on neither list', () => {
      expect(refusalFor('https://example.com/shelters')).toMatch(/not on the fetch allowlist/);
    });
  });

  describe('robots.txt', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /m/ocn/\nAllow: /m/ocn/public\nCrawl-delay: 10\n');

    it('applies disallow rules, with the longest match winning', () => {
      expect(robotsAllows(rules, '/m/ocn/listing')).toBe(false);
      expect(robotsAllows(rules, '/m/ocn/public/page')).toBe(true);
      expect(robotsAllows(rules, '/about')).toBe(true);
      expect(rules.crawlDelaySec).toBe(10);
    });

    it('prefers a group addressed to our agent over the * group', () => {
      const r = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: NextDoorRecheck\nDisallow:\n');
      expect(robotsAllows(r, '/anything')).toBe(true);
    });
  });

  it('turns HTML into text without scripts and with entities decoded', () => {
    const text = htmlToText('<html><script>var x=1</script><p>Call&nbsp;(800)&#32;364-2221</p><div>Mon &amp; Wed</div></html>');
    expect(text).toBe('Call (800) 364-2221\nMon & Wed');
  });

  it('a known phone number is not reported as a change; a new one is, and its quote is checked', () => {
    const page = 'Yale Navigation Center\nReferrals: (800) 364-2221\nNew intake line: (714) 555-0100';
    const result = verifyExtraction(extractWithRules(page, yale), page, yale);
    const known = result.proposals.find(p => p.proposed === '(800) 364-2221')!;
    const fresh = result.proposals.find(p => p.proposed === '(714) 555-0100')!;
    expect(known.changed).toBe(false);
    expect(fresh.changed).toBe(true);
    expect(fresh.quote_found).toBe(true);
    expect(fresh.format_ok).toBe(true);
  });

  it('a quote that is not on the page is marked as not found', () => {
    const result = verifyExtraction(
      { fields: [{ field: 'phone', value: '(714) 555-0100', quote: 'Call us at (714) 555-0100' }], needs: [], flags: [] },
      'A page that says something else.',
      yale
    );
    expect(result.proposals[0].quote_found).toBe(false);
  });

  it('flags closure wording and a page that never names the organization', () => {
    const closed = extractWithRules('Yale Navigation Center has closed. Thank you.', yale);
    expect(closed.flags.map(f => f.kind)).toContain('closure');
    const hijacked = extractWithRules('Best online casino bonuses 2026.', yale);
    expect(hijacked.flags.map(f => f.kind)).toContain('hijacked_domain');
  });
});
