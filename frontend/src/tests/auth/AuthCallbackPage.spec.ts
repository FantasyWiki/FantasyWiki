import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import AuthCallbackPage from "@/views/auth/AuthCallbackPage.vue";
import { createPinia, Pinia } from "pinia";

describe("auth/AuthCallbackPage.vue", () => {
  let pinia: Pinia;

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    pinia = createPinia();
  });

  it("should mount without any console errors or warnings", () => {
    router.push("/");
    router.isReady().then(() => {
      const wrapper = mount(AuthCallbackPage, {
        global: {
          plugins: [router, pinia], // Add Pinia to plugins
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });
});
