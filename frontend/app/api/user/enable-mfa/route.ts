import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST() {
  try {
    const session = await auth();
    // Validate session and Keycloak unique user ID presence
    if (!session || !session.user || !session.user.keycloakId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keycloakId = session.user.keycloakId;
    const keycloakInternalUrl = 'http://keycloak:8080';

    // 1. Fetch Keycloak Master Admin credentials for API access
    const adminUser = process.env.KEYCLOAK_ADMIN || 'admin';
    const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

    // 2. Obtain OAuth admin access token from master realm
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
      return NextResponse.json({ error: 'Failed to authenticate with Identity Server' }, { status: 500 });
    }

    const tokenData = await tokenRes.json();
    const adminToken = tokenData.access_token;

    // 3. Fetch current user metadata from chatbot realm to preserve existing required actions
    const userRes = await fetch(`${keycloakInternalUrl}/admin/realms/chatbot-realm/users/${keycloakId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error('Failed to fetch user metadata from Keycloak:', errorText);
      return NextResponse.json({ 
        error: `Failed to locate user details: Keycloak returned Status ${userRes.status} - ${errorText || 'No description'}` 
      }, { status: 500 });
    }

    const userData = await userRes.json();
    const existingActions: string[] = userData.requiredActions || [];

    // 4. Append CONFIGURE_OTP required action if not already present
    if (!existingActions.includes('CONFIGURE_OTP')) {
      existingActions.push('CONFIGURE_OTP');
    }

    // 5. Update user actions back to Keycloak
    const updateRes = await fetch(`${keycloakInternalUrl}/admin/realms/chatbot-realm/users/${keycloakId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requiredActions: existingActions,
      }),
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.error('Failed to update Keycloak user required actions:', errorText);
      return NextResponse.json({ 
        error: `Failed to configure Multi-Factor Authentication prompt: Keycloak returned Status ${updateRes.status} - ${errorText || 'No description'}` 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API Error in POST /api/user/enable-mfa:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
