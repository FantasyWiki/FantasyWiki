import { describe, it, expect, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, Pinia, setActivePinia } from "pinia";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import router from "@/router/index";
import NotFoundPage from "@/views/NotFoundPage.vue";

describe("NotFoundPage.vue", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("is reached by the catch-all route and shows the attempted path", async () => {
    await router.push("/this/does-not-exist");
    await router.isReady();

    expect(router.currentRoute.value.name).toBe("NotFound");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
    });

    const wrapper = mount(NotFoundPage, {
      global: {
        plugins: [router, pinia, [VueQueryPlugin, { queryClient }]],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("404: Page not found");
    expect(wrapper.find(".nf-path").text()).toBe("/this/does-not-exist");
    expect(wrapper.text()).toContain("citation needed");
    expect(wrapper.text()).toContain("Market profile");
  });
});
