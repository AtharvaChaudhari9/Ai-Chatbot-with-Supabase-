import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      nickname: profile?.nickname || null,
      avatarUrl: profile?.avatar_url || null,
    });
  } catch (err: any) {
    console.error('API Error in GET /api/user/profile:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { nickname, avatarUrl } = await request.json();

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        nickname: nickname || null,
        avatar_url: avatarUrl || null,
      });

    if (error) {
      console.error('Failed to save profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API Error in POST /api/user/profile:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
