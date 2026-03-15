import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/app/(auth)/auth.config";

// next-intl's createMiddleware issues internal rewrites that cause redirect
// loops behind Cloudflare Tunnel. Locale detection is handled instead via
// Accept-Language header parsing in i18n/request.ts.
//
// IMPORTANT: proxy.ts must NOT import from auth.ts. auth.ts imports
// queries.ts which creates a postgres connection at module level — that
// crashes in Edge runtime and silently disables auth protection. Use the
// lightweight NextAuth(authConfig) instance here instead.
const { auth } = NextAuth(authConfig);
export const proxy = auth(() => NextResponse.next());

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
