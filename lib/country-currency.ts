import { DEFAULT_CURRENCY } from "@/lib/currency";

export function detectInitialCurrency(): string {
  if (typeof window === "undefined") {
    return "PHP";
  }

  // Use timezone first.
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone?.toLowerCase() ?? "";

  // Philippines
  if (timezone === "asia/manila") {
    return "PHP";
  }

  // Saudi Arabia
  if (timezone === "asia/riyadh") {
    return "SAR";
  }

  // Then check browser locale.
  const locales = [navigator.language, ...(navigator.languages ?? [])].filter(
    Boolean,
  );

  const normalizedLocales = locales.map((locale) =>
    locale.replace("_", "-").toLowerCase(),
  );

  // Philippines
  if (
    normalizedLocales.some(
      (locale) => locale === "ph" || locale.endsWith("-ph"),
    )
  ) {
    return "PHP";
  }

  // Saudi Arabia
  if (
    normalizedLocales.some(
      (locale) => locale === "sa" || locale.endsWith("-sa"),
    )
  ) {
    return "SAR";
  }

  // Default to Philippine Peso
  return "PHP";
}
