import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

async function getDeterministicUuid(input: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const parts = [
    hashHex.substring(0, 8),
    hashHex.substring(8, 12),
    '4' + hashHex.substring(13, 16),
    'a' + hashHex.substring(17, 20),
    hashHex.substring(20, 32)
  ];
  return parts.join('-');
}

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    idToken?: string;
    error?: string;
  }
  interface User {
    roles?: string[];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Keycloak({
            clientId: process.env.AUTH_KEYCLOAK_ID,
            clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
            issuer: process.env.AUTH_KEYCLOAK_ISSUER,
            authorization: `${process.env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/auth`,
            token: `http://keycloak:8080/realms/chatbot-realm/protocol/openid-connect/token`,
            userinfo: `http://keycloak:8080/realms/chatbot-realm/protocol/openid-connect/userinfo`,
            jwks_endpoint: `http://keycloak:8080/realms/chatbot-realm/protocol/openid-connect/certs`,
        }),
    ],
    callbacks: {
        async jwt({ token, account }) {
            console.log("DEBUG: JWT Callback - token.sub =", token.sub, "token.email =", token.email);
            // First-time login: store access and refresh tokens
            if (account) {
                let roles: string[] = [];
                if (account.access_token) {
                    try {
                        const payloadB64 = account.access_token.split('.')[1];
                        const payloadJson = Buffer.from(payloadB64, 'base64').toString('ascii');
                        const payload = JSON.parse(payloadJson);
                        roles = payload.realm_access?.roles || [];
                    } catch (e) {
                        console.error("Error decoding access token for roles:", e);
                    }
                }
                return {
                    ...token,
                    accessToken: account.access_token,
                    idToken: account.id_token,
                    expiresAt: account.expires_at ? account.expires_at * 1000 : 0, // Convert to ms
                    refreshToken: account.refresh_token,
                    roles,
                };
            }

            // Return token if it hasn't expired yet
            if (Date.now() < (token.expiresAt as number)) {
                return token;
            }

            // Access Token expired: Trigger token refresh
            try {
                const response = await fetch(`${process.env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        client_id: process.env.AUTH_KEYCLOAK_ID!,
                        client_secret: process.env.AUTH_KEYCLOAK_SECRET!,
                        grant_type: "refresh_token",
                        refresh_token: token.refreshToken as string,
                    }),
                });

                const tokens = await response.json();
                if (!response.ok) throw tokens;

                let roles = token.roles as string[] || [];
                if (tokens.access_token) {
                    try {
                        const payloadB64 = tokens.access_token.split('.')[1];
                        const payloadJson = Buffer.from(payloadB64, 'base64').toString('ascii');
                        const payload = JSON.parse(payloadJson);
                        roles = payload.realm_access?.roles || [];
                    } catch (e) {
                        console.error("Error decoding refreshed access token for roles:", e);
                    }
                }

                return {
                    ...token,
                    accessToken: tokens.access_token,
                    expiresAt: Date.now() + tokens.expires_in * 1000,
                    refreshToken: tokens.refresh_token ?? token.refreshToken, // Keycloak may rotate refresh tokens
                    roles,
                };
            } catch (error) {
                console.error("Error refreshing Access Token:", error);
                return { ...token, error: "RefreshAccessTokenError" };
            }
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                const stableKey = token.email || token.sub || "";
                session.user.id = await getDeterministicUuid(stableKey as string);
                session.user.roles = token.roles as string[] || [];
                console.log("DEBUG: Session Callback - mapped stable UUID =", session.user.id, "for stableKey =", stableKey);
            }
            // Expose properties to client components securely
            session.accessToken = token.accessToken as string;
            session.idToken = token.idToken as string;
            session.error = token.error as string | undefined;
            return session;
        },
    },
});

