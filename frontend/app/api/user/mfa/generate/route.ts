import { NextResponse } from 'next/server';
import { auth } from '@/auth';

function generateRandomBase32Secret(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    secret += alphabet[randomIndex];
  }
  return secret;
}

export async function POST() {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = session.user.email;
    const secret = generateRandomBase32Secret(16); // 16 base32 characters is standard 80-bit length
    const otpauthUri = `otpauth://totp/CognexaChatbot:${encodeURIComponent(email)}?secret=${secret}&issuer=CognexaChatbot`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUri)}`;

    return NextResponse.json({
      secret,
      qrUrl,
    });
  } catch (err: any) {
    console.error('Error generating MFA registration data:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
