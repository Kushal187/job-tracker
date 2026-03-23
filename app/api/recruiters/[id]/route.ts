import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if ('response' in auth) return auth.response;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.email !== undefined) updates.email = body.email;
  if (body.company !== undefined) updates.company = body.company;
  if (body.title !== undefined) updates.title = body.title;
  if (body.linkedinUrl !== undefined) updates.linkedin_url = body.linkedinUrl;
  if (body.notes !== undefined) updates.notes = body.notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('recruiters')
    .update(updates)
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update recruiter', details: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Recruiter not found' }, { status: 404 });
  }

  return NextResponse.json({ recruiter: data });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if ('response' in auth) return auth.response;

  const { id } = await context.params;
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from('recruiters')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete recruiter', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
