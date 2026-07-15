import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { auth } from '@/auth';
import { verifyTOTP } from '@/lib/totp';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, secret } = await request.json();
    if (!code || !secret) {
      return NextResponse.json({ error: 'Verification code and secret are required' }, { status: 400 });
    }

    const isValid = verifyTOTP(code, secret);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 400 });
    }

    // Save secret and enable MFA in the database
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        mfa_secret: secret,
        mfa_enabled: true,
      });

    if (error) {
      console.error('Failed to enable MFA in database:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in POST /api/user/mfa/verify:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
