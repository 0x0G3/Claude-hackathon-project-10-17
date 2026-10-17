'use client';

import { useState } from 'react';
import { RecheckResult } from '@/types';
import { Button } from '@/components/ui';

/** Diff from "Re-check this listing". Nothing changes until a person approves a row. */
export function RecheckPanel({ result, onApproved }: { result: RecheckResult; onApproved: (note: string) => void }) {
  const approvable = result.proposals.filter(p => p.changed && p.quote_found && p.format_ok);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!result.allowed) {
    return (
      <div className="panel-soft p-3 text-[14px]">
        <span className="font-semibold">Not re-checked: </span>
        {result.refused_reason}
      </div>
    );
  }

  const approve = async () => {
    setSaving(true);
    setError(null);
    try {
      const approved = [...picked].map(i => approvable[i]).map(p => ({ field: p.field, current: p.current, proposed: p.proposed, quote: p.quote }));
      const res = await fetch('/api/recheck/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_id: result.resource_id, approved }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onApproved(data.data.note);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the approval.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel-soft space-y-3 p-3 text-[14px]">
      <div>
        Read <a href={result.url} target="_blank" rel="noreferrer" className="underline">{result.url}</a> (HTTP {result.http_status}
        {result.changed_since_last === null ? ', first snapshot' : result.changed_since_last ? ', changed since the last snapshot' : ', unchanged since the last snapshot'}
        ; extractor: {result.extractor}).
      </div>

      {result.flags.map((f, i) => (
        <div key={i} className="border-2 border-navy bg-white p-2">
          <span className="font-bold">Flag: {f.kind.replace('_', ' ')}. </span>
          {f.note} {!f.quote_found && <span className="not-stated">Quote not found on the page.</span>}
        </div>
      ))}

      {result.proposals.length === 0 ? (
        <p className="m-0">No phone numbers or other fields found to compare.</p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {result.proposals.map((p, i) => {
            const idx = approvable.indexOf(p);
            return (
              <li key={i} className="border-b border-navy pb-2 last:border-0">
                <div className="flex items-start gap-3">
                  {idx >= 0 ? (
                    <input
                      type="checkbox"
                      aria-label={`Approve ${p.field} change`}
                      className="mt-1 h-5 w-5 shrink-0 accent-navy"
                      checked={picked.has(idx)}
                      onChange={e => setPicked(s => {
                        const next = new Set(s);
                        if (e.target.checked) next.add(idx);
                        else next.delete(idx);
                        return next;
                      })}
                    />
                  ) : (
                    <span className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
                  )}
                  <div>
                    <span className="font-semibold">{p.field}: </span>
                    {p.changed ? (
                      <>
                        <span className="line-through">{p.current ?? 'not stated'}</span> → <span className="font-bold">{p.proposed}</span>
                      </>
                    ) : (
                      <span>{p.proposed} (already in the record)</span>
                    )}
                    <div className="text-[13px]">Page says: “{p.quote}”</div>
                    {!p.quote_found && <div className="not-stated">Quote not found on the page: cannot approve.</div>}
                    {!p.format_ok && <div className="not-stated">Does not look like a phone number: cannot approve.</div>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="m-0 font-semibold">{error}</p>}
      {approvable.length > 0 && (
        <Button variant="secondary" size="sm" disabled={picked.size === 0 || saving} onClick={approve}>
          {saving ? 'Saving…' : `Approve ${picked.size || ''} change${picked.size === 1 ? '' : 's'}`}
        </Button>
      )}
    </div>
  );
}
