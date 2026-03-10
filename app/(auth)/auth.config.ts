import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
    newUser: "/",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLoginPage = nextUrl.pathname === "/login";
      const isApiRoute = nextUrl.pathname.startsWith("/api/");

      if (isApiRoute) return true;
      if (isOnLoginPage) return true;
      if (!isLoggedIn) return false;

      return true;
    },
  },
} satisfies NextAuthConfig;
