import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale is set by next-intl middleware when it runs.
  // Since we don't run intlMiddleware in proxy.ts (it causes redirect loops
  // behind Cloudflare Tunnel), we fall back to Accept-Language header parsing.
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as "de" | "en")) {
    const acceptLanguage = (await headers()).get("accept-language") ?? "";
    const primary = acceptLanguage.split(",").at(0)?.split(";").at(0)?.trim().slice(0, 2) ?? "";
    locale = primary === "en" ? "en" : routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
