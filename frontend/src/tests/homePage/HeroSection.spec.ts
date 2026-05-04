import { describe, it, expect } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import router from "@/router/index";
import HeroSection from "@/components/homePage/HeroSection.vue";

describe("home-page/HeroSection.vue", () => {
  it("updates the floating badge with filtered snapshot volume", async () => {
    window.localStorage.clear();
    router.push("/");
    await router.isReady();
    const wrapper = mount(HeroSection, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain("Over 1.2M views today");
  });
});
