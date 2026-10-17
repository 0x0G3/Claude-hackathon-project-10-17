import { NextRequest, NextResponse } from 'next/server';
import { validateRequestAuth } from '@/lib/firebase/auth';
import { fetchAllCases, createCaseRecord } from '@/lib/firebase/admin';
import { CreateCaseSchema } from '@/schemas';


export async function GET(request: NextRequest) {
  const authResult = await validateRequestAuth(request);
  if (!authResult.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: authResult.error || 'Unauthorized',
      },
      { status: authResult.status }
    );
  }

  try {
    const cases = await fetchAllCases();
    return NextResponse.json({
      success: true,
      count: cases.length,
      data: cases,
    });
  } catch (error) {
    console.error('Failed to list cases:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve cases.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await validateRequestAuth(request);
  if (!authResult.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: authResult.error || 'Unauthorized',
      },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const parseResult = CreateCaseSchema.safeParse(body);

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

    const newCase = await createCaseRecord(parseResult.data);
    return NextResponse.json(
      {
        success: true,
        data: newCase,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create case:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create case record.',
      },
      { status: 500 }
    );
  }
}
