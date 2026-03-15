import { auth } from "@/app/(auth)/auth";

// next-intl's createMiddleware is intentionally omitted — it causes redirect
// loops behind Cloudflare Tunnel. Locale detection happens in i18n/request.ts.
export const proxy = auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
