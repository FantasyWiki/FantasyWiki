import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import router from "@/router/index";
import HeroSection from "@/components/homePage/HeroSection.vue";
import { useAppStore } from "@/stores/app";

// The store is resolved *after* mounting — see CTASection.spec.ts for why.
describe("home-page/HeroSection.vue", () => {
  beforeEach(async () => {
    await router.push("/");
    await router.isReady();
  });

  afterEach(() => vi.restoreAllMocks());

  function mountSection() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
    });
    return mount(HeroSection, {
      global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    });
  }

  it("opens the login modal when the visitor is signed out", async () => {
    const push = vi.spyOn(router, "push");
    const wrapper = mountSection();
    const appStore = useAppStore();
    appStore.isAuthenticated = false;

    await wrapper.get(".hero-cta").trigger("click");

    expect(appStore.isLoginModalOpen).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("goes to the dashboard when the visitor is already signed in", async () => {
    const push = vi.spyOn(router, "push");
    const wrapper = mountSection();
    const appStore = useAppStore();
    appStore.isAuthenticated = true;

    await wrapper.get(".hero-cta").trigger("click");

    expect(push).toHaveBeenCalledWith("/dashboard");
    expect(appStore.isLoginModalOpen).toBe(false);
  });
});
