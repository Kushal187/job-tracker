import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';
import {
  getUserSettingsRecord,
  toApiUserSettings
} from '@/lib/user-settings';
import { validateUserSettingsPayload } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if ('response' in auth) return auth.response;

    const supabase = getSupabaseAdminClient();
    const settings = await getUserSettingsRecord(supabase, auth.user.id);

    return NextResponse.json({
      settings: toApiUserSettings(settings)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch user settings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if ('response' in auth) return auth.response;

    const payload = validateUserSettingsPayload(await request.json());
    const supabase = getSupabaseAdminClient();
    const existing = await getUserSettingsRecord(supabase, auth.user.id);

    const nextSheetId =
      payload.googleSheetId !== undefined
        ? payload.googleSheetId
        : existing?.google_sheet_id ?? null;

    const nextSheetTab =
      payload.googleSheetTab ?? existing?.google_sheet_tab ?? 'Applications';

    const nextSyncEnabled =
      payload.googleSheetSyncEnabled ?? existing?.google_sheet_sync_enabled ?? false;

    if (nextSyncEnabled && !nextSheetId) {
      return NextResponse.json(
        {
          error: 'A Google Sheet ID is required before sync can be enabled'
        },
        { status: 400 }
      );
    }

    const targetChanged =
      existing?.google_sheet_id !== nextSheetId ||
      existing?.google_sheet_tab !== nextSheetTab;

    const { data, error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: auth.user.id,
          google_sheet_id: nextSheetId,
          google_sheet_tab: nextSheetTab,
          google_sheet_sync_enabled: nextSyncEnabled
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    if (targetChanged) {
      const { error: clearError } = await supabase
        .from('applications')
        .update({ sheet_row_number: null })
        .eq('user_id', auth.user.id);

      if (clearError) {
        throw clearError;
      }
    }

    return NextResponse.json({
      saved: true,
      requiresFullSync: targetChanged && Boolean(nextSheetId),
      settings: toApiUserSettings(data)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to update user settings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}
