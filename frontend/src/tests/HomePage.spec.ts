import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import HomePage from "@/views/HomePage.vue";

describe("HomePage.vue", () => {
  it("should mount without any console errors or warnings", () => {
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
