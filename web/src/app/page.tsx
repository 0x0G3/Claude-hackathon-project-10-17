'use client';

import { useMemo, useState } from 'react';
import { IntakeProfile, MatchItem, PlanLine, PlanStep, SessionResult, Verification } from '@/types';
import { Eyebrow, SectionLabel, TopBar } from '@/components/ui';
import { IntakeForm } from '@/components/session/IntakeForm';
import { SafetyScreen } from '@/components/session/SafetyScreen';
import { Blockers } from '@/components/session/Blockers';
import { ReviewCard } from '@/components/session/ReviewCard';
import { OtherOptions } from '@/components/session/OtherOptions';
import { TravelChecklist } from '@/components/session/TravelChecklist';
import { CallScripts } from '@/components/session/CallScripts';
import { ClientPlanView } from '@/components/session/ClientPlanView';
import { BLANK_PROFILE, NEED_LABEL } from '@/components/session/labels';

type Records = SessionResult['records'];

/** A plan line for a listing the case worker added by hand. Facts come straight from the record. */
function addedLine(r: Records[string], lang: string): PlanLine {
  const es = lang === 'es';
  const referral = r.warnings.includes('referral_only') ? (es ? ' No vaya a la dirección sin una referencia.' : ' Do not go to the address without a referral.') : '';
  const text = r.phone
    ? es ? `Llame a ${r.name}: ${r.phone}.${referral}` : `Call ${r.name}: ${r.phone}.${referral}`
    : es ? `Pregunte a su trabajador social cómo comunicarse con ${r.name}.` : `Ask your case worker how to reach ${r.name}.`;
  return { when: 'this_week', resource_id: r.id, text };
}

export default function SessionPage() {
  const [profile, setProfile] = useState<IntakeProfile>(BLANK_PROFILE);
  const [useAi, setUseAi] = useState(false);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [records, setRecords] = useState<Records>({});
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<{ need: string; id: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearSession = () => {
    setResult(null);
    setRecords({});
    setTicked(new Set());
    setRemoved(new Set());
    setAdded([]);
    setNotice(null);
    setError(null);
  };

  const run = async () => {
    setLoading(true);
    clearSession();
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, useAi }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'The session failed.');
      setResult(data.data);
      setRecords(data.data.records);
      setNotice(data.notice ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The session failed.');
    } finally {
      setLoading(false);
    }
  };

  const matchFor = (id: string): MatchItem | null => {
    for (const n of result?.matches?.needs ?? []) {
      const found = n.items.find(i => i.resource_id === id);
      if (found) return found;
    }
    return null;
  };

  const planSteps: PlanStep[] = useMemo(() => result?.plan?.questions.flatMap(q => q.steps) ?? [], [result]);
  const activeIds = useMemo(() => {
    const ids = new Set([...planSteps.map(s => s.resource_id), ...added.map(a => a.id)]);
    return [...ids].filter(id => !removed.has(id));
  }, [planSteps, added, removed]);
  const remaining = activeIds.filter(id => !ticked.has(id)).length;

  const planLines = (lines: PlanLine[], lang: string) => [
    ...lines.filter(l => !l.resource_id || !removed.has(l.resource_id)),
    ...added.filter(a => !removed.has(a.id) && records[a.id]).map(a => addedLine(records[a.id], lang)),
  ];

  const setIn = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  const onVerified = (v: Verification) =>
    setRecords(prev => {
      const r = prev[v.resource_id];
      if (!r) return prev;
      const warnings = v.outcome === 'confirmed' ? r.warnings.filter(w => w !== 'staff_reported_problem') : [...new Set([...r.warnings, 'staff_reported_problem' as const])];
      return { ...prev, [v.resource_id]: { ...r, latest_verification: v, warnings } };
    });

  const card = (id: string, step: PlanStep | null, addedByCaseWorker = false) =>
    records[id] ? (
      <ReviewCard
        key={id}
        record={records[id]}
        step={step}
        match={matchFor(id)}
        ticked={ticked.has(id)}
        removed={removed.has(id)}
        addedByCaseWorker={addedByCaseWorker}
        useAi={useAi}
        onTick={v => setTicked(t => setIn(t, id, v))}
        onRemove={v => {
          setRemoved(r => setIn(r, id, v));
          if (v) setTicked(t => setIn(t, id, false));
        }}
        onVerified={onVerified}
      />
    ) : null;

  const stopped = result?.status === 'stopped_by_safety';

  return (
    <>
      <div className="no-print">
        <TopBar label="Next Door · case manager">
          <span className="text-[13px]">Directory: 40 listings checked {result?.checked_on ?? '2026-10-13'}</span>
          <span className="text-[13px]">Nothing is sent</span>
        </TopBar>
      </div>

      <main className="mx-auto max-w-content space-y-10 px-gutter py-8">
        <header className="no-print space-y-2">
          <Eyebrow>Illumination Health + Home · recuperative care discharge</Eyebrow>
          <h1 className="m-0 text-[32px] leading-[1.15] sm:text-[40px]">Plan the next door</h1>
          <p className="m-0 max-w-text">
            The case worker drives; the client takes home the plan. Safety checks and eligibility run as plain code first. Claude only explains and phrases, and every phone number, address and hour is checked against the directory.
          </p>
        </header>

        {!result && (
          <div className="no-print">
            <IntakeForm
              profile={profile}
              onChange={setProfile}
              useAi={useAi}
              onUseAiChange={setUseAi}
              onSubmit={run}
              loading={loading}
            />
          </div>
        )}

        {error && <p className="no-print panel m-0 p-4 font-semibold">{error}</p>}

        {result && stopped && (
          <div className="no-print">
            <SafetyScreen
              safety={result.safety}
              onDone={() => {
                clearSession();
                setProfile(BLANK_PROFILE);
              }}
            />
          </div>
        )}

        {result && !stopped && (
          <div className="space-y-10">
            <div className="no-print flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-[13px]">
                <span className="tag">Planner: {result.engine.planner === 'claude' ? 'Claude' : 'rules'}</span>
                <span className="tag">Writer: {result.engine.writer === 'claude' ? 'Claude' : 'rules'}</span>
                <span className={`tag ${result.fact_check.passed ? '' : 'tag-dark'}`}>
                  Fact check: {result.fact_check.passed ? 'passed' : 'failed'}
                  {result.fact_check.writer_attempts > 1 ? ` (after ${result.fact_check.writer_attempts} tries)` : ''}
                </span>
              </div>
              <button type="button" className="btn-link" onClick={clearSession}>
                ← Back to intake
              </button>
            </div>

            {notice && <p className="no-print panel-soft m-0 p-4 text-[14px]">{notice}</p>}
            {result.safety.notices.map(n => (
              <p key={n} className="no-print panel m-0 p-4 text-[15px] font-semibold">
                {n}
              </p>
            ))}
            {result.fact_check.planner_rejected.length > 0 && (
              <details className="no-print panel-soft p-4 text-[14px]">
                <summary className="cursor-pointer font-semibold">Claude’s plan was set aside; the rules planner wrote this one</summary>
                <ul className="m-0 mt-2 list-outside list-disc pl-5">
                  {result.fact_check.planner_rejected.map(p => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </details>
            )}
            {result.status === 'could_not_generate_safely' && (
              <div className="no-print on-dark bg-dark space-y-2 p-5">
                <div className="eyebrow text-yellow">Could not generate safely</div>
                <p className="m-0">The take-home plan failed the fact check twice, so it is not shown. The checked listings below are still accurate.</p>
                <ul className="m-0 list-outside list-disc pl-5 text-[14px]">
                  {result.fact_check.problems.map(p => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {(result.plan?.ordering_notes.length ?? 0) > 0 && (
              <ul className="no-print panel-soft m-0 list-outside list-disc space-y-1 p-4 pl-9 text-[15px]">
                {result.plan!.ordering_notes.map(n => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}

            <div className="no-print">
              <Blockers blockers={result.prerequisites} />
            </div>

            {result.plan?.questions.map(q => {
              const need = result.matches?.needs.find(n => n.need === q.question);
              const inPlan = new Set([...planSteps.map(s => s.resource_id), ...added.map(a => a.id)]);
              const extras = added.filter(a => a.need === q.question);
              return (
                <section key={q.question} className="no-print space-y-4">
                  <SectionLabel>{NEED_LABEL[q.question] ?? q.question}</SectionLabel>
                  {need?.no_sure_door && (
                    <p className="on-dark bg-dark m-0 p-4 text-[15px]">
                      <span className="font-bold">No sure door.</span> No high-confidence listing fits. Talk it through with the case manager; options below are not promises.
                    </p>
                  )}
                  {q.question === 'program_lookup' && <p className="panel-soft m-0 p-3 text-[14px]">{result.matches?.program_lookup?.caveat}</p>}
                  {q.steps.length === 0 && extras.length === 0 && <p className="m-0 text-[15px]">No listing in the directory fits this question.</p>}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {q.steps.map(s => card(s.resource_id, s))}
                    {extras.map(a => card(a.id, null, true))}
                  </div>
                  {need && <OtherOptions items={need.items.filter(i => !inPlan.has(i.resource_id))} onInclude={id => setAdded(a => [...a, { need: q.question, id }])} />}
                </section>
              );
            })}

            {result.gaps.length > 0 && (
              <section className="no-print space-y-3">
                <SectionLabel>What the directory can’t answer</SectionLabel>
                <ul className="m-0 list-outside list-disc space-y-1 pl-5 text-[15px]">
                  {result.gaps.map(g => (
                    <li key={g.id}>
                      {g.kind === 'ihh_internal_slot' && <span className="tag mr-2">IHH to fill in</span>}
                      {g.text}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.travel_steps && (
              <div className="no-print">
                <TravelChecklist steps={result.travel_steps} />
              </div>
            )}

            <div className="no-print">
              <CallScripts steps={planSteps.filter(s => !removed.has(s.resource_id))} records={records} />
            </div>

            {result.client_plan && (
              <ClientPlanView
                language={result.client_plan.language}
                lines={planLines(result.client_plan.lines, result.client_plan.language)}
                englishLines={result.client_plan.english_lines.length ? planLines(result.client_plan.english_lines, 'en') : []}
                checkedOn={result.checked_on}
                largePrint={!profile.reads_well}
                remaining={remaining}
              />
            )}
          </div>
        )}
      </main>
    </>
  );
}
