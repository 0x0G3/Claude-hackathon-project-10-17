import { NextResponse } from 'next/server';
import { getClientScenarios, getScenarioProfiles } from '@/lib/resources/loader';

/** The 12 made-up scenarios: title and words for display, plus the structured intake profile. */
export async function GET() {
  const text = new Map(getClientScenarios().map(s => [s.id, s]));
  const data = getScenarioProfiles().map(profile => ({
    id: profile.id,
    title: text.get(profile.id)?.title ?? profile.id,
    client: text.get(profile.id)?.client ?? '',
    profile,
  }));
  return NextResponse.json({ success: true, data });
}
