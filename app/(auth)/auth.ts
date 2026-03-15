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
      roles: string[];
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
    idToken: string;
    roles: string[];
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
    async jwt({ token, user, account, profile }) {
      if (user && account) {
        const rawRoles = profile?.roles;
        const roles = Array.isArray(rawRoles) ? (rawRoles as string[]) : [];

        token.id = user.id as string;
        token.nextcloudId = user.nextcloudId as string;
        token.accessToken = account.access_token as string;
        token.idToken = account.id_token as string;
        token.roles = roles;

        await createOrUpdateUser({
          nextcloudId: user.nextcloudId as string,
          email: user.email ?? "",
          name: user.name ?? "",
          roles,
        });
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.nextcloudId = token.nextcloudId;
        session.user.accessToken = token.accessToken;
        session.user.roles = token.roles;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (token?.idToken) {
        const issuer = `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`;
        const url = new URL(`${issuer}/protocol/openid-connect/logout`);
        url.searchParams.set("id_token_hint", token.idToken);
        url.searchParams.set("post_logout_redirect_uri", process.env.AUTH_URL ?? "/");
        await fetch(url.toString());
      }
    },
  },
});
