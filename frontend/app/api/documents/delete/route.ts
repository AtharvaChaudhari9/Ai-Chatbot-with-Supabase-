import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@/auth';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user session via NextAuth
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    const { documentId } = await request.json();
    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    // 3. Find document and verify ownership
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', documentId)
      .eq('user_id', session.user.id)
      .single();


    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 4. Remove file from storage
    const { error: removeStorageError } = await supabase.storage
      .from('documents')
      .remove([doc.storage_path]);

    if (removeStorageError) {
      console.warn('Storage removal failed or file already deleted:', removeStorageError);
    }

    // Call Python backend to delete chunks from Qdrant vector store
    try {
      const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
      const deleteQdrantRes = await fetch(`${pythonBackendUrl}/api/delete-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_id: documentId }),
      });
      if (!deleteQdrantRes.ok) {
        console.warn(`Qdrant deletion failed in FastAPI backend with status ${deleteQdrantRes.status}`);
      } else {
        console.log(`Successfully synced deletion with Qdrant for document: ${documentId}`);
      }
    } catch (qdErr) {
      console.error('Failed to communicate document deletion to FastAPI backend:', qdErr);
    }

    // 5. Delete document metadata row (cascade will delete associated chunks)
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', session.user.id);


    if (deleteError) {
      return NextResponse.json({ error: `Failed to delete database entry: ${deleteError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API Error in /api/documents/delete:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
