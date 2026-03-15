"use server";

import { signIn, signOut } from "./auth";

export async function loginWithKeycloak() {
  await signIn("keycloak", { redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
