function mustGet(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseEnv() {
  return {
    url: mustGet('SUPABASE_URL'),
    serviceRoleKey: mustGet('SUPABASE_SERVICE_ROLE_KEY')
  };
}

export function getSheetsEnv() {
  const rawServiceAccount = mustGet('GOOGLE_SERVICE_ACCOUNT_JSON');

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(rawServiceAccount);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON');
  }

  return {
    sheetId: mustGet('GOOGLE_SHEET_ID'),
    sheetTab: process.env.GOOGLE_SHEET_TAB || 'Applications',
    serviceAccount
  };
}
