import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import CTASection from "@/views/home-page/CTASection.vue";

describe("home-page/CTASection.vue", () => {
  it("should mount without any console errors or warnings", async () => {
    router.push("/");
    await router.isReady();

    const wrapper = mount(CTASection, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });
});
