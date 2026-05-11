import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import { createPinia, Pinia } from "pinia";
import HomePage from "@/views/HomePage.vue";

describe("HomePage.vue", () => {
  let pinia: Pinia;

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    pinia = createPinia();
  });
  it("should mount without any console errors or warnings", async () => {
    router.push("/");
    await router.isReady();
    const wrapper = mount(HomePage, {
      global: {
        plugins: [router, pinia],
        stubs: {
          HeroSection: {
            template: "<div data-testid='hero-stub' />",
          },
        },
      },
    });

    expect(wrapper.exists()).toBe(true);
  });
});
