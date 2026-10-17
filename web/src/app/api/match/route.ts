import { NextRequest, NextResponse } from 'next/server';
import { MatchRequestSchema } from '@/schemas';
import { matchClientToResources } from '@/lib/matching/engine';
import { getClientScenarioById, getClientScenarios } from '@/lib/resources/loader';
import { ClientProfile } from '@/types';


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

    const { clientId, profile } = parseResult.data;

    let targetProfile: ClientProfile | undefined = profile;

    if (!targetProfile && clientId) {
      targetProfile = getClientScenarioById(clientId);
    }

    if (!targetProfile) {
      return NextResponse.json(
        {
          success: false,
          error: `Client profile for ID '${clientId}' not found in fictional scenarios dataset. Available IDs: ${getClientScenarios().map(s => s.id).join(', ')}`,
        },
        { status: 404 }
      );
    }

    const matchResult = matchClientToResources(targetProfile);

    return NextResponse.json({
      success: true,
      data: matchResult,
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
