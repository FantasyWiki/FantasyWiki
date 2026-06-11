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

// Available languages configuration. Codes are lowercase to match the i18n
// locales, the persisted `language` key, and the <html lang> attribute. Adding
// a locale here (plus its catalog in src/i18n/locales and SUPPORTED_LOCALES)
// is all that's needed to extend the switcher.
const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "🇬🇧", fullName: "English" },
  { code: "it", label: "🇮🇹", fullName: "Italiano" },
];

/**
 * Global application store for settings that persist across navigation
 * Manages: language, theme, and other app-wide preferences
 */
export const useAppStore = defineStore("app", () => {
  // ========== STATE ==========
  // Same resolver the i18n instance booted with, so store and i18n agree.
  const languageCode = ref<string>(resolveInitialLocale());

  const isDarkMode = ref<boolean>(localStorage.getItem("darkMode") === "true");

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

  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value;
    localStorage.setItem("darkMode", isDarkMode.value.toString());
    document.body.classList.toggle("dark", isDarkMode.value);
  }

  function setDarkMode(value: boolean) {
    isDarkMode.value = value;
    localStorage.setItem("darkMode", value.toString());
    document.body.classList.toggle("dark", value);
  }

  function setUserFromData(userData: Session) {
    // Token is in HTTP-only cookie, managed by browser
    // We just store the user data in memory
    currentUser.value = userData;
    isAuthenticated.value = true;
  }

  function logout() {
    isAuthenticated.value = false;
    currentUser.value = null;
    sessionApi.delete();
  }

  // Initialize on store creation
  if (isDarkMode.value) {
    document.body.classList.add("dark");
  }
  document.documentElement.lang = languageCode.value;

  // Return public API
  return {
    // State
    languageCode,
    isDarkMode,
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
    setUserFromData,
    logout,
  };
});
