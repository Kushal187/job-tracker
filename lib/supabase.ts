import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

export function getSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseEnv();
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
