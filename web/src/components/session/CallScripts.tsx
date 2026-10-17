'use client';

import { useState } from 'react';
import { PlanStep, SessionResult } from '@/types';
import { Button, SectionLabel } from '@/components/ui';

/** Turns case-worker notes into questions for the provider; internal notes don't belong in a call. */
function toQuestion(note: string): string {
  return note.startsWith('Eligibility is not structured') ? 'Who is eligible, and what should the client bring?' : note;
}

function script(name: string, asks: string[]): string {
  const questions = asks.length ? [...new Set(asks.map(toQuestion))].map(a => `- ${a}`).join('\n') : '- Is the program taking new people right now?';
  return `Hello, I'm a case worker at Illumination Health + Home. I'm calling about a client leaving recuperative care who may need ${name}. I'd like to check a few things:\n${questions}\nThank you. Who should the client ask for?`;
}

/** Call checklist and scripts: drafts only. The case worker copies them; the tool sends nothing. */
export function CallScripts({ steps, records }: { steps: PlanStep[]; records: SessionResult['records'] }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (steps.length === 0) return null;

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section className="space-y-3">
      <SectionLabel>Call checklist and scripts</SectionLabel>
      <p className="m-0 text-[14px]">Drafts only. Nothing is sent.</p>
      <ul className="m-0 list-none space-y-3 p-0">
        {steps.map(step => {
          const r = records[step.resource_id];
          if (!r) return null;
          const text = script(r.name, step.unknowns_to_ask);
          return (
            <li key={step.resource_id} className="panel-soft space-y-2 p-4 text-[14px]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold">{r.name}</span>
                <span className="font-bold tabular-nums">{r.phone ?? 'No phone listed'}</span>
              </div>
              <pre className="m-0 whitespace-pre-wrap font-sans">{text}</pre>
              <Button variant="link" onClick={() => copy(step.resource_id, text)}>
                {copied === step.resource_id ? 'Copied' : 'Copy script'}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
