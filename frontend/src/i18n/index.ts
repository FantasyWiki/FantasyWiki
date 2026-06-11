import { createI18n } from "vue-i18n";
import en from "./locales/en";
import it from "./locales/it";

// The locales the app can actually display. The language switcher in the
// NavBar is built from this list (see stores/app.ts).
export const SUPPORTED_LOCALES = ["en", "it"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export function isSupportedLocale(
  value: string | null | undefined
): value is SupportedLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve the locale to boot with: a previously persisted choice wins, then the
 * browser's preferred language, then English. Exported so the app store reuses
 * the exact same logic for its initial value — the two never diverge.
 */
export function resolveInitialLocale(): SupportedLocale {
  const stored =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("language")
      : null;
  if (isSupportedLocale(stored)) return stored;

  const browser =
    typeof navigator !== "undefined"
      ? navigator.language.slice(0, 2).toLowerCase()
      : "";
  if (isSupportedLocale(browser)) return browser;

  return DEFAULT_LOCALE;
}

const i18n = createI18n({
  // Composition API mode. globalInjection keeps `$t` available in templates.
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, it },
});

export default i18n;
