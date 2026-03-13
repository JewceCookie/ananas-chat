import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";

export const proxy = auth(() => NextResponse.next());

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};