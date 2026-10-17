import { NextRequest, NextResponse } from 'next/server';
import { RecheckApprovalSchema } from '@/schemas';
import { appendVerification, getResourceById } from '@/lib/resources/loader';

/**
 * Staff approval of re-check changes. Recorded in the verification overlay, which shows above the
 * web-sourced data; the seed itself is not rewritten.
 */
export async function POST(request: NextRequest) {
  try {
    const parseResult = RecheckApprovalSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.format() },
        { status: 400 }
      );
    }
    const { resource_id, approved } = parseResult.data;
    if (!getResourceById(resource_id)) {
      return NextResponse.json({ success: false, error: `Resource '${resource_id}' not found.` }, { status: 404 });
    }
    if (approved.length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing was approved.' }, { status: 400 });
    }
    const note = approved
      .map(a => `${a.field}: "${a.current ?? 'not stated'}" → "${a.proposed}" (page says: "${a.quote}")`)
      .join('; ');
    const saved = appendVerification({
      resource_id,
      outcome: 'changed',
      note: `Approved from re-check. ${note}`,
      date: new Date().toISOString().slice(0, 10),
    });
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error('Failed to record approval:', error);
    return NextResponse.json({ success: false, error: 'Failed to record the approval.' }, { status: 500 });
  }
}
