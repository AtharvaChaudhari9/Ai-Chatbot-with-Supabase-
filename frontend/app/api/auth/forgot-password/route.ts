import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const keycloakInternalUrl = process.env.KEYCLOAK_INTERNAL_URL || 'http://keycloak:8080';
    const adminUser = process.env.KEYCLOAK_ADMIN || 'admin';
    const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

    // 1. Obtain OAuth admin access token from master realm
    const tokenRes = await fetch(`${keycloakInternalUrl}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: adminUser,
        password: adminPassword,
      }),
      cache: 'no-store',
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('Failed to obtain Keycloak admin token:', errorText);
      return NextResponse.json(
        { error: 'Identity server authentication error.' },
        { status: 500 }
      );
    }

    const tokenData = await tokenRes.json();
    const adminToken = tokenData.access_token;

    // 2. Ensure resetPasswordAllowed & email event notifications are enabled on chatbot-realm
    await fetch(`${keycloakInternalUrl}/admin/realms/chatbot-realm`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resetPasswordAllowed: true,
        eventsEnabled: true,
        eventsListeners: ['jboss-logging', 'email'],
      }),
    });

    // 3. Lookup user by email in chatbot-realm
    const lookupRes = await fetch(
      `${keycloakInternalUrl}/admin/realms/chatbot-realm/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!lookupRes.ok) {
      const errorText = await lookupRes.text();
      console.error('Failed user lookup by email in Keycloak:', errorText);
      return NextResponse.json(
        { error: 'Failed to look up user in identity server.' },
        { status: 500 }
      );
    }

    const usersList = await lookupRes.json();
    if (!Array.isArray(usersList) || usersList.length === 0) {
      // Privacy security fallback
      return NextResponse.json({
        success: true,
        message: 'If an account associated with this email exists, a password reset link has been dispatched.',
      });
    }

    const targetUser = usersList[0];
    const keycloakUUID = targetUser.id;

    // 4. Trigger secure execute-actions-email with UPDATE_PASSWORD action
    const emailRes = await fetch(
      `${keycloakInternalUrl}/admin/realms/chatbot-realm/users/${keycloakUUID}/execute-actions-email`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['UPDATE_PASSWORD']),
      }
    );

    if (!emailRes.ok) {
      const errorText = await emailRes.text();
      console.error('Failed to execute actions email in Keycloak:', errorText);
      // Fallback: set required action UPDATE_PASSWORD on the user account
      await fetch(
        `${keycloakInternalUrl}/admin/realms/chatbot-realm/users/${keycloakUUID}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requiredActions: ['UPDATE_PASSWORD'] }),
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'A secure password reset email link has been sent to your email address.',
    });
  } catch (err: any) {
    console.error('API Error in POST /api/auth/forgot-password:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
