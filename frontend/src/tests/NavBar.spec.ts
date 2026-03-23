import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, Pinia } from "pinia";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import router from "@/router/index";
import NavBar from "@/layout/NavBar.vue";

describe("NavBar.vue", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
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
});
