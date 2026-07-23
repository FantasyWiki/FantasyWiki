import { sessionApi } from "@/services/api";
import type { Session } from "@/types/models";
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import i18n, { isSupportedLocale, resolveInitialLocale } from "@/i18n";

// Define language structure
interface LanguageOption {
  code: string;
  label: string;
  fullName: string;
}

/**
 * Why the login modal is on screen. `auth-required` means the visitor tried to
 * reach a page the router guard turned them away from, so the modal explains
 * the bounce instead of leaving it looking like a broken link.
 */
export type LoginReason = "auth-required";

// Available languages configuration. Codes are lowercase to match the i18n
// locales, the persisted `language` key, and the <html lang> attribute. Adding
// a locale here (plus its catalog in src/i18n/locales and SUPPORTED_LOCALES)
// is all that's needed to extend the switcher.
const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "🇬🇧", fullName: "English" },
  { code: "it", label: "🇮🇹", fullName: "Italiano" },
];

// Theme is persisted under "theme" ("dark" | "light"). Absence of the key means
// the user never chose, so we follow the OS preference and keep following it.
const THEME_KEY = "theme";
const DARK_CLASS = "ion-palette-dark";

function prefersDarkQuery(): MediaQueryList {
  return window.matchMedia("(prefers-color-scheme: dark)");
}

function resolveInitialDarkMode(): boolean {
  const saved = localStorage.getItem(THEME_KEY);
  return saved ? saved === "dark" : prefersDarkQuery().matches;
}

/**
 * Global application store for settings that persist across navigation
 * Manages: language, theme, auth-modal visibility and other app-wide preferences
 */
export const useAppStore = defineStore("app", () => {
  // ========== STATE ==========
  // Same resolver the i18n instance booted with, so store and i18n agree.
  const languageCode = ref<string>(resolveInitialLocale());

  const isDarkMode = ref<boolean>(resolveInitialDarkMode());

  // Auth modals live here rather than in NavBar so that anything on the page —
  // the landing CTAs, the settings menu, the router's auth guard — can open
  // them without prop drilling through the layout slot.
  const isLoginModalOpen = ref<boolean>(false);
  const isLogoutModalOpen = ref<boolean>(false);

  // Why the login modal was opened, when it wasn't the visitor's own idea.
  // A token rather than a message: the i18n lint rules only see statically
  // written keys, so the catalog lookup has to happen in the template.
  const loginReason = ref<LoginReason | null>(null);

  // State - no initial user data since we need to check with server
  const isAuthenticated = ref<boolean>(false);
  const currentUser = ref<Session | null>(null);

  // ========== GETTERS ==========

  /**
   * Get current language object with code and full name
   * Returns: { code: 'en', label: 'EN', fullName: 'English' }
   */
  const currentLanguage = computed((): LanguageOption => {
    const found = AVAILABLE_LANGUAGES.find(
      (lang) => lang.code === languageCode.value
    );
    return found || AVAILABLE_LANGUAGES[0]; // Fallback to English
  });

  /**
   * Get formatted string "code, fullName"
   * Returns: "en, English" or "it, Italiano"
   */
  const languageDisplay = computed((): string => {
    return `${currentLanguage.value.code}, ${currentLanguage.value.fullName}`;
  });

  /**
   * Get all available languages
   */
  const availableLanguages = computed((): LanguageOption[] => {
    return AVAILABLE_LANGUAGES;
  });

  /**
   * Check if a specific language is currently selected
   */
  const isLanguage = (code: string): boolean => {
    return languageCode.value === code;
  };

  // ========== ACTIONS ==========

  /**
   * Set language by code
   * @param code - Language code (e.g., 'en', 'it', 'es')
   */
  function setLanguage(code: string) {
    const isValid = AVAILABLE_LANGUAGES.some((lang) => lang.code === code);
    if (!isValid) {
      console.warn(`Invalid language code: ${code}`);
      return;
    }

    languageCode.value = code;
    localStorage.setItem("language", code);

    // Switch the active translation catalog. This is what actually re-renders
    // the UI text — everything else here is persistence/accessibility.
    if (isSupportedLocale(code)) {
      i18n.global.locale.value = code;
    }

    // Update HTML lang attribute for accessibility
    document.documentElement.lang = code;
  }

  /**
   * Cycle to next available language
   */
  function cycleLanguage() {
    const currentIndex = AVAILABLE_LANGUAGES.findIndex(
      (lang) => lang.code === languageCode.value
    );
    const nextIndex = (currentIndex + 1) % AVAILABLE_LANGUAGES.length;
    setLanguage(AVAILABLE_LANGUAGES[nextIndex].code);
  }

  function applyDarkMode() {
    document.body.classList.toggle(DARK_CLASS, isDarkMode.value);
  }

  /**
   * Set the theme and remember the choice. Once called, the OS preference is
   * no longer followed — an explicit choice outranks it.
   */
  function setDarkMode(value: boolean) {
    isDarkMode.value = value;
    localStorage.setItem(THEME_KEY, value ? "dark" : "light");
    applyDarkMode();
  }

  function toggleDarkMode() {
    setDarkMode(!isDarkMode.value);
  }

  /**
   * Track the OS theme until the user picks one explicitly. Returns the
   * listener's teardown so App.vue can drop it on unmount.
   */
  function followSystemTheme(): () => void {
    const query = prefersDarkQuery();
    const onChange = (event: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_KEY)) {
        return;
      }
      isDarkMode.value = event.matches;
      applyDarkMode();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }

  function openLoginModal(reason: LoginReason | null = null) {
    loginReason.value = reason;
    isLoginModalOpen.value = true;
  }

  function closeLoginModal() {
    isLoginModalOpen.value = false;
    loginReason.value = null;
  }

  function openLogoutModal() {
    isLogoutModalOpen.value = true;
  }

  function closeLogoutModal() {
    isLogoutModalOpen.value = false;
  }

  function setUserFromData(userData: Session) {
    // Token is in an HttpOnly cookie managed by the browser.
    currentUser.value = userData;
    isAuthenticated.value = true;
  }

  function logout() {
    isAuthenticated.value = false;
    currentUser.value = null;
    sessionApi.delete();
  }

  // Initialize on store creation
  applyDarkMode();
  document.documentElement.lang = languageCode.value;

  // Return public API
  return {
    // State
    languageCode,
    isDarkMode,
    isLoginModalOpen,
    isLogoutModalOpen,
    loginReason,
    isAuthenticated,
    currentUser,
    // Getters
    currentLanguage,
    languageDisplay,
    availableLanguages,
    isLanguage,
    // Actions
    setLanguage,
    cycleLanguage,
    toggleDarkMode,
    setDarkMode,
    followSystemTheme,
    openLoginModal,
    closeLoginModal,
    openLogoutModal,
    closeLogoutModal,
    setUserFromData,
    logout,
  };
});
