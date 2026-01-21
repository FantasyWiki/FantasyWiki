import {describe, it, expect, beforeEach} from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import HomePage from "@/views/HomePage.vue";
import {createPinia} from "pinia";

describe("HomePage.vue", () => {
  let pinia;

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    pinia = createPinia();
  });
  it("should mount without any console errors or warnings", () => {
    router.push("/");
    router.isReady().then(() => {
      const wrapper = mount(HomePage, {
        global: {
          plugins: [router, pinia],
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });
});
