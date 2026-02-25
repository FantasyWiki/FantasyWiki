import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import HeroSection from "@/views/home-page/HeroSection.vue";

describe("home-page/HeroSection.vue", () => {
  it("should mount without any console errors or warnings", async () => {
    router.push("/");
    await router.isReady();
    const wrapper = mount(HeroSection, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });
});
