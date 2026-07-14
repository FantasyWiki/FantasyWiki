import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/app";

/**
 * Shared behaviour for the landing page's primary calls to action ("Get
 * started", "Create account"): send a signed-in visitor straight to their
 * dashboard, and prompt everyone else to log in. The login modal is owned by
 * the app store precisely so these buttons can reach it from inside the
 * NavBar's content slot.
 */
export function useAuthCta() {
  const router = useRouter();
  const appStore = useAppStore();

  function startPlaying() {
    if (appStore.isAuthenticated) {
      router.push("/dashboard");
    } else {
      appStore.openLoginModal();
    }
  }

  return { startPlaying };
}
