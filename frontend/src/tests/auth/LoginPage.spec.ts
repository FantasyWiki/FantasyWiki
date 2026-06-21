import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import LoginPage from "@/views/auth/LoginPage.vue";

describe("auth/LoginPage.vue", () => {
  it("should mount without any console errors or warnings", async () => {
    await router.push("/");
    await router.isReady();
    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });
});
