import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { syncCreatedApplication } from '@/lib/sheet-sync';
import { getSupabaseAdminClient } from '@/lib/supabase';
import type { ApplicationRecord } from '@/lib/types';
import { getUserSettingsRecord } from '@/lib/user-settings';
import { validateCreatePayload } from '@/lib/validation';

function toDbInsert(payload: {
  userId: string;
  company: string;
  jobTitle: string;
  status: string;
  jobUrl: string;
  requestId: string;
}) {
  return {
    user_id: payload.userId,
    company: payload.company,
    job_title: payload.jobTitle,
    status: payload.status,
    job_url: payload.jobUrl,
    request_id: payload.requestId
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
    const auth = await requireAuthenticatedUser(request);
    if ('response' in auth) return auth.response;

    const supabase = getSupabaseAdminClient();
    const status = request.nextUrl.searchParams.get('status');
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');

    let query = supabase
      .from('applications')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('sheet_row_number', { ascending: false, nullsFirst: false })
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
    const auth = await requireAuthenticatedUser(request);
    if ('response' in auth) return auth.response;

    const payload = validateCreatePayload(await request.json());
    const requestId = request.headers.get('x-idempotency-key') || randomUUID();
    const supabase = getSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', auth.user.id)
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

    const insertPayload = toDbInsert({
      userId: auth.user.id,
      company: payload.company,
      jobTitle: payload.jobTitle,
      status: payload.status,
      jobUrl: payload.jobUrl,
      requestId
    });

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
          .eq('user_id', auth.user.id)
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
      const settings = await getUserSettingsRecord(supabase, auth.user.id);
      const synced = await syncCreatedApplication(supabase, created, settings);

      return NextResponse.json({
        created: true,
        deduped: false,
        application: toApiApplication(synced)
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
