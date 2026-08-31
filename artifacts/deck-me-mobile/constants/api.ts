const DEFAULT_API_URL = "https://tradie-quote-master.replit.app";

function normaliseApiUrl(value: string): string {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(candidate);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("EXPO_PUBLIC_API_URL must use HTTP or HTTPS");
  }

  return url.toString().replace(/\/+$/, "");
}

const configuredApiUrl =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  process.env.EXPO_PUBLIC_DOMAIN?.trim() ||
  DEFAULT_API_URL;

export const API_BASE_URL = normaliseApiUrl(configuredApiUrl);