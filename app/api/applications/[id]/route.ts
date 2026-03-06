import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { deleteApplicationFromSheet, updateApplicationOnSheet } from '@/lib/sheets';
import type { ApplicationRecord } from '@/lib/types';
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
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    const updated = data as ApplicationRecord;

    try {
      await updateApplicationOnSheet(updated);
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

    return NextResponse.json({
      updated: true,
      application: toApiApplication(updated)
    });
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
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from('applications')
      .select('id, sheet_row_number')
      .eq('id', id)
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

    const existingRecord = existing as Pick<ApplicationRecord, 'id' | 'sheet_row_number'>;

    if (existingRecord.sheet_row_number) {
      try {
        await deleteApplicationFromSheet(existingRecord.sheet_row_number);
      } catch (sheetError) {
        return NextResponse.json(
          {
            error: 'Failed to delete application from Google Sheets',
            applicationId: existingRecord.id,
            details: sheetError instanceof Error ? sheetError.message : 'Unknown error'
          },
          { status: 502 }
        );
      }
    }

    const { error: deleteError } = await supabase.from('applications').delete().eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    if (existingRecord.sheet_row_number) {
      const { data: shiftedRows, error: shiftedRowsError } = await supabase
        .from('applications')
        .select('id, sheet_row_number')
        .gt('sheet_row_number', existingRecord.sheet_row_number);

      if (shiftedRowsError) {
        return NextResponse.json(
          {
            error: 'Application deleted, but failed to reindex sheet row numbers',
            applicationId: existingRecord.id,
            details: shiftedRowsError.message
          },
          { status: 502 }
        );
      }

      for (const row of (shiftedRows || []) as Array<Pick<ApplicationRecord, 'id' | 'sheet_row_number'>>) {
        if (!row.sheet_row_number) continue;
        const { error: updateRowError } = await supabase
          .from('applications')
          .update({ sheet_row_number: row.sheet_row_number - 1 })
          .eq('id', row.id);

        if (updateRowError) {
          return NextResponse.json(
            {
              error: 'Application deleted, but failed to reindex sheet row numbers',
              applicationId: existingRecord.id,
              details: updateRowError.message
            },
            { status: 502 }
          );
        }
      }
    }

    return NextResponse.json({
      deleted: true,
      id
    });
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
