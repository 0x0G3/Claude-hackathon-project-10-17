import { NextRequest, NextResponse } from 'next/server';
import { MatchRequestSchema } from '@/schemas';
import { matchProfile } from '@/lib/matching/engine';
import { getScenarioProfile, getScenarioProfiles } from '@/lib/resources/loader';
import { IntakeProfile } from '@/types';

/** Matcher only (plain code, no Claude). Useful for checking rules without running a whole session. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = MatchRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { scenarioId, profile } = parseResult.data;
    const target: IntakeProfile | undefined = profile ?? (scenarioId ? getScenarioProfile(scenarioId) : undefined);

    if (!target) {
      return NextResponse.json(
        {
          success: false,
          error: `Scenario '${scenarioId}' not found. Available IDs: ${getScenarioProfiles().map(s => s.id).join(', ')}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: matchProfile(target),
    });
  } catch (error) {
    console.error('Error executing matching engine:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process match request.',
      },
      { status: 500 }
    );
  }
}
