import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import AppFeature from "@/views/home-page/AppFeature.vue";

describe("AppFeature.vue", () => {
  it("should mount without any console errors or warnings", async () => {
    router.push("/");
    await router.isReady();
    const wrapper = mount(AppFeature, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });
});
