import { getSheetsEnv } from './env';
import { getSupabaseAdminClient } from './supabase';
import type { UserSettingsRecord } from './types';

export type UserSettings = {
  googleSheetId: string | null;
  googleSheetTab: string;
  googleSheetSyncEnabled: boolean;
  sheetsAvailable: boolean;
  serviceAccountEmail: string | null;
};

export function defaultUserSettings(): UserSettings {
  const sheetsEnv = getSheetsEnv();

  return {
    googleSheetId: null,
    googleSheetTab: sheetsEnv?.defaultSheetTab || 'Applications',
    googleSheetSyncEnabled: false,
    sheetsAvailable: Boolean(sheetsEnv),
    serviceAccountEmail: sheetsEnv?.serviceAccountEmail || null
  };
}

export function toApiUserSettings(record: UserSettingsRecord | null): UserSettings {
  const defaults = defaultUserSettings();

  if (!record) {
    return defaults;
  }

  return {
    googleSheetId: record.google_sheet_id,
    googleSheetTab: record.google_sheet_tab,
    googleSheetSyncEnabled: record.google_sheet_sync_enabled,
    sheetsAvailable: defaults.sheetsAvailable,
    serviceAccountEmail: defaults.serviceAccountEmail
  };
}

export function getSheetTarget(settings: UserSettingsRecord | null) {
  if (!settings?.google_sheet_sync_enabled || !settings.google_sheet_id) {
    return null;
  }

  return {
    sheetId: settings.google_sheet_id,
    sheetTab: settings.google_sheet_tab
  };
}

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

export async function getUserSettingsRecord(
  supabase: AdminClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as UserSettingsRecord | null) ?? null;
}
