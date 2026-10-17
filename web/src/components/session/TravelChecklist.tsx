'use client';

import { useState } from 'react';
import { StepState, TravelStep } from '@/types';
import { SectionLabel } from '@/components/ui';

const STATES: { value: StepState; label: string }[] = [
  { value: 'done', label: 'Done' },
  { value: 'not_done', label: 'Not done' },
  { value: 'unknown', label: 'Unknown' },
];

/** Travel home is a process, not a directory hit (architecture 4.7). Nothing here is sent. */
export function TravelChecklist({ steps: initial }: { steps: TravelStep[] }) {
  const [steps, setSteps] = useState(initial);
  return (
    <section className="space-y-3">
      <SectionLabel>Travel-home checklist</SectionLabel>
      <ol className="m-0 list-none space-y-2 p-0">
        {steps.map((s, i) => (
          <li key={s.id} className="panel flex flex-wrap items-start justify-between gap-3 p-4 text-[14px]">
            <div className="min-w-0 flex-1">
              <div className="font-bold">
                {i + 1}. {s.label}
              </div>
              <div>{s.note}</div>
            </div>
            <div role="radiogroup" aria-label={s.label} className="flex gap-1">
              {STATES.map(st => (
                <button
                  key={st.value}
                  type="button"
                  role="radio"
                  aria-checked={s.state === st.value}
                  onClick={() => setSteps(all => all.map(x => (x.id === s.id ? { ...x, state: st.value } : x)))}
                  className={`min-h-11 border-2 border-navy px-3 text-[13px] font-semibold ${s.state === st.value ? 'on-dark bg-dark' : 'bg-white'}`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
