import { NextRequest, NextResponse } from 'next/server';
import { ActionPlanRequestSchema } from '@/schemas';
import { generateActionPlanWithClaude } from '@/lib/ai/claude';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = ActionPlanRequestSchema.safeParse(body);

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

    const plan = await generateActionPlanWithClaude(parseResult.data);

    return NextResponse.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error('Error creating action plan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate action plan.',
      },
      { status: 500 }
    );
  }
}
