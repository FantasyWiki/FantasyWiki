import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";
import { IonicVue } from "@ionic/vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";

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

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Order matters:
//   1. MSW must be fully active before any component mounts and fires a fetch.
//   2. The app is created and all plugins registered before mount.
//   3. mount() is the last thing called.
async function bootstrap() {
  // Step 1 — start MSW in dev so it intercepts every fetch from the start.
  if (import.meta.env.VITE_MOCK === 'true') {
    const { worker } = await import("./mocks/browser");
    // worker.start() resolves when the service worker is both registered
    // and activated — safe to mount immediately after.
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  // Step 2 — create and configure the app.
  const app = createApp(App)
    .use(IonicVue)
    .use(router)
    .use(createPinia())
    .use(VueQueryPlugin, { queryClient });

  // Step 3 — wait for the router to resolve the initial route, then mount.
  await router.isReady();
  app.mount("#app");
}

bootstrap();
