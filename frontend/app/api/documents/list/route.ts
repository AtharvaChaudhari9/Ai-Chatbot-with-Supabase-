import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    const agentId = searchParams.get('agentId');

    if (!chatId && !agentId) {
      return NextResponse.json({ error: 'Missing chatId or agentId parameter' }, { status: 400 });
    }

    // 3. Fetch documents for this chat or agent
    let dbQuery = supabase
      .from('documents')
      .select('id, name, mime_type, storage_path, created_at')
      .eq('user_id', user.id);

    if (chatId) {
      dbQuery = dbQuery.eq('chat_id', chatId);
    } else {
      dbQuery = dbQuery.eq('agent_id', agentId);
    }

    const { data: docs, error: fetchError } = await dbQuery.order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Failed to fetch documents list:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ documents: docs || [] });
  } catch (err: any) {
    console.error('API Error in /api/documents/list:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
