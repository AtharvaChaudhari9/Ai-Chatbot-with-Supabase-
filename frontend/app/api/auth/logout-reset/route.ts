import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  // Clear all NextAuth session & CSRF cookies
  allCookies.forEach((c) => {
    if (c.name.includes('session-token') || c.name.includes('csrf') || c.name.includes('callback') || c.name.includes('auth')) {
      cookieStore.delete(c.name);
    }
  });

  const url = new URL('/login?prompt=login', req.url);
  const response = NextResponse.redirect(url);

  // Expire cookies explicitly on response
  ['authjs.session-token', '__Secure-authjs.session-token', 'next-auth.session-token', '__Secure-next-auth.session-token'].forEach((cookieName) => {
    response.cookies.set(cookieName, '', {
      path: '/',
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
  });

  return response;
}
