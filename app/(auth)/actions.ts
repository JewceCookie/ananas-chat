"use server";

import { signIn, signOut } from "./auth";

export async function loginWithNextcloud() {
  await signIn("nextcloud", { redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
