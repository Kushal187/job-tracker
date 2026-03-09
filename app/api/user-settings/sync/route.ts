import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { syncAllApplicationsForUser } from '@/lib/sheet-sync';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { getUserSettingsRecord } from '@/lib/user-settings';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if ('response' in auth) return auth.response;

    const supabase = getSupabaseAdminClient();
    const settings = await getUserSettingsRecord(supabase, auth.user.id);

    const syncedCount = await syncAllApplicationsForUser(
      supabase,
      auth.user.id,
      settings
    );

    return NextResponse.json({
      synced: true,
      syncedCount
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to sync applications to Google Sheets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}
