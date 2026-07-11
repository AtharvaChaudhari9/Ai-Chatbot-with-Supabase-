import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@/auth';

export async function POST(request: Request) {
  let createdDocId: string | null = null;
  let uploadedFilePath: string | null = null;
  const supabase = await createClient();

  try {
    // 1. Authenticate user session via NextAuth
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request payload (multipart/form-data)
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const chatId = formData.get('chatId') as string | null;
    const agentId = formData.get('agentId') as string | null;

    if (!file || (!chatId && !agentId)) {
      return NextResponse.json({ error: 'Missing file, chatId or agentId' }, { status: 400 });
    }

    // 3. Upload file to Supabase Storage Documents bucket
    const timestamp = Date.now();
    // Use Keycloak user UUID and chatId/agentId to partition file paths securely
    const partitionId = chatId ? `chats/${chatId}` : `agents/${agentId}`;
    const filePath = `${session.user.id}/${partitionId}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    uploadedFilePath = filePath;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // 4. Save metadata in the documents table
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        chat_id: chatId || null,
        agent_id: agentId || null,
        user_id: session.user.id,
        name: file.name,
        storage_path: filePath,
        mime_type: file.type || 'application/octet-stream',
      })
      .select('id')

      .single();

    if (docError || !docData) {
      console.error('Database Document Insertion Error:', docError);
      // Clean up uploaded file
      await supabase.storage.from('documents').remove([filePath]);
      return NextResponse.json({ error: `Failed to register document: ${docError?.message}` }, { status: 500 });
    }

    createdDocId = docData.id;

    // 5. Delegate document extraction, chunking, and vector embedding to Python backend
    const token = session.accessToken;

    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${pythonBackendUrl}/api/process-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        document_id: createdDocId,
        storage_path: filePath,
        chat_id: chatId || null,
        agent_id: agentId || null,
        user_id: session.user.id,
        mime_type: file.type || null,
      }),
    });


    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to process document in python backend' }));
      throw new Error(errorData.detail || errorData.error || 'Failed to process document in python backend');
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      documentId: createdDocId,
      name: file.name,
      chunksCount: result.chunks_count || 0,
    });
  } catch (err: any) {
    console.error('API Error in /api/documents/upload:', err);

    // Rollback operations on failure
    if (createdDocId) {
      await supabase.from('documents').delete().eq('id', createdDocId);
    }
    if (uploadedFilePath) {
      await supabase.storage.from('documents').remove([uploadedFilePath]);
    }

    return NextResponse.json(
      { error: err.message || 'Failed to process document upload' },
      { status: 500 }
    );
  }
}
