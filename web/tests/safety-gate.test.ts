import { describe, it, expect } from 'vitest';
import { runSafetyGate } from '@/lib/safety/gate';

const calm = { feels_unsafe: false, crisis: false };

describe('Safety gate (runs before any search)', () => {
  it('C10: danger words stop the search and show no places', () => {
    const r = runSafetyGate({ client_words: "I can't go back there. He'll find me.", safety: calm });
    expect(r.route).toBe('danger');
    expect(r.stop).toBe(true);
    expect(r.lines.every(l => !('address' in l))).toBe(true);
    expect(r.missing.join(' ')).toMatch(/no domestic violence hotline/i);
  });

  it('the case worker’s "feels unsafe" checkbox alone triggers the danger path', () => {
    const r = runSafetyGate({ client_words: '', safety: { feels_unsafe: true, crisis: false } });
    expect(r.route).toBe('danger');
  });

  it('C01: "can’t go back under the bridge" is not a danger phrase', () => {
    const r = runSafetyGate({ client_words: "They say I'm done here Friday. I can't go back under the bridge with this leg. Where do I go?", safety: calm });
    expect(r.route).toBe('ok');
    expect(r.stop).toBe(false);
  });

  it('C11: a medicine question goes to the care team, never answered', () => {
    const r = runSafetyGate({ client_words: 'These water pills make me dizzy. Can I just stop taking them?', safety: calm });
    expect(r.route).toBe('medical');
    expect(r.stop).toBe(true);
    expect(r.message).toMatch(/nurse or care team/i);
  });

  it('crisis words route to 988 and OC Links from the directory', () => {
    const r = runSafetyGate({ client_words: 'Some days I want to die.', safety: calm });
    expect(r.route).toBe('crisis');
    expect(r.lines.map(l => l.resource_id)).toEqual(expect.arrayContaining(['988-suicide-and-crisis-lifeline', 'oc-links']));
  });

  it('Spanish danger and medicine words are caught too', () => {
    expect(runSafetyGate({ client_words: 'Tengo miedo, me pega cuando bebe.', safety: calm }).route).toBe('danger');
    expect(runSafetyGate({ client_words: '¿Puedo dejar las pastillas?', safety: calm }).route).toBe('medical');
  });

  it('C02: plain Spanish about work does not trip the gate', () => {
    const r = runSafetyGate({ client_words: 'Yo sé trabajar. Solo necesito como dos mil dólares para el equipo y el permiso.', safety: calm });
    expect(r.route).toBe('ok');
    expect(r.notices).toEqual([]);
  });

  it('legal and immigration questions add a notice but do not block the plan', () => {
    const r = runSafetyGate({ client_words: 'Can I get my record expunged? And will immigration find out?', safety: calm });
    expect(r.stop).toBe(false);
    expect(r.notices).toHaveLength(2);
    expect(r.notices.join(' ')).toMatch(/does not give legal advice/);
  });
});
