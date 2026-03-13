import { auth } from "@/app/(auth)/auth";
import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = new Set(["/login", "/register"]);

// auth(fn) is typed as an app-route handler (req, ctx) but Next.js 16 proxy
// only supplies req — cast to a single-arg form for use inside proxy().
const protectedMiddleware = auth((req) => intlMiddleware(req)) as (
  req: NextRequest
) => Response | Promise<Response>;

export function proxy(req: NextRequest) {
  if (PUBLIC_PATHS.has(req.nextUrl.pathname)) {
    return intlMiddleware(req);
  }

  return protectedMiddleware(req);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
