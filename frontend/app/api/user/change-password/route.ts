import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST() {
  try {
    const session = await auth();
    // Validate session and email presence
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;
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

    // 3. Lookup Keycloak user dynamically by email to resolve the correct internal UUID
    const lookupRes = await fetch(`${keycloakInternalUrl}/admin/realms/chatbot-realm/users?email=${encodeURIComponent(userEmail)}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!lookupRes.ok) {
      const errorText = await lookupRes.text();
      console.error('Failed to lookup user by email in Keycloak:', errorText);
      return NextResponse.json({ 
        error: `Failed to fetch user database profile: Keycloak returned Status ${lookupRes.status} - ${errorText || 'No description'}` 
      }, { status: 500 });
    }

    const usersList = await lookupRes.json();
    if (!Array.isArray(usersList) || usersList.length === 0) {
      return NextResponse.json({ error: 'User account not found in Identity Server database.' }, { status: 404 });
    }

    // Extract correct user profile details
    const targetUser = usersList[0];
    const keycloakUUID = targetUser.id; // Real Keycloak UUID
    const existingActions: string[] = targetUser.requiredActions || [];

    // 4. Append UPDATE_PASSWORD required action if not already present
    if (!existingActions.includes('UPDATE_PASSWORD')) {
      existingActions.push('UPDATE_PASSWORD');
    }

    // 5. Update user required actions in Keycloak
    const updateRes = await fetch(`${keycloakInternalUrl}/admin/realms/chatbot-realm/users/${keycloakUUID}`, {
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
        error: `Failed to configure password reset action: Keycloak returned Status ${updateRes.status} - ${errorText || 'No description'}` 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API Error in POST /api/user/change-password:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
