import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { auth } from '@/auth';

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();

    // 1. Authenticate user session via NextAuth
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const { documentId, storagePath } = await request.json();
    if (!documentId || !storagePath) {
      return NextResponse.json({ error: 'Missing documentId or storagePath' }, { status: 400 });
    }

    // 3. Fetch user session JWT to forward for security
    const token = session.accessToken;


    // 4. Proxy request to Python backend
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${pythonBackendUrl}/api/benchmark-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        documentId,
        storagePath,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to run OCR benchmark in Python backend' }));
      throw new Error(errorData.detail || 'Failed to execute OCR benchmark');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API Error in /api/benchmark:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
