import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { createPinia, setActivePinia } from "pinia";
import { IonicVue } from "@ionic/vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import i18n from "./i18n";
import { useAppStore } from "@/stores/app";
import { sessionApi } from "@/services/api";

/* Core CSS required for Ionic components to work properly */
import "@ionic/vue/css/core.css";
import "@ionic/vue/css/normalize.css";
import "@ionic/vue/css/structure.css";
import "@ionic/vue/css/typography.css";
import "@ionic/vue/css/padding.css";
import "@ionic/vue/css/float-elements.css";
import "@ionic/vue/css/text-alignment.css";
import "@ionic/vue/css/text-transformation.css";
import "@ionic/vue/css/flex-utils.css";
import "@ionic/vue/css/display.css";
import "@ionic/vue/css/palettes/dark.class.css";

import "./theme/variables.css";
import "./theme/background-and-text.css";
import "./theme/dark-mode.css";

import "@fontsource/libre-baskerville";

// ── Query client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // staleTime: 60s — cached data is considered fresh for one minute.
      // Prevents redundant refetches when navigating between pages or when
      // components remount within the same session. The first fetch on a cold
      // cache still fires immediately regardless of this value.
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      // Only retry once — MSW errors are usually genuine during dev.
      retry: 1,
    },
  },
});

function clearWikimediaTopReadCacheInDev(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return;
  }

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith("wikimedia:top-read:")) {
      window.localStorage.removeItem(key);
    }
  }
}

/**
 * MSW registers a real Service Worker (`mockServiceWorker.js`) that keeps
 * intercepting requests on every future page load regardless of whether the
 * current session calls `worker.start()` again — it only stops once
 * unregistered. Without this, a prior `devMock` run leaves mock responses
 * silently active during a later `dev` (VITE_MOCK=false) run.
 */
async function unregisterMockServiceWorkerInDev(): Promise<void> {
  if (
    !import.meta.env.DEV ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Order matters:
//   1. MSW must be fully active before any component mounts and fires a fetch.
//   2. The app is created and all plugins registered before mount.
//   3. mount() is the last thing called.
async function bootstrap() {
  clearWikimediaTopReadCacheInDev();

  // Step 1 — start MSW in dev so it intercepts every fetch from the start.
  const mock = import.meta.env.VITE_MOCK;
  if (mock === "true") {
    const { worker } = await import("./mocks/browser");
    // worker.start() resolves when the service worker is both registered
    // and activated — safe to mount immediately after.
    await worker.start({ onUnhandledRequest: "bypass" });
  } else {
    // Not running mock this session — make sure a Service Worker left
    // registered by a previous devMock run isn't still intercepting.
    await unregisterMockServiceWorkerInDev();
  }

  // Step 2 — activate Pinia and restore the session BEFORE installing the
  // router. The router's beforeEach guard fires as a microtask during
  // app.use(router), so auth state must be settled before that point.
  const pinia = createPinia();
  setActivePinia(pinia);

  try {
    const session = await sessionApi.get();
    useAppStore().setUserFromData(session);
  } catch {
    // No valid session — user is not authenticated, that's fine.
  }

  // Step 3 — create and configure the app (router installed here, initial
  // navigation fires with the correct isAuthenticated value already set).
  const app = createApp(App)
    .use(router)
    .use(IonicVue)
    .use(pinia)
    .use(i18n)
    .use(VueQueryPlugin, { queryClient });

  // Step 4 — wait for the router to resolve the initial route, then mount.
  await router.isReady();
  app.mount("#app");
}

await bootstrap();
