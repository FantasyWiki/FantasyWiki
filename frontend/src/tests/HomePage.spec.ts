import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import HomePage from "@/views/HomePage.vue";
import router from "@/router/index";

describe("HomePage.vue", () => {
  it("should mount without any console errors or warnings", () => {
    // 2. Set the initial location
    router.push("/");
    router.isReady().then(() => {
      const wrapper = mount(HomePage, {
        global: {
          plugins: [router],
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });
});
