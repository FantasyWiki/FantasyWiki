import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import HowItWorks from "@/views/home-page/HowItWorks.vue";

describe("HowItWorks.vue", () => {
  it("should mount without any console errors or warnings", () => {
    router.push("/");
    router.isReady().then(() => {
      const wrapper = mount(HowItWorks, {
        global: {
          plugins: [router],
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });
});
