import { getSupabaseAdminClient } from './supabase';
import {
  appendApplicationToSheet,
  deleteApplicationFromSheet,
  rewriteApplicationsSheet,
  updateApplicationOnSheet
} from './sheets';
import { getSheetTarget } from './user-settings';
import type { ApplicationRecord, UserSettingsRecord } from './types';

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

async function setApplicationRowNumber(
  supabase: AdminClient,
  applicationId: string,
  userId: string,
  sheetRowNumber: number | null
) {
  const { data, error } = await supabase
    .from('applications')
    .update({ sheet_row_number: sheetRowNumber })
    .eq('id', applicationId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as ApplicationRecord;
}

export async function syncCreatedApplication(
  supabase: AdminClient,
  application: ApplicationRecord,
  settings: UserSettingsRecord | null
) {
  const target = getSheetTarget(settings);
  if (!target) {
    return application;
  }

  const rowNumber = await appendApplicationToSheet(application, target);
  return setApplicationRowNumber(supabase, application.id, application.user_id, rowNumber);
}

export async function syncUpdatedApplication(
  supabase: AdminClient,
  application: ApplicationRecord,
  settings: UserSettingsRecord | null
) {
  const target = getSheetTarget(settings);
  if (!target) {
    return application;
  }

  if (application.sheet_row_number) {
    await updateApplicationOnSheet(application, target);
    return application;
  }

  const rowNumber = await appendApplicationToSheet(application, target);
  return setApplicationRowNumber(supabase, application.id, application.user_id, rowNumber);
}

export async function syncDeletedApplication(
  supabase: AdminClient,
  userId: string,
  sheetRowNumber: number | null,
  settings: UserSettingsRecord | null
) {
  const target = getSheetTarget(settings);
  if (!target || !sheetRowNumber) {
    return;
  }

  await deleteApplicationFromSheet(sheetRowNumber, target);

  const { data: shiftedRows, error: shiftedRowsError } = await supabase
    .from('applications')
    .select('id, user_id, sheet_row_number')
    .eq('user_id', userId)
    .gt('sheet_row_number', sheetRowNumber);

  if (shiftedRowsError) {
    throw shiftedRowsError;
  }

  for (const row of (shiftedRows || []) as ApplicationRecord[]) {
    if (!row.sheet_row_number) continue;

    const { error: updateRowError } = await supabase
      .from('applications')
      .update({ sheet_row_number: row.sheet_row_number - 1 })
      .eq('id', row.id)
      .eq('user_id', userId);

    if (updateRowError) {
      throw updateRowError;
    }
  }
}

export async function syncAllApplicationsForUser(
  supabase: AdminClient,
  userId: string,
  settings: UserSettingsRecord | null
) {
  const target = getSheetTarget(settings);
  if (!target) {
    throw new Error('Google Sheets sync is not configured for this account');
  }

  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .order('applied_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

  const applications = (data || []) as ApplicationRecord[];
  const rowMap = await rewriteApplicationsSheet(applications, target);

  const { error: clearError } = await supabase
    .from('applications')
    .update({ sheet_row_number: null })
    .eq('user_id', userId);

  if (clearError) {
    throw clearError;
  }

  for (const application of applications) {
    const rowNumber = rowMap.get(application.id) ?? null;
    const { error: updateError } = await supabase
      .from('applications')
      .update({ sheet_row_number: rowNumber })
      .eq('id', application.id)
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }
  }

  return applications.length;
}
