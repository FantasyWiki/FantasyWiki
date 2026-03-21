import { beforeAll, afterEach, afterAll, vi } from "vitest";
import { config } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { server } from "@/mocks/server";

// ── MSW ───────────────────────────────────────────────────────────────────────
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Global Vue Test Utils config ──────────────────────────────────────────────
// Register VueQueryPlugin and a fresh Pinia as global plugins so that every
// component that calls useQuery / useMutation / useNotifications etc. always
// has a queryClient in its Vue context — even in tests that don't set up
// plugins explicitly (e.g. HomePage, NavBar, simple mount-only specs).
//
// Each test file that needs a *fresh* QueryClient (to avoid cross-test cache
// pollution) should still create its own and pass it via mountOptions.global —
// the global default here is a safety net for specs that don't care.

function makeFreshQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

beforeAll(() => {
  // Provide a default Pinia instance for any test that mounts a component
  // without setting up its own store.
  const pinia = createPinia();
  setActivePinia(pinia);

  config.global.plugins = [
    pinia,
    [VueQueryPlugin, { queryClient: makeFreshQueryClient() }],
  ];
});

afterEach(() => {
  // Reset the global QueryClient cache between tests so one test's MSW
  // response doesn't leak into the next.
  config.global.plugins = [
    createPinia(),
    [VueQueryPlugin, { queryClient: makeFreshQueryClient() }],
  ];
});
