import { auth } from "@/app/(auth)/auth";
import { NextResponse } from "next/server";

// next-intl's createMiddleware issues internal rewrites that cause redirect
// loops behind Cloudflare Tunnel. Locale detection is handled instead via
// Accept-Language header parsing in i18n/request.ts.
export const proxy = auth(() => NextResponse.next());

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
