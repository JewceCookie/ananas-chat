"use client";

import { redirect } from "next/navigation";
import { useEffect } from "react";

// Registration is handled by Nextcloud — redirect to login
export default function RegisterPage() {
  useEffect(() => {
    redirect("/login");
  }, []);
  return null;
}
