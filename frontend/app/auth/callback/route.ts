import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Redirect to '/chat' after login
  const next = searchParams.get('next') ?? '/chat';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const host = request.headers.get('host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else {
        const redirectHost = forwardedHost || host || new URL(origin).host;
        return NextResponse.redirect(`https://${redirectHost}${next}`);
      }
    }
  }

  // Redirect to landing page in case of error
  return NextResponse.redirect(`${origin}/`);
}
