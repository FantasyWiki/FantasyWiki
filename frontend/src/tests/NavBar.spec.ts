import { describe, it, expect, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, Pinia, setActivePinia } from "pinia";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import router from "@/router/index";
import NavBar from "@/layout/NavBar.vue";
import { useAppStore } from "@/stores/app";

describe("NavBar.vue", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("should mount without any console errors or warnings", async () => {
    await router.push("/");
    await router.isReady();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
    });

    const wrapper = mount(NavBar, {
      global: {
        plugins: [router, pinia, [VueQueryPlugin, { queryClient }]],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it("does not show the league selector when user is not authenticated", async () => {
    await router.push("/");
    await router.isReady();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
    });

    const appStore = useAppStore();
    appStore.isAuthenticated = false;
    appStore.currentUser = null;

    const wrapper = mount(NavBar, {
      global: {
        plugins: [router, pinia, [VueQueryPlugin, { queryClient }]],
      },
    });

    await flushPromises();

    // League selector should not be present when not authenticated
    const leagueSelector = wrapper.find("#league-selector");
    expect(leagueSelector.exists()).toBe(false);
  });

  it("shows the league selector when user is authenticated", async () => {
    await router.push("/");
    await router.isReady();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
    });

    const appStore = useAppStore();
    appStore.isAuthenticated = true;
    appStore.currentUser = {
      id: "test-user",
      name: "Test User",
      email: "test@example.com",
      picture_url: "https://example.com/avatar.png",
    };

    const wrapper = mount(NavBar, {
      global: {
        plugins: [router, pinia, [VueQueryPlugin, { queryClient }]],
      },
    });

    await flushPromises();

    // League selector should be present when authenticated
    const leagueSelector = wrapper.find("#league-selector");
    expect(leagueSelector.exists()).toBe(true);
  });
});
