"use client";

import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const t = useTranslations("auth");

  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-2xl border border-border bg-card px-8 py-12 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("loginTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("loginSubtitle")}</p>
        </div>

        <button
          type="button"
          onClick={() => signIn("keycloak", { callbackUrl: "/" })}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            className="size-5"
            aria-hidden="true"
          >
            <circle cx="128" cy="128" r="128" fill="#0082C9" />
            <path
              d="M128 70c-19.9 0-37 12.3-44.1 29.8C79 98.3 73.8 97 68.3 97 49.4 97 34 112.4 34 131.3S49.4 165.5 68.3 165.5c3 0 5.9-.4 8.7-1.1C84.1 177.3 101 189 120 189c12.1 0 23.1-4.7 31.3-12.4 5.7 3.2 12.2 5 19.1 5 21.5 0 38.9-17.4 38.9-38.9 0-3.5-.5-6.9-1.3-10.2C218.4 126.8 222 118 222 108.3 222 87.1 204.9 70 183.7 70c-6.5 0-12.7 1.6-18.1 4.4C157.9 75.5 143.2 70 128 70z"
              fill="white"
            />
          </svg>
          {t("loginButton")}
        </button>
      </div>
    </div>
  );
}
