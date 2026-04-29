import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
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

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain("Over 1.2 million views today");
  });
});
