import { NextRequest, NextResponse } from 'next/server';
import { validateRequestAuth } from '@/lib/firebase/auth';
import { fetchCaseById, updateCaseRecord, logCaseActivity, fetchCaseActivities } from '@/lib/firebase/admin';
import { UpdateCaseSchema } from '@/schemas';
import { CaseStatus } from '@/types';


// Valid status transitions
const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  intake: ['matched', 'in_review', 'closed'],
  matched: ['in_review', 'action_plan_ready', 'closed'],
  in_review: ['action_plan_ready', 'matched', 'closed'],
  action_plan_ready: ['referred', 'in_review', 'closed'],
  referred: ['closed', 'in_review'],
  closed: ['in_review'], // reopen
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await validateRequestAuth(request);
  if (!authResult.authorized) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'Unauthorized' },
      { status: authResult.status }
    );
  }

  const { id } = await context.params;
  const caseRecord = await fetchCaseById(id);

  if (!caseRecord) {
    return NextResponse.json(
      { success: false, error: `Case '${id}' not found.` },
      { status: 404 }
    );
  }

  const activities = await fetchCaseActivities(id);

  return NextResponse.json({
    success: true,
    data: {
      ...caseRecord,
      activities,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await validateRequestAuth(request);
  if (!authResult.authorized) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'Unauthorized' },
      { status: authResult.status }
    );
  }

  const { id } = await context.params;
  const existingCase = await fetchCaseById(id);

  if (!existingCase) {
    return NextResponse.json(
      { success: false, error: `Case '${id}' not found.` },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const parseResult = UpdateCaseSchema.safeParse(body);

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

    const { status, assignedCoordinator, notes } = parseResult.data;

    // Validate status transition
    if (status && status !== existingCase.status) {
      const allowed = ALLOWED_TRANSITIONS[existingCase.status] || [];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status transition from '${existingCase.status}' to '${status}'. Allowed: ${allowed.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    const updated = await updateCaseRecord(id, {
      status,
      assignedCoordinator,
    });

    if (status || notes) {
      await logCaseActivity({
        caseId: id,
        actionType: 'status_change',
        resourceId: null,
        status: status || existingCase.status,
        notes: notes || `Case updated by ${authResult.email || 'coordinator'}.`,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error(`Failed to update case ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to update case.' },
      { status: 500 }
    );
  }
}
