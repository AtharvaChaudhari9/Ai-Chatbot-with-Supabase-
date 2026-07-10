import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Keycloak({
            clientId: process.env.AUTH_KEYCLOAK_ID,
            clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
            issuer: process.env.AUTH_KEYCLOAK_ISSUER,
        }),
    ],
    callbacks: {
        async jwt({ token, account }) {
            // First-time login: store access and refresh tokens
            if (account) {
                return {
                    ...token,
                    accessToken: account.access_token,
                    idToken: account.id_token,
                    expiresAt: account.expires_at ? account.expires_at * 1000 : 0, // Convert to ms
                    refreshToken: account.refresh_token,
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

                return {
                    ...token,
                    accessToken: tokens.access_token,
                    expiresAt: Date.now() + tokens.expires_in * 1000,
                    refreshToken: tokens.refresh_token ?? token.refreshToken, // Keycloak may rotate refresh tokens
                };
            } catch (error) {
                console.error("Error refreshing Access Token:", error);
                return { ...token, error: "RefreshAccessTokenError" };
            }
        },
        async session({ session, token }) {
            // Expose properties to client components securely
            session.accessToken = token.accessToken as string;
            session.error = token.error as string | undefined;
            return session;
        },
    },
});
