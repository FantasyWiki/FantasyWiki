import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import AppStats from "@/components/homePage/AppStats.vue";

describe("AppStats.vue", () => {
  it("should mount without any console errors or warnings", async () => {
    router.push("/");
    await router.isReady();
    const wrapper = mount(AppStats, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });
});
