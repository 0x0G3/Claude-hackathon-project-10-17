'use client';

import type { ReactNode } from 'react';
import { AgeBand, Household, IntakeProfile, Need, Tri } from '@/types';
import { Button, SectionLabel } from '@/components/ui';
import { LANGUAGES, NEED_LABEL, OTHER_NEEDS, QUESTIONS, TRI_LABEL } from './labels';

const AGE_BANDS: { value: AgeBand; label: string }[] = [
  { value: 'unknown', label: 'Not known' },
  { value: 'under_18', label: 'Under 18' },
  { value: '18_21', label: '18–21' },
  { value: '22_24', label: '22–24' },
  { value: '25_59', label: '25–59' },
  { value: '60_61', label: '60–61' },
  { value: '62_plus', label: '62 or older' },
];

const HOUSEHOLDS: { value: Household; label: string }[] = [
  { value: 'unknown', label: 'Not known' },
  { value: 'alone', label: 'Alone' },
  { value: 'couple', label: 'Couple' },
  { value: 'with_children', label: 'With minor children' },
  { value: 'pregnant', label: 'Pregnant' },
];

const HAS_FIELDS: { key: keyof IntakeProfile['has']; label: string }[] = [
  { key: 'ca_id', label: 'California ID' },
  { key: 'birth_certificate', label: 'Birth certificate' },
  { key: 'phone', label: 'Working phone' },
  { key: 'email', label: 'Email' },
  { key: 'bank_account', label: 'Bank account' },
  { key: 'mailing_address', label: 'Mailing address' },
  { key: 'permanent_residence', label: 'Permanent residence' },
];

const field = 'w-full border-2 border-navy bg-white px-3 py-2 text-[15px]';

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-[14px] font-semibold">
      {label}
      {children}
      {hint && <span className="text-[12px] font-normal text-muted">{hint}</span>}
    </label>
  );
}

function TriSelect({ label, value, onChange }: { label: string; value: Tri; onChange: (v: Tri) => void }) {
  return (
    <Field label={label}>
      <select className={field} value={value} onChange={e => onChange(e.target.value as Tri)}>
        {(['unknown', 'yes', 'no'] as Tri[]).map(t => (
          <option key={t} value={t}>
            {TRI_LABEL[t]}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-[15px]">
      <input type="checkbox" className="h-5 w-5 shrink-0 accent-navy" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function toggle<T>(list: T[], item: T, on: boolean): T[] {
  return on ? [...new Set([...list, item])] : list.filter(x => x !== item);
}

export function IntakeForm({
  profile,
  onChange,
  useAi,
  onUseAiChange,
  onSubmit,
  loading,
}: {
  profile: IntakeProfile;
  onChange: (p: IntakeProfile) => void;
  useAi: boolean;
  onUseAiChange: (v: boolean) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const set = <K extends keyof IntakeProfile>(key: K, value: IntakeProfile[K]) => onChange({ ...profile, [key]: value });
  const setHas = (key: keyof IntakeProfile['has'], value: Tri) => onChange({ ...profile, has: { ...profile.has, [key]: value } });
  const wantsTravel = profile.questions.includes('travel');

  return (
    <form
      className="space-y-8"
      onSubmit={e => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <section className="space-y-3">
        <SectionLabel>Which questions to answer</SectionLabel>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {QUESTIONS.map(q => (
            <Check key={q} label={NEED_LABEL[q]} checked={profile.questions.includes(q)} onChange={on => set('questions', toggle<Need>(profile.questions, q, on))} />
          ))}
        </div>
        <div className="eyebrow pt-2">Also asked about</div>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
          {OTHER_NEEDS.map(n => (
            <Check key={n} label={NEED_LABEL[n]} checked={profile.other_needs.includes(n)} onChange={on => set('other_needs', toggle(profile.other_needs, n, on))} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel>About the client</SectionLabel>
        <p className="m-0 text-[14px]">Structured answers only. Never ask for a name, ID number or immigration status.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Age">
            <select className={field} value={profile.age_band} onChange={e => set('age_band', e.target.value as AgeBand)}>
              {AGE_BANDS.map(a => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Last city in Orange County">
            <input className={field} value={profile.city ?? ''} onChange={e => set('city', e.target.value.trim() ? e.target.value : null)} placeholder="e.g. Santa Ana" />
          </Field>
          <Field label="City ties" hint="Lived, worked, school or family. Comma-separated.">
            {/* Uncontrolled so a trailing comma survives while typing. */}
            <input
              className={field}
              defaultValue={profile.city_ties.join(', ')}
              onChange={e => set('city_ties', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
          </Field>
          <Field label="Household">
            <select className={field} value={profile.household} onChange={e => set('household', e.target.value as Household)}>
              {HOUSEHOLDS.map(h => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gender" hint="Only if the client offers it.">
            <select className={field} value={profile.gender} onChange={e => set('gender', e.target.value as IntakeProfile['gender'])}>
              <option value="not_shared">Not shared</option>
              <option value="woman">Woman</option>
              <option value="man">Man</option>
              <option value="nonbinary">Nonbinary</option>
            </select>
          </Field>
          <TriSelect label="Manages daily living alone" value={profile.adl_independent} onChange={v => set('adl_independent', v)} />
          <TriSelect label="Has a disability" value={profile.disability} onChange={v => set('disability', v)} />
          <TriSelect label="Medi-Cal / CalOptima member" value={profile.medi_cal} onChange={v => set('medi_cal', v)} />
          <TriSelect label="Veteran" value={profile.veteran} onChange={v => set('veteran', v)} />
          <TriSelect label="Born in California" value={profile.born_in_california} onChange={v => set('born_in_california', v)} />
        </div>
        <Check label="Uses a walker, wheelchair or other mobility device" checked={profile.mobility_device} onChange={v => set('mobility_device', v)} />
      </section>

      <section className="space-y-3">
        <SectionLabel>Has right now</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HAS_FIELDS.map(h => (
            <TriSelect key={h.key} label={h.label} value={profile.has[h.key]} onChange={v => setHas(h.key, v)} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel>The take-home plan</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Language">
            <select className={field} value={profile.language} onChange={e => set('language', e.target.value)}>
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Check label="Reads well (otherwise: large print)" checked={profile.reads_well} onChange={v => set('reads_well', v)} />
          <Check label="Can use the phone well (otherwise: in-person first, 7-1-1 relay)" checked={profile.phone_ok} onChange={v => set('phone_ok', v)} />
        </div>
      </section>

      {wantsTravel && (
        <section className="space-y-3">
          <SectionLabel>Travel home</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Destination city and state">
              <input
                className={field}
                value={profile.travel?.destination ?? ''}
                onChange={e => set('travel', { destination: e.target.value || null, host_confirmed: profile.travel?.host_confirmed ?? 'unknown' })}
              />
            </Field>
            <TriSelect
              label="Host confirmed by the client"
              value={profile.travel?.host_confirmed ?? 'unknown'}
              onChange={v => set('travel', { destination: profile.travel?.destination ?? null, host_confirmed: v })}
            />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionLabel>Safety and the client’s words</SectionLabel>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Check label="Client feels unsafe returning somewhere" checked={profile.safety.feels_unsafe} onChange={v => set('safety', { ...profile.safety, feels_unsafe: v })} />
          <Check label="Client is in crisis or talks about self-harm" checked={profile.safety.crisis} onChange={v => set('safety', { ...profile.safety, crisis: v })} />
        </div>
        <Field label="What the client asked, in their words" hint="Only the safety check reads this. It is never sent to Claude.">
          <textarea className={`${field} min-h-24`} value={profile.client_words} onChange={e => set('client_words', e.target.value)} />
        </Field>
        <Field label="A program the client heard about (optional)" hint="We search the directory for possible matches and say we can’t confirm it.">
          <input className={field} value={profile.heard_of ?? ''} onChange={e => set('heard_of', e.target.value.trim() ? e.target.value : null)} />
        </Field>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-navy pt-6">
        <Check label="Use Claude for the Planner and Writer (needs an API key; otherwise the rules engine writes the plan)" checked={useAi} onChange={onUseAiChange} />
        <Button type="submit" size="lg" arrow={!loading} disabled={loading || (profile.questions.length === 0 && profile.other_needs.length === 0 && !profile.client_words.trim())}>
          {loading ? 'Checking…' : 'Check and plan'}
        </Button>
      </div>
    </form>
  );
}
