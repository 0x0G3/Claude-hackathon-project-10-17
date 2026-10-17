'use client';

import React, { useState, useEffect } from 'react';
import { ClientProfile, MatchResult, ActionPlan, Resource } from '@/types';

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <header className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Resource Navigator</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
              Challenge 2 MVP
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Illumination Health + Home (IHH) Client Navigation System • Orange County Claude Impact Lab
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${systemHealth?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>Engine: {systemHealth?.status === 'ok' ? 'Active' : 'Offline'} (v{systemHealth?.version})</span>
          </div>
          <div className="px-2.5 py-1 bg-slate-100 rounded text-slate-700 font-mono">
            Ground Truth: oc-resources.seed.json
          </div>
        </div>
      </header>

      {/* 4 Workflow Categories */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Core Resource Pathways
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-600'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className={`font-semibold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                  {cat.label}
                </div>
                <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {cat.desc}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Client Scenario Selection & Profile */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Select Fictional Scenario</h3>
            <span className="text-xs text-slate-400">12 Seed Cases</span>
          </div>
          <div className="space-y-2">
            {scenarios.map(s => (
              <button
                key={s.id}
                onClick={() => handleSelectClient(s.id)}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${
                  selectedClientId === s.id
                    ? 'border-indigo-600 bg-indigo-50/40 font-medium text-indigo-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{s.id}: {s.title}</span>
                  {s.id === 'C01' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-semibold">
                      Primary Demo
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.client}</p>
              </button>
            ))}
          </div>

          <button
            onClick={runMatching}
            disabled={loadingMatch}
            className="w-full mt-4 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {loadingMatch ? 'Evaluating Eligibility...' : `Run Deterministic Match for ${selectedClientId}`}
          </button>
        </div>

        {/* Selected Client Card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          {activeProfile ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                    Client File: {activeProfile.id}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{activeProfile.title}</h3>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-100 text-amber-800">
                    Exit Date: Friday (5 Days)
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-xs font-semibold text-slate-500 uppercase">In Their Words</div>
                <blockquote className="text-sm italic text-slate-800 mt-1">
                  &ldquo;{activeProfile.in_their_words}&rdquo;
                </blockquote>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-semibold text-slate-600 uppercase mb-1">Stated Needs</div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeProfile.needs.map(n => (
                      <span key={n} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-600 uppercase mb-1">Physical & System Constraints</div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                    {activeProfile.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {matchResult && matchResult.access_barriers.length > 0 && (
                <div className="mt-4 p-3 bg-red-50/60 border border-red-200 rounded-lg">
                  <div className="text-xs font-bold text-red-900 uppercase">Identified Access Barriers</div>
                  <ul className="text-xs text-red-800 mt-1 space-y-1 list-disc list-inside">
                    {matchResult.access_barriers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">Select a fictional client to begin</div>
          )}
        </div>
      </section>

      {/* Match Results Panel */}
      {matchResult && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Matched Resources for {matchResult.client_id} ({matchResult.matched_resources.length} verified options)
            </h2>
            <button
              onClick={runActionPlan}
              disabled={loadingPlan}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              {loadingPlan ? 'Synthesizing...' : 'Generate Staff Action Plan'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matchResult.matched_resources.map(item => {
              const r = item.resource;
              return (
                <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{r.name}</h4>
                      <p className="text-xs text-slate-500">{r.organization} • {r.city || 'Countywide'}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-100 text-emerald-800">
                      Score: {item.confidence_score}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{r.description}</p>

                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                    <div className="font-semibold text-slate-700">Match Rationale:</div>
                    <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                      {item.match_reasons.map((mr, i) => (
                        <li key={i}>{mr}</li>
                      ))}
                    </ul>
                  </div>

                  {r.is_confidential_address && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                      🛡️ Confidential Location: Address disclosed only upon confirmed referral.
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <div>Phone: <span className="font-mono text-slate-700">{r.phone || '2-1-1 / Referral only'}</span></div>
                    {r.source_url && (
                      <a
                        href={r.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Source Citation ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unknown Eligibility & Exclusions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4">
              <h4 className="font-bold text-amber-900 uppercase mb-2">Unverified Eligibility Questions</h4>
              <ul className="space-y-2 text-amber-800">
                {matchResult.unknown_eligibility.map((u, i) => (
                  <li key={i} className="border-b border-amber-200/50 pb-1.5 last:border-0">
                    <span className="font-semibold">{u.resource_name}:</span> {u.question}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="font-bold text-slate-700 uppercase mb-2">Excluded Resources ({matchResult.excluded_resources.length})</h4>
              <ul className="space-y-1.5 text-slate-600 max-h-40 overflow-y-auto">
                {matchResult.excluded_resources.slice(0, 5).map((ex, i) => (
                  <li key={i}>
                    <span className="font-medium text-slate-800">{ex.resource_name}:</span> {ex.exclusion_reasons.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Action Plan Output */}
      {actionPlan && (
        <section className="bg-white rounded-2xl border-2 border-emerald-500/30 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                Action Plan & Staff Directives
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Coordinated Care Plan for {actionPlan.client_id}
              </h3>
            </div>
            <div className="text-xs px-2.5 py-1 bg-amber-100 text-amber-900 font-semibold rounded">
              Human Review Required Before Dispatch
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <span>👤</span> Client-Facing Next Steps
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {actionPlan.client_next_steps.map((step, i) => (
                  <li key={i} className="leading-relaxed">{step}</li>
                ))}
              </ol>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <span>📋</span> Staff Intake & Coordination Checklist
              </h4>
              <ul className="space-y-2 text-slate-700 bg-blue-50/40 p-4 rounded-xl border border-blue-100">
                {actionPlan.staff_checklist.map((task, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 rounded text-blue-600" />
                    <span className="text-xs leading-relaxed">{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {actionPlan.source_references.length > 0 && (
            <div className="pt-4 border-t border-slate-100 text-xs">
              <span className="font-bold text-slate-600 uppercase tracking-wider">Cited Ground-Truth Sources:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {actionPlan.source_references.map((ref, i) => (
                  <a
                    key={i}
                    href={ref.source_url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded font-medium truncate max-w-xs"
                  >
                    {ref.resource_name} ({ref.verified_date || '2026-10-13'}) ↗
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Resource Catalog Browser for current category */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900">
            Resource Catalog Explorer: {selectedCategory.toUpperCase()} ({categoryResources.length} records)
          </h3>
          <span className="text-xs text-slate-400">Read-Only Ground Truth Catalog</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {categoryResources.slice(0, 6).map(res => (
            <div key={res.id} className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 space-y-1.5">
              <div className="font-semibold text-slate-900 truncate">{res.name}</div>
              <div className="text-slate-500">{res.organization}</div>
              <div className="text-slate-600 line-clamp-2">{res.description}</div>
              <div className="text-[10px] text-blue-600 font-mono pt-1">
                {res.phone || 'Call 2-1-1'}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
