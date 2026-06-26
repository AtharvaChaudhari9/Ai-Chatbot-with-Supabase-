import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // 1. Authenticate user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch specific agent
    const { data: agent, error: fetchError } = await supabase
      .from('custom_agents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (err: any) {
    console.error(`API Error in GET /api/agents/[id]:`, err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    // 3. Update agent in database
    const { data: agent, error: updateError } = await supabase
      .from('custom_agents')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        avatar_url: avatar_url?.trim() || null,
        system_prompt: system_prompt?.trim() || null,
        preferred_model: preferred_model || 'gemini',
        local_model_name: local_model_name || null,
        conversation_starters: conversation_starters || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to update agent:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ agent });
  } catch (err: any) {
    console.error('API Error in PUT /api/agents/[id]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify agent ownership and get details
    const { data: agent, error: verifyError } = await supabase
      .from('custom_agents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (verifyError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // 3. Retrieve agent's KB documents for clean storage & Qdrant deletion
    const { data: docs } = await supabase
      .from('documents')
      .select('id, storage_path')
      .eq('agent_id', id)
      .eq('user_id', user.id);

    if (docs && docs.length > 0) {
      const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

      for (const doc of docs) {
        // A. Remove file from Supabase storage
        await supabase.storage.from('documents').remove([doc.storage_path]);

        // B. Delete vectors in Qdrant
        try {
          await fetch(`${pythonBackendUrl}/api/delete-document`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ document_id: doc.id }),
          });
        } catch (qdErr) {
          console.error(`Failed to delete Qdrant vectors for doc ${doc.id} during agent deletion:`, qdErr);
        }
      }
    }

    // 4. Delete avatar file if stored in Supabase storage
    if (agent.avatar_url && agent.avatar_url.startsWith('avatars/')) {
      await supabase.storage.from('documents').remove([agent.avatar_url]);
    }

    // 5. Delete custom agent row (cascade will delete associated document database rows)
    const { error: deleteError } = await supabase
      .from('custom_agents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Failed to delete agent:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API Error in DELETE /api/agents/[id]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
