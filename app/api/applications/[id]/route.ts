import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import {
  syncDeletedApplication,
  syncUpdatedApplication
} from '@/lib/sheet-sync';
import { getSupabaseAdminClient } from '@/lib/supabase';
import type { ApplicationRecord } from '@/lib/types';
import { getUserSettingsRecord } from '@/lib/user-settings';
import { validateUpdatePayload } from '@/lib/validation';

function toApiApplication(record: ApplicationRecord) {
  return {
    id: record.id,
    company: record.company,
    jobTitle: record.job_title,
    status: record.status,
    jobUrl: record.job_url,
    appliedAt: record.applied_at,
    updatedAt: record.updated_at,
    sheetRowNumber: record.sheet_row_number
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if ('response' in auth) return auth.response;

    const { id } = await context.params;
    const payload = validateUpdatePayload(await request.json());
    const supabase = getSupabaseAdminClient();

    const updatePayload: Record<string, string> = {};
    if (payload.company) updatePayload.company = payload.company;
    if (payload.jobTitle) updatePayload.job_title = payload.jobTitle;
    if (payload.status) updatePayload.status = payload.status;
    if (payload.jobUrl) updatePayload.job_url = payload.jobUrl;

    const { data, error } = await supabase
      .from('applications')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    const updated = data as ApplicationRecord;

    try {
      const settings = await getUserSettingsRecord(supabase, auth.user.id);
      const synced = await syncUpdatedApplication(supabase, updated, settings);

      return NextResponse.json({
        updated: true,
        application: toApiApplication(synced)
      });
    } catch (sheetError) {
      return NextResponse.json(
        {
          error: 'Application updated in dashboard but failed to sync to sheet',
          applicationId: updated.id,
          details: sheetError instanceof Error ? sheetError.message : 'Unknown error'
        },
        { status: 502 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to update application',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if ('response' in auth) return auth.response;

    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existing) {
      return NextResponse.json(
        {
          error: 'Application not found'
        },
        { status: 404 }
      );
    }

    const existingRecord = existing as ApplicationRecord;

    const { error: deleteError } = await supabase
      .from('applications')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (deleteError) {
      throw deleteError;
    }

    try {
      const settings = await getUserSettingsRecord(supabase, auth.user.id);
      await syncDeletedApplication(
        supabase,
        auth.user.id,
        existingRecord.sheet_row_number,
        settings
      );

      return NextResponse.json({
        deleted: true,
        id
      });
    } catch (sheetError) {
      return NextResponse.json(
        {
          error: 'Application deleted, but failed to sync the connected sheet',
          applicationId: existingRecord.id,
          details: sheetError instanceof Error ? sheetError.message : 'Unknown error'
        },
        { status: 502 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to delete application',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}
