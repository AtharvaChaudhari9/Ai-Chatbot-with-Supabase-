import { auth } from "@/auth";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const isChatRoute = req.nextUrl.pathname.startsWith("/chat");
    const isRootRoute = req.nextUrl.pathname === "/";

    // Redirect to login if trying to access chat unauthorized
    if (isChatRoute && !isLoggedIn) {
        return Response.redirect(new URL("/", req.nextUrl));
    }

    // Redirect to chat if logged in and visiting login page
    if (isRootRoute && isLoggedIn) {
        return Response.redirect(new URL("/chat", req.nextUrl));
    }
});

export const config = {
    matcher: ["/chat/:path*", "/"],
};
