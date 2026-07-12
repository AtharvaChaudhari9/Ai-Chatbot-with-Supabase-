import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
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
                session.user.id = token.sub as string;
                session.user.roles = token.roles as string[] || [];
            }
            // Expose properties to client components securely
            session.accessToken = token.accessToken as string;
            session.error = token.error as string | undefined;
            return session;
        },
    },
});

