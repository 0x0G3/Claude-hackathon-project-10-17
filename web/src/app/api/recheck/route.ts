import { NextRequest, NextResponse } from 'next/server';
import { RecheckRequestSchema } from '@/schemas';
import { getResourceById } from '@/lib/resources/loader';
import { recheckListing } from '@/lib/offline/recheck';

/** Re-check one listing against its own page. Returns a diff; nothing changes until a person approves. */
export async function POST(request: NextRequest) {
  try {
    const parseResult = RecheckRequestSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.format() },
        { status: 400 }
      );
    }
    const { resource_id, useAi } = parseResult.data;
    if (!getResourceById(resource_id)) {
      return NextResponse.json({ success: false, error: `Resource '${resource_id}' not found.` }, { status: 404 });
    }
    const result = await recheckListing(resource_id, useAi && Boolean(process.env.ANTHROPIC_API_KEY));
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Re-check failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to re-check the listing.' }, { status: 500 });
  }
}
