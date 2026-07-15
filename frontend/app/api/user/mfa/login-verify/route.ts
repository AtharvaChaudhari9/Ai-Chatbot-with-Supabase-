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

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    // Retrieve user's stored secret from the database
    const supabase = createAdminClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('mfa_secret, mfa_enabled')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to retrieve user profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!profile || !profile.mfa_enabled || !profile.mfa_secret) {
      return NextResponse.json({ error: 'MFA is not enabled for this user.' }, { status: 400 });
    }

    const isValid = verifyTOTP(code, profile.mfa_secret);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in POST /api/user/mfa/login-verify:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
