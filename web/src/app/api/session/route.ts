import { NextRequest, NextResponse } from 'next/server';
import { SessionRequestSchema } from '@/schemas';
import { claudeOptions, runSession } from '@/lib/session/run';

/** One case worker session: safety gate → prerequisites → matcher → Planner → Writer → fact checker. */
export async function POST(request: NextRequest) {
  try {
    const parseResult = SessionRequestSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { profile, useAi } = parseResult.data;
    const useClaude = useAi && Boolean(process.env.ANTHROPIC_API_KEY);
    const result = await runSession(profile, useClaude ? claudeOptions() : {});

    return NextResponse.json({
      success: true,
      data: result,
      ...(useAi && !useClaude ? { notice: 'ANTHROPIC_API_KEY is not set, so the rules engine wrote this plan.' } : {}),
    });
  } catch (error) {
    console.error('Session failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to run the session.' }, { status: 500 });
  }
}
