'use client';

import { useState } from 'react';
import { PlanLine } from '@/types';
import { Button, SectionLabel, formatCheckedDate } from '@/components/ui';

const COPY = {
  en: { today: 'What to do today', week: 'This week', footer: (d: string) => `Information checked on ${d}. Programs change. If something is wrong, tell your case worker.`, staff: 'English, for staff' },
  es: { today: 'Qué hacer hoy', week: 'Esta semana', footer: (d: string) => `Información revisada el ${d}. Los programas cambian. Si algo está mal, dígale a su trabajador social.`, staff: 'English, for staff' },
};

function Group({ title, lines }: { title: string; lines: PlanLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="m-0 font-sans text-[1.1em] font-bold">{title}</h3>
      <ol className="m-0 list-outside list-decimal space-y-2 pl-6">
        {lines.map((l, i) => (
          <li key={i}>{l.text}</li>
        ))}
      </ol>
    </div>
  );
}

/** One action per line: today first, then this week. */
function Lines({ lines, lang }: { lines: PlanLine[]; lang: 'en' | 'es' }) {
  const t = COPY[lang];
  return (
    <>
      <Group title={t.today} lines={lines.filter(l => l.when === 'today')} />
      <Group title={t.week} lines={lines.filter(l => l.when === 'this_week')} />
    </>
  );
}

/**
 * Client take-home plan (architecture 4.10). Prints and copies only after every item is ticked or
 * removed (4.9). The print copy carries the English version below for staff.
 */
export function ClientPlanView({
  language,
  lines,
  englishLines,
  checkedOn,
  largePrint,
  remaining,
}: {
  language: string;
  lines: PlanLine[];
  englishLines: PlanLine[];
  checkedOn: string;
  largePrint: boolean;
  remaining: number;
}) {
  const [copied, setCopied] = useState(false);
  const lang = language === 'es' ? 'es' : 'en';
  const date = formatCheckedDate(checkedOn) ?? checkedOn;
  const ready = remaining === 0;

  const plain = [...lines.filter(l => l.when === 'today'), ...lines.filter(l => l.when === 'this_week')]
    .map((l, i) => `${i + 1}. ${l.text}`)
    .concat('', COPY[lang].footer(date))
    .join('\n');

  const body = (
    <div className={`space-y-4 ${largePrint ? 'large-print' : 'text-[17px]'}`}>
      <Lines lines={lines} lang={lang} />
      {englishLines.length > 0 && (
        <div className="space-y-2 border-t-2 border-navy pt-3 text-[0.85em]">
          <div className="eyebrow">{COPY[lang].staff}</div>
          <Lines lines={englishLines} lang="en" />
        </div>
      )}
      <p className="m-0 border-t-2 border-navy pt-3 text-[0.85em]">{COPY[lang].footer(date)}</p>
    </div>
  );

  return (
    <>
      <section className="no-print space-y-3">
        <SectionLabel>Take-home plan preview</SectionLabel>
        <div className="panel p-5">{body}</div>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg" disabled={!ready} onClick={() => window.print()}>
            Print plan
          </Button>
          <Button
            variant="secondary"
            disabled={!ready}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(plain);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Copied' : 'Copy as text'}
          </Button>
          <span className="text-[14px]">
            {ready ? 'Nothing is sent. Hand over the printout or the copied text.' : `Tick or remove every item first (${remaining} left).`}
          </span>
        </div>
      </section>
      {ready && <div className="print-only">{body}</div>}
    </>
  );
}
