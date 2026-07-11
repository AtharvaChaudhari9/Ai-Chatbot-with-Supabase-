'use server';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@/auth';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user session via NextAuth
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch custom agents owned by this user (filtering explicitly now that RLS is bypassed by service role)
    const { data: agents, error: fetchError } = await supabase
      .from('custom_agents')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Failed to fetch agents:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ agents: agents || [] });
  } catch (err: any) {
    console.error('API Error in GET /api/agents:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user session via NextAuth
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const {
      name,
      description,
      avatar_url,
      system_prompt,
      preferred_model,
      local_model_name,
      conversation_starters,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Agent name is required' }, { status: 400 });
    }

    // 3. Insert agent into database
    const { data: agent, error: insertError } = await supabase
      .from('custom_agents')
      .insert({
        user_id: session.user.id,
        name: name.trim(),
        description: description?.trim() || null,
        avatar_url: avatar_url?.trim() || null,
        system_prompt: system_prompt?.trim() || null,
        preferred_model: preferred_model || 'gemini',
        local_model_name: local_model_name || null,
        conversation_starters: conversation_starters || [],
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Failed to create agent:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ agent });
  } catch (err: any) {
    console.error('API Error in POST /api/agents:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

