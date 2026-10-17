'use client';

import { useEffect, useState } from 'react';
import { SafetyResult } from '@/types';
import { Button, Eyebrow } from '@/components/ui';

/** Leaves for a neutral page and drops this tab's history entry. Assume a shared device. */
export function quickExit() {
  window.location.replace('https://www.weather.gov/');
}

/**
 * Safety exit (handoff: full navy, Quick exit top right, 9-1-1 set large, no places shown).
 * The medicine route uses indigo and simply points to the care team.
 */
export function SafetyScreen({ safety, onDone }: { safety: SafetyResult; onDone: () => void }) {
  const [done, setDone] = useState<boolean[]>(() => safety.staff_steps.map(() => false));
  const allDone = done.every(Boolean);
  const medical = safety.route === 'medical';

  useEffect(() => {
    if (medical) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && quickExit();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [medical]);

  return (
    <section className={`on-dark p-6 sm:p-8 ${medical ? 'bg-indigo' : 'bg-dark'}`} aria-live="assertive">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Eyebrow>{medical ? 'Medicine question' : safety.route === 'crisis' ? 'Crisis support' : 'Safety first'}</Eyebrow>
          <h2 className="question m-0">{safety.message}</h2>
        </div>
        {!medical && (
          <Button variant="secondary" size="sm" className="shrink-0" onClick={quickExit}>
            Quick exit
          </Button>
        )}
      </div>

      {safety.lines.length > 0 && (
        <ul className="m-0 mt-6 list-none space-y-3 p-0">
          {safety.lines.map(line => (
            <li key={line.phone}>
              <div className="text-[14px]">{line.name}</div>
              <a href={`tel:${line.phone.replace(/[^\d]/g, '')}`} className="phone-number no-underline">
                {line.phone}
              </a>
              {line.hours && <div className="text-[14px]">{line.hours}</div>}
            </li>
          ))}
        </ul>
      )}

      {safety.missing.map(m => (
        <p key={m} className="m-0 mt-4 border-2 border-yellow p-3 text-[15px] font-semibold">
          {m}
        </p>
      ))}

      <div className="mt-6 space-y-2">
        <div className="eyebrow">Staff steps</div>
        <ul className="m-0 list-none space-y-1 p-0">
          {safety.staff_steps.map((step, i) => (
            <li key={step}>
              <label className="flex min-h-11 items-start gap-3 text-[15px]">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-yellow"
                  checked={done[i]}
                  onChange={e => setDone(d => d.map((v, j) => (j === i ? e.target.checked : v)))}
                />
                {step}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <p className="m-0 mt-4 text-[14px]">Triggered by: {safety.triggers.join('; ')}. No places, addresses, printout or text draft on this path.</p>

      <div className="mt-6">
        {/* "Mark safe" stays outlined until every step is done (handoff). */}
        <Button variant={allDone ? 'primary' : 'secondary'} disabled={!allDone} onClick={onDone}>
          {medical ? 'Done: back to intake' : 'Mark safe and clear the screen'}
        </Button>
      </div>
    </section>
  );
}
