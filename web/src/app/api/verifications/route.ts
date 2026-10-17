import { NextRequest, NextResponse } from 'next/server';
import { connection } from 'next/server';
import { VerificationInputSchema } from '@/schemas';
import { appendVerification, getResourceById, readVerifications } from '@/lib/resources/loader';

/** Staff-verified overlay: "I called" results. The newest entry shows above the web-sourced data. */
export async function GET() {
  // The file changes during a session, so never prerender this.
  await connection();
  return NextResponse.json({ success: true, data: readVerifications() });
}

export async function POST(request: NextRequest) {
  try {
    const parseResult = VerificationInputSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.format() },
        { status: 400 }
      );
    }
    const { resource_id, outcome, note } = parseResult.data;
    if (!getResourceById(resource_id)) {
      return NextResponse.json({ success: false, error: `Resource '${resource_id}' not found.` }, { status: 404 });
    }
    const saved = appendVerification({ resource_id, outcome, note, date: new Date().toISOString().slice(0, 10) });
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error('Failed to save verification:', error);
    return NextResponse.json({ success: false, error: 'Failed to save the call result.' }, { status: 500 });
  }
}
