import { auth } from "@/auth";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const isChatRoute = req.nextUrl.pathname.startsWith("/chat");
    const isAuthRoute = req.nextUrl.pathname === "/" || req.nextUrl.pathname === "/login";

    // Redirect to root landing page if attempting to access protected /chat without authentication
    if (isChatRoute && !isLoggedIn) {
        return Response.redirect(new URL("/", req.nextUrl));
    }

    // Redirect directly to /chat if user is already authenticated and visits landing or login page
    if (isAuthRoute && isLoggedIn) {
        return Response.redirect(new URL("/chat", req.nextUrl));
    }
});

export const config = {
    matcher: ["/chat/:path*", "/", "/login"],
};
