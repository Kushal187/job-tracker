import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from './supabase';

export async function requireAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    };
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    };
  }

  return {
    user: data.user
  };
}
