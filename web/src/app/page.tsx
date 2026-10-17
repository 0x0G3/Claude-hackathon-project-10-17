'use client';

import React, { useState, useEffect } from 'react';
import { ClientProfile, MatchResult, ActionPlan, Resource } from '@/types';
import { Button, ConfidenceMark, Eyebrow, NotStated, SectionLabel, TopBar, formatCheckedDate, toConfidence } from '@/components/ui';

const CATEGORIES = [
  { id: 'shelter', label: '1. Shelter', desc: 'Emergency beds, navigation centers & recuperative exit' },
  { id: 'employment', label: '2. Employment', desc: 'Job training, placement & interview attire' },
  { id: 'microenterprise', label: '3. Microloans', desc: 'Small-dollar capital & microenterprise tools' },
  { id: 'family-reunification-travel', label: '4. Family Reunification Travel', desc: 'Transit aid to relocate with verified family' },
];

const INITIAL_RAY: ClientProfile = {
  id: 'C01',
  title: 'A bed after recuperative care',
  client: 'Ray, 62. Leaves recuperative care in five days. Walks with a walker. Has Medi-Cal. Lost his ID. Last had an address in Santa Ana.',
  in_their_words: "They say I'm done here Friday. I can't go back under the bridge with this leg. Where do I go?",
  needs: ['shelter', 'id-documents'],
  constraints: [
    'Uses a walker; needs a lower bunk or accessible site',
    'No ID',
    'Basic phone, calls and texts only',
  ],
  city: 'Santa Ana',
  has_id: false,
  requires_accessibility: true,
};

const INITIAL_SCENARIOS: ClientProfile[] = [
  INITIAL_RAY,
  {
    id: 'C02',
    title: 'A small loan to start working again',
    client: 'Marisol, 41. Sold food at swap meets. Wants to restart.',
    in_their_words: 'Yo sé trabajar. Solo necesito como dos mil dólares para el equipo y el permiso.',
    needs: ['microenterprise'],
    constraints: ['Prefers Spanish', 'No bank account right now'],
  },
  {
    id: 'C03',
    title: 'Getting home to family',
    client: 'Devon, 29. Sister in Phoenix said he can live with her.',
    in_their_words: "My sister said come. I just can't get there.",
    needs: ['family-reunification-travel'],
    constraints: ['Wants to leave within two weeks', 'Has a smartphone'],
  },
  {
    id: 'C04',
    title: 'Back to work',
    client: 'Tanya, 35. Drove a forklift for six years. Two-year gap.',
    in_their_words: "I can work. I just don't know how to explain the last two years.",
    needs: ['employment'],
    constraints: ['No computer', 'Can travel by bus'],
  },
];

export default function DashboardPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('shelter');
  const [scenarios] = useState<ClientProfile[]>(INITIAL_SCENARIOS);
  const [selectedClientId, setSelectedClientId] = useState<string>('C01');
  const [activeProfile, setActiveProfile] = useState<ClientProfile | null>(INITIAL_RAY);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [categoryResources, setCategoryResources] = useState<Resource[]>([]);
  const [loadingMatch, setLoadingMatch] = useState<boolean>(false);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);
  const [systemHealth, setSystemHealth] = useState<{ status: string; version: string } | null>(null);

  // Load health status
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setSystemHealth({ status: data.status, version: data.version }))
      .catch(() => setSystemHealth({ status: 'offline', version: '1.0.0' }));
  }, []);

  // Fetch resources when category changes
  useEffect(() => {
    fetch(`/api/resources?category=${selectedCategory}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCategoryResources(data.data || []);
        }
      })
      .catch(err => console.error('Error fetching category resources:', err));
  }, [selectedCategory]);

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
    const found = scenarios.find(s => s.id === id);
    if (found) {
      setActiveProfile(found);
      setMatchResult(null);
      setActionPlan(null);
    }
  };

  const runMatching = async () => {
    if (!activeProfile) return;
    setLoadingMatch(true);
    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: activeProfile.id,
          profile: activeProfile,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMatchResult(data.data);
      }
    } catch (error) {
      console.error('Match error:', error);
    } finally {
      setLoadingMatch(false);
    }
  };

  const runActionPlan = async () => {
    if (!activeProfile || !matchResult) return;
    setLoadingPlan(true);
    try {
      const res = await fetch('/api/action-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: activeProfile.id,
          clientSummary: activeProfile.client,
          matchedResourceIds: matchResult.matched_resources.map(m => m.resource.id),
          needs: activeProfile.needs,
          constraints: activeProfile.constraints,
          useAi: false, // deterministic safe fallback default
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionPlan(data.data);
      }
    } catch (error) {
      console.error('Action plan error:', error);
    } finally {
      setLoadingPlan(false);
    }
  };

  const engineOk = systemHealth?.status === 'ok';

  return (
    <>
      <TopBar label="Next Door · case manager">
        <span className="inline-flex items-center gap-2 text-[13px]">
          <span className={`mark ${engineOk ? 'mark-high' : 'mark-low'}`} aria-hidden="true" />
          Engine {engineOk ? 'active' : 'offline'} (v{systemHealth?.version})
        </span>
        <span className="text-[13px]">Ground truth: oc-resources.seed.json</span>
      </TopBar>

      <main className="mx-auto max-w-content space-y-10 px-gutter py-8">
        {/* Page heading */}
        <header className="space-y-2">
          <Eyebrow>Challenge 2 MVP · Orange County Claude Impact Lab</Eyebrow>
          <h1 className="m-0 text-[32px] leading-[1.15] sm:text-[40px]">Resource Navigator</h1>
          <p className="m-0 max-w-text text-muted">Illumination Health + Home (IHH) client navigation system.</p>
        </header>

        {/* 4 Workflow Categories */}
        <section className="space-y-3">
          <SectionLabel>Core resource pathways</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`border-2 border-navy p-4 text-left ${isSelected ? 'on-dark bg-dark' : 'bg-white hover:bg-sand'}`}
                >
                  <div className="text-[15px] font-bold">{cat.label}</div>
                  <div className="mt-1 text-[13px] leading-relaxed">{cat.desc}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Client Scenario Selection & Profile */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <div className="rule flex items-baseline justify-between">
              <h2 className="eyebrow m-0 font-sans">Select fictional scenario</h2>
              <span className="text-[12px]">12 seed cases</span>
            </div>
            <div className="space-y-2">
              {scenarios.map(s => {
                const isSelected = selectedClientId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectClient(s.id)}
                    className={`w-full border-2 border-navy p-3 text-left text-[14px] ${isSelected ? 'on-dark bg-dark' : 'bg-white hover:bg-sand'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">
                        {s.id}: {s.title}
                      </span>
                      {s.id === 'C01' && <span className="tag tag-accent shrink-0">Primary demo</span>}
                    </div>
                    <p className="m-0 mt-1 line-clamp-2 text-[13px]">{s.client}</p>
                  </button>
                );
              })}
            </div>

            <Button block onClick={runMatching} disabled={loadingMatch} arrow={!loadingMatch}>
              {loadingMatch ? 'Evaluating eligibility…' : `Run match for ${selectedClientId}`}
            </Button>
          </div>

          {/* Selected Client Card */}
          <div className="panel space-y-5 p-6 lg:col-span-2">
            {activeProfile ? (
              <>
                <div className="rule flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Eyebrow>Client file: {activeProfile.id}</Eyebrow>
                    <h3 className="m-0 text-[26px] leading-tight">{activeProfile.title}</h3>
                  </div>
                  <span className="tag tag-accent">Exit date: Friday (5 days)</span>
                </div>

                <div className="panel-soft p-4">
                  <Eyebrow>In their words</Eyebrow>
                  <blockquote className="m-0 mt-1 font-quote text-[20px] font-black leading-snug">
                    &ldquo;{activeProfile.in_their_words}&rdquo;
                  </blockquote>
                </div>

                <div className="grid grid-cols-1 gap-5 text-[14px] md:grid-cols-2">
                  <div>
                    <div className="eyebrow mb-2">Stated needs</div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeProfile.needs.map(n => (
                        <span key={n} className="tag">
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="eyebrow mb-2">Physical &amp; system constraints</div>
                    <ul className="m-0 list-outside list-disc space-y-0.5 pl-5">
                      {activeProfile.constraints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {matchResult && matchResult.access_barriers.length > 0 && (
                  <div className="on-dark bg-dark p-4">
                    <div className="eyebrow text-yellow">Identified access barriers</div>
                    <ul className="m-0 mt-2 list-outside list-disc space-y-1 pl-5 text-[14px]">
                      {matchResult.access_barriers.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-[14px] text-muted">Select a fictional client to begin</div>
            )}
          </div>
        </section>

        {/* Match Results Panel */}
        {matchResult && (
          <section className="space-y-6">
            <div className="rule flex flex-wrap items-end justify-between gap-4">
              <h2 className="m-0 text-[28px] leading-tight">
                Matched resources for {matchResult.client_id}{' '}
                <span className="font-sans text-[16px] font-semibold">({matchResult.matched_resources.length} verified options)</span>
              </h2>
              <Button onClick={runActionPlan} disabled={loadingPlan} arrow={!loadingPlan}>
                {loadingPlan ? 'Writing plan…' : 'Generate staff action plan'}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {matchResult.matched_resources.map(item => {
                const r = item.resource;
                return (
                  <article key={r.id} className="panel flex flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="m-0 font-sans text-[18px] font-bold leading-snug">{r.name}</h3>
                        <p className="m-0 text-[13px] text-muted">
                          {r.organization} · {r.city || 'Countywide'}
                        </p>
                      </div>
                      <span className="tag shrink-0">Score {item.confidence_score}</span>
                    </div>

                    <ConfidenceMark level={item.confidence} checkedOn={formatCheckedDate(r.verified_date)} />

                    <p className="m-0 line-clamp-2 text-[14px] leading-relaxed">{r.description}</p>

                    <div className="panel-soft space-y-1 p-3 text-[13px]">
                      <div className="font-bold">Why it may fit</div>
                      <ul className="m-0 list-outside list-disc space-y-0.5 pl-5">
                        {item.match_reasons.map((mr, i) => (
                          <li key={i}>{mr}</li>
                        ))}
                      </ul>
                    </div>

                    {r.is_confidential_address && (
                      <div className="on-dark bg-dark p-3 text-[13px]">
                        Confidential location: the address is shared only after a confirmed referral.
                      </div>
                    )}

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t-2 border-navy pt-3 text-[13px]">
                      <div>
                        Phone: <span className="font-bold tabular-nums">{r.phone || <NotStated>2-1-1 / referral only</NotStated>}</span>
                      </div>
                      {r.source_url && (
                        <a href={r.source_url} target="_blank" rel="noreferrer" className="font-semibold underline">
                          Source ↗
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Unknown Eligibility & Exclusions */}
            <div className="grid grid-cols-1 gap-4 text-[13px] md:grid-cols-2">
              <div className="panel p-4">
                <h4 className="eyebrow m-0 mb-2 flex items-center gap-2 font-sans">
                  <span className="mark mark-medium" aria-hidden="true" />
                  Unverified eligibility questions
                </h4>
                <ul className="m-0 list-none space-y-2 p-0">
                  {matchResult.unknown_eligibility.map((u, i) => (
                    <li key={i} className="border-b border-navy pb-1.5 last:border-0">
                      <span className="font-bold">{u.resource_name}:</span> {u.question}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="panel-soft self-start p-4">
                <h4 className="eyebrow m-0 mb-2 font-sans">Excluded resources ({matchResult.excluded_resources.length})</h4>
                <ul className="m-0 max-h-40 list-none space-y-1.5 overflow-y-auto p-0">
                  {matchResult.excluded_resources.slice(0, 5).map((ex, i) => (
                    <li key={i}>
                      <span className="font-bold">{ex.resource_name}:</span> {ex.exclusion_reasons.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Action Plan Output */}
        {actionPlan && (
          <section className="border-2 border-navy">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-accent px-6 py-4 text-on-accent">
              <div>
                <Eyebrow>Action plan &amp; staff directives</Eyebrow>
                <h3 className="m-0 text-[26px] leading-tight">Coordinated care plan for {actionPlan.client_id}</h3>
              </div>
              <span className="tag tag-dark">Human review required before hand-over</span>
            </div>

            <div className="grid grid-cols-1 gap-6 p-6 text-[15px] md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="eyebrow rule m-0 font-sans">Client-facing next steps</h4>
                <ol className="m-0 list-outside list-decimal space-y-2 pl-6">
                  {actionPlan.client_next_steps.map((step, i) => (
                    <li key={i} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="space-y-3">
                <h4 className="eyebrow rule m-0 font-sans">Staff intake &amp; coordination checklist</h4>
                <ul className="m-0 list-none space-y-2 p-0">
                  {actionPlan.staff_checklist.map((task, i) => (
                    <li key={i}>
                      <label className="flex items-start gap-3">
                        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-navy" />
                        <span className="text-[14px] leading-relaxed">{task}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {actionPlan.source_references.length > 0 && (
              <div className="border-t-2 border-navy px-6 py-4 text-[13px]">
                <span className="eyebrow">Cited ground-truth sources</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {actionPlan.source_references.map((ref, i) => (
                    <a
                      key={i}
                      href={ref.source_url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="tag max-w-xs no-underline hover:bg-sand"
                    >
                      <span className="min-w-0 truncate">
                        {ref.resource_name} ({ref.verified_date || '2026-10-13'})
                      </span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Resource Catalog Browser for current category */}
        <section className="panel-soft space-y-4 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="m-0 font-sans text-[18px] font-bold">
              Resource catalog: {selectedCategory} ({categoryResources.length} records)
            </h3>
            <span className="text-[12px]">Read-only ground-truth catalog</span>
          </div>
          <div className="grid grid-cols-1 gap-3 text-[13px] md:grid-cols-3">
            {categoryResources.slice(0, 6).map(res => (
              <div key={res.id} className="space-y-1.5 border-2 border-navy bg-white p-3">
                <div className="truncate font-bold">{res.name}</div>
                <ConfidenceMark level={toConfidence(res.confidence)} checkedOn={formatCheckedDate(res.verified_date)} />
                <div className="text-muted">{res.organization}</div>
                <div className="line-clamp-2">{res.description}</div>
                <div className="pt-1 font-bold tabular-nums">{res.phone || 'Call 2-1-1'}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
