'use client';

import { useState } from 'react';
import { MatchItem, PlanStep, RecheckResult, SessionResult, Verification, VerificationOutcome } from '@/types';
import { Button, ConfidenceMark, NotStated, formatCheckedDate, toConfidence } from '@/components/ui';
import { OUTCOME_ICON, OUTCOME_LABEL, STATUS_LABEL } from './labels';
import { RecheckPanel } from './RecheckPanel';
import { WARNING_TEXT } from '@/lib/warnings';

type ListingRecord = SessionResult['records'][string];

const OUTCOMES: { value: VerificationOutcome; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed: details are right' },
  { value: 'closed', label: 'Closed' },
  { value: 'number_wrong', label: 'Number wrong' },
  { value: 'changed', label: 'Something changed' },
];

/**
 * One card per recommended step (architecture 4.9): status, every check, check date, confidence,
 * conflict notes and source. The case worker ticks it, removes it, logs a call, or re-checks it.
 */
export function ReviewCard({
  record,
  step,
  match,
  ticked,
  removed,
  addedByCaseWorker = false,
  useAi,
  onTick,
  onRemove,
  onVerified,
}: {
  record: ListingRecord;
  step: PlanStep | null;
  match: MatchItem | null;
  ticked: boolean;
  removed: boolean;
  addedByCaseWorker?: boolean;
  useAi: boolean;
  onTick: (v: boolean) => void;
  onRemove: (v: boolean) => void;
  onVerified: (v: Verification) => void;
}) {
  const [calling, setCalling] = useState(false);
  const [outcome, setOutcome] = useState<VerificationOutcome>('confirmed');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [recheck, setRecheck] = useState<RecheckResult | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveCall = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_id: record.id, outcome, note }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onVerified(data.data);
      setCalling(false);
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the call.');
    } finally {
      setSaving(false);
    }
  };

  const runRecheck = async () => {
    setRechecking(true);
    setError(null);
    try {
      const res = await fetch('/api/recheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_id: record.id, useAi }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setRecheck(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-check failed.');
    } finally {
      setRechecking(false);
    }
  };

  const latest = record.latest_verification;

  return (
    <article className={`flex flex-col gap-3 p-5 ${removed ? 'panel-soft opacity-70' : 'panel'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 font-sans text-[18px] font-bold leading-snug">{record.name}</h3>
          <p className="m-0 text-[13px]">
            {record.organization} · {record.city ?? 'Countywide'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {match && <span className={`tag ${match.status === 'likely_fit' ? 'tag-accent' : ''}`}>{STATUS_LABEL[match.status]}</span>}
          {addedByCaseWorker && <span className="tag tag-dark">Added by case worker</span>}
          {record.warnings.includes('referral_only') && <span className="tag tag-dark">Referral only</span>}
        </div>
      </div>

      <ConfidenceMark level={toConfidence(record.confidence)} checkedOn={formatCheckedDate(record.verified_date)} />

      {latest && (
        <div className={`p-3 text-[14px] ${latest.outcome === 'confirmed' ? 'panel-soft' : 'on-dark bg-dark'}`}>
          <span className="font-bold">Staff check {latest.date}: {latest.outcome.replace('_', ' ')}.</span> {latest.note}
        </div>
      )}

      {step && (
        <div className="space-y-1 text-[15px]">
          <div>
            <span className="font-semibold">Today: </span>
            {step.what_to_do_today}
          </div>
          <div className="text-[14px]">{step.why_this}</div>
        </div>
      )}

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
        <dt className="font-semibold">Phone</dt>
        <dd className="m-0 tabular-nums">{record.phone ?? <NotStated />}</dd>
        <dt className="font-semibold">Address</dt>
        <dd className="m-0">{record.address ?? (record.confidential_location ? 'Confidential location: shared only after a confirmed referral.' : <NotStated />)}</dd>
        <dt className="font-semibold">Hours</dt>
        <dd className="m-0">{record.hours ?? <NotStated>Not stated by source. Ask when you call.</NotStated>}</dd>
        <dt className="font-semibold">Eligibility</dt>
        <dd className="m-0">{record.eligibility ?? <NotStated>Not stated by source. Ask when you call.</NotStated>}</dd>
      </dl>

      {match && match.checks.length > 0 && (
        <ul className="m-0 list-none space-y-1 p-0 text-[14px]" aria-label="Eligibility checks">
          {match.checks.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-4 shrink-0 font-bold" aria-label={OUTCOME_LABEL[c.outcome]}>
                {OUTCOME_ICON[c.outcome]}
              </span>
              <span>
                <span className="font-semibold">{c.rule}:</span> {c.detail}
              </span>
            </li>
          ))}
        </ul>
      )}

      {step && step.unknowns_to_ask.length > 0 && (
        <div className="panel-soft p-3 text-[14px]">
          <div className="font-bold">Ask when you call</div>
          <ul className="m-0 list-outside list-disc space-y-0.5 pl-5">
            {step.unknowns_to_ask.map(u => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      {record.warnings.length > 0 && (
        <ul className="m-0 list-outside list-disc space-y-0.5 pl-5 text-[13px]">
          {record.warnings.map(w => (
            <li key={w}>{WARNING_TEXT[w]}</li>
          ))}
        </ul>
      )}

      {record.notes && (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-semibold">
            Source notes{record.warnings.includes('conflict') ? ' (sources disagree on a detail)' : ''}
          </summary>
          <p className="m-0 mt-1">{record.notes}</p>
        </details>
      )}

      {recheck && <RecheckPanel result={recheck} onApproved={n => onVerified({ resource_id: record.id, outcome: 'changed', note: n, date: new Date().toISOString().slice(0, 10) })} />}

      {calling && (
        <div className="panel-soft space-y-2 p-3 text-[14px]">
          <label className="flex flex-col gap-1 font-semibold">
            What happened on the call?
            <select className="border-2 border-navy bg-white px-2 py-1.5 font-normal" value={outcome} onChange={e => setOutcome(e.target.value as VerificationOutcome)}>
              {OUTCOMES.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-semibold">
            Note (no client details)
            <input className="border-2 border-navy bg-white px-2 py-1.5 font-normal" value={note} onChange={e => setNote(e.target.value)} maxLength={500} />
          </label>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={saveCall} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="link" onClick={() => setCalling(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p className="m-0 text-[14px] font-semibold">{error}</p>}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t-2 border-navy pt-3">
        <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
          <input type="checkbox" className="h-5 w-5 shrink-0 accent-navy" checked={ticked} disabled={removed} onChange={e => onTick(e.target.checked)} />
          I’ve confirmed this
        </label>
        <div className="flex flex-wrap items-center gap-4 text-[14px]">
          {!calling && (
            <Button variant="link" onClick={() => setCalling(true)}>
              I called
            </Button>
          )}
          <Button variant="link" onClick={runRecheck} disabled={rechecking}>
            {rechecking ? 'Re-checking…' : 'Re-check this listing'}
          </Button>
          <Button variant="link" onClick={() => onRemove(!removed)}>
            {removed ? 'Put back' : 'Remove from plan'}
          </Button>
          {record.source_url && (
            <a href={record.source_url} target="_blank" rel="noreferrer" className="font-semibold underline">
              Source ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
