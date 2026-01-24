import { defineStore } from "pinia";
import { ref, computed } from "vue";

// Define language structure
interface LanguageOption {
  code: string;
  label: string;
  fullName: string;
}

// Available languages configuration
const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: "EN", label: "🇬🇧", fullName: "English" },
  { code: "IT", label: "🇮🇹", fullName: "Italiano" },
  { code: "ES", label: "🇪🇸", fullName: "Español" },
];

/**
 * Global application store for settings that persist across navigation
 * Manages: language, theme, and other app-wide preferences
 */
export const useAppStore = defineStore("app", () => {
  // ========== STATE ==========
  const languageCode = ref<string>(localStorage.getItem("language") || "en");

  const isDarkMode = ref<boolean>(localStorage.getItem("darkMode") === "true");

  const isAuthenticated = ref<boolean>(false);

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

    // Update HTML lang attribute for accessibility
    document.documentElement.lang = code;

    console.log(
      `Language changed to: ${currentLanguage.value.fullName} (${code})`
    );
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

  function login() {
    isAuthenticated.value = true;
  }

  function logout() {
    isAuthenticated.value = false;
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
    // Getters
    currentLanguage, // { code: 'en', label: 'EN', fullName: 'English' }
    languageDisplay, // "en, English"
    availableLanguages, // Array of all language options
    isLanguage, // Function to check current language
    // Actions
    setLanguage,
    cycleLanguage,
    toggleDarkMode,
    setDarkMode,
    login,
    logout,
  };
});
