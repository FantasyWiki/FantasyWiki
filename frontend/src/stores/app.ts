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

  interface AuthUser {
    id: string;
    name: string;
    email: string;
    picture_url: string;
  }

  const AUTH_TOKEN_COOKIE_KEY = "auth_token";

  // UX-only check: reads the token payload to detect obvious expiry and
  // populate local state. Does NOT verify the signature — real auth enforcement
  // happens server-side via jwt.verify() in the requireAuth middleware.
  function decodeJwtPayload(token: string): AuthUser | null {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) return null;
      return {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        picture_url: payload.picture,
      };
    } catch {
      return null;
    }
  }

  const _storedToken = localStorage.getItem(AUTH_TOKEN_COOKIE_KEY);
  const _initialUser = _storedToken ? decodeJwtPayload(_storedToken) : null;

  const isAuthenticated = ref<boolean>(_initialUser !== null);
  const currentUser = ref<AuthUser | null>(_initialUser);
  const authToken = ref<string | null>(_initialUser ? _storedToken : null);

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

  function setUser(token: string) {
    const user = decodeJwtPayload(token);
    if (!user) return;
    authToken.value = token;
    currentUser.value = user;
    isAuthenticated.value = true;
    localStorage.setItem(AUTH_TOKEN_COOKIE_KEY, token);
  }

  function logout() {
    isAuthenticated.value = false;
    currentUser.value = null;
    authToken.value = null;
    localStorage.removeItem(AUTH_TOKEN_COOKIE_KEY);
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
    authToken,
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
    setUser,
    logout,
  };
});
