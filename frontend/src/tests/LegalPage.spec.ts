import { describe, it, expect, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, Pinia, setActivePinia } from "pinia";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import router from "@/router/index";
import LegalPage from "@/views/LegalPage.vue";

describe("LegalPage.vue", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("renders the terms, privacy and attribution sections", async () => {
    await router.push("/legal");
    await router.isReady();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
    });

    const wrapper = mount(LegalPage, {
      global: {
        plugins: [router, pinia, [VueQueryPlugin, { queryClient }]],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Terms of use");
    expect(wrapper.text()).toContain("Privacy");
    expect(wrapper.text()).toContain("Wikimedia attribution");
  });
});
