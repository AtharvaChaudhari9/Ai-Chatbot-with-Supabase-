import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url')?.trim() || 'http://127.0.0.1:11434';

  try {
    const res = await fetch(`${targetUrl}/api/tags`, {
      // Set a short timeout so it doesn't hang if Ollama is not running
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Ollama returned status ${res.status}`, models: [] },
        { status: 200 }
      );
    }

    const data = await res.json();
    const models = data.models?.map((m: any) => m.name) || [];
    return NextResponse.json({ models });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Could not connect to Ollama', models: [] },
      { status: 200 }
    );
  }
}
