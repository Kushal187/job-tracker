function mustGet(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalGet(name: string): string | null {
  const value = process.env[name];
  return value ? value : null;
}

export function getSupabaseEnv() {
  return {
    url: mustGet('SUPABASE_URL'),
    serviceRoleKey: mustGet('SUPABASE_SERVICE_ROLE_KEY')
  };
}

export function getSheetsEnv() {
  const rawServiceAccount = optionalGet('GOOGLE_SERVICE_ACCOUNT_JSON');

  if (!rawServiceAccount) {
    return null;
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(rawServiceAccount);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON');
  }

  return {
    defaultSheetTab: process.env.GOOGLE_SHEET_TAB || 'Applications',
    serviceAccount,
    serviceAccountEmail:
      typeof serviceAccount.client_email === 'string' ? serviceAccount.client_email : null
  };
}
