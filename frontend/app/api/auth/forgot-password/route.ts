import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, newPassword } = body || {};

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

    // 2. Lookup user by email in chatbot-realm
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
      // Return a generic response for security privacy
      return NextResponse.json({
        success: true,
        message: 'If an account associated with this email exists, password update instructions have been processed.',
      });
    }

    const targetUser = usersList[0];
    const keycloakUUID = targetUser.id;

    if (newPassword) {
      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters long.' },
          { status: 400 }
        );
      }

      // Direct reset password call via Keycloak Admin API
      const resetRes = await fetch(
        `${keycloakInternalUrl}/admin/realms/chatbot-realm/users/${keycloakUUID}/reset-password`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'password',
            value: newPassword,
            temporary: false,
          }),
        }
      );

      if (!resetRes.ok) {
        const errorText = await resetRes.text();
        console.error('Failed to reset user password in Keycloak:', errorText);
        return NextResponse.json(
          { error: `Failed to reset password: ${errorText || 'Keycloak error'}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Your password has been successfully updated! You can now log in with your new password.',
      });
    } else {
      // If no new password supplied, flag user for UPDATE_PASSWORD required action
      const existingActions: string[] = targetUser.requiredActions || [];
      if (!existingActions.includes('UPDATE_PASSWORD')) {
        existingActions.push('UPDATE_PASSWORD');
      }

      const updateRes = await fetch(
        `${keycloakInternalUrl}/admin/realms/chatbot-realm/users/${keycloakUUID}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requiredActions: existingActions,
          }),
        }
      );

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        console.error('Failed to update required actions in Keycloak:', errorText);
        return NextResponse.json(
          { error: 'Failed to configure password reset action.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Password reset flag set. Next time you sign in, you will be prompted to set a new password.',
      });
    }
  } catch (err: any) {
    console.error('API Error in POST /api/auth/forgot-password:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
