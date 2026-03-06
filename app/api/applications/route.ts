import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { appendApplicationToSheet } from '@/lib/sheets';
import { getSupabaseAdminClient } from '@/lib/supabase';
import type { ApplicationRecord } from '@/lib/types';
import { validateCreatePayload } from '@/lib/validation';

function toDbInsert(payload: {
  company: string;
  jobTitle: string;
  status: string;
  jobUrl: string;
}) {
  return {
    company: payload.company,
    job_title: payload.jobTitle,
    status: payload.status,
    job_url: payload.jobUrl
  };
}

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

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    const status = request.nextUrl.searchParams.get('status');
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');

    let query = supabase
      .from('applications')
      .select('*')
      .order('applied_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (dateFrom) {
      query = query.gte('applied_at', `${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      query = query.lte('applied_at', `${dateTo}T23:59:59.999Z`);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const applications = (data || []).map((item) => toApiApplication(item as ApplicationRecord));

    return NextResponse.json({ applications });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch applications',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = validateCreatePayload(await request.json());
    const requestId = request.headers.get('x-idempotency-key') || randomUUID();
    const supabase = getSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from('applications')
      .select('*')
      .eq('request_id', requestId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return NextResponse.json({
        created: false,
        deduped: true,
        application: toApiApplication(existing as ApplicationRecord)
      });
    }

    const insertPayload = {
      ...toDbInsert(payload),
      request_id: requestId
    };

    const { data, error } = await supabase
      .from('applications')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: retryExisting } = await supabase
          .from('applications')
          .select('*')
          .eq('request_id', requestId)
          .maybeSingle();

        if (retryExisting) {
          return NextResponse.json({
            created: false,
            deduped: true,
            application: toApiApplication(retryExisting as ApplicationRecord)
          });
        }
      }
      throw error;
    }

    const created = data as ApplicationRecord;

    try {
      const rowNumber = await appendApplicationToSheet(created);

      const { data: synced, error: updateError } = await supabase
        .from('applications')
        .update({ sheet_row_number: rowNumber })
        .eq('id', created.id)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        created: true,
        deduped: false,
        application: toApiApplication(synced as ApplicationRecord)
      });
    } catch (sheetError) {
      return NextResponse.json(
        {
          error: 'Application saved to dashboard but failed to sync to sheet',
          applicationId: created.id,
          details: sheetError instanceof Error ? sheetError.message : 'Unknown error'
        },
        { status: 502 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to create application',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}
