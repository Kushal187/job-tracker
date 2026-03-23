import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if ('response' in auth) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_logs')
    .select('*, recruiters(name, email, company)')
    .eq('user_id', auth.user.id)
    .order('sent_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch logs', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data });
}
