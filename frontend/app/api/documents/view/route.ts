import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { auth } from '@/auth';

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();

    // 1. Authenticate user session via NextAuth
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId parameter' }, { status: 400 });
    }

    // 3. Find document and verify user ownership
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('name, mime_type, storage_path')
      .eq('id', documentId)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found or unauthorized' }, { status: 404 });
    }

    // 4. Create a 60-minute signed URL from Supabase Storage
    const { data: signedData, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 3600);

    if (signedError || !signedData?.signedUrl) {
      console.error('Failed to create signed URL:', signedError);
      return NextResponse.json(
        { error: `Failed to generate view link: ${signedError?.message || 'Storage error'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: signedData.signedUrl,
      name: doc.name,
      mimeType: doc.mime_type,
    });
  } catch (err: any) {
    console.error('API Error in /api/documents/view:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
