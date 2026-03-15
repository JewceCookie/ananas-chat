import NextAuth from "next-auth";
import { authConfig } from "@/app/(auth)/auth.config";
import { NextResponse } from "next/server";


// Use the lightweight authConfig (with the `authorized` callback) rather than
// the full auth.ts export, which overrides `callbacks` and loses `authorized`.
// next-intl's createMiddleware is intentionally omitted — it causes redirect
// loops behind Cloudflare Tunnel. Locale detection happens in i18n/request.ts.
const { auth } = NextAuth(authConfig);

export const proxy = auth(() => NextResponse.next());

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
