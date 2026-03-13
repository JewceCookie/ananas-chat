import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import { createOrUpdateUser } from "@/lib/db/queries";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      nextcloudId: string;
      accessToken: string;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    nextcloudId?: string;
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    nextcloudId: string;
    accessToken: string;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    {
      id: "keycloak",
      name: "Keycloak",
      type: "oidc",
      // Keycloak well-known endpoint: {KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}
      issuer: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`,
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          nextcloudId: profile.sub,
          name: profile.name ?? profile.preferred_username ?? profile.sub,
          email: profile.email,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user && account) {
        token.id = user.id as string;
        token.nextcloudId = user.nextcloudId as string;
        token.accessToken = account.access_token as string;

        await createOrUpdateUser({
          nextcloudId: user.nextcloudId as string,
          email: user.email ?? "",
          name: user.name ?? "",
        });
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.nextcloudId = token.nextcloudId;
        session.user.accessToken = token.accessToken;
      }
      return session;
    },
  },
});
