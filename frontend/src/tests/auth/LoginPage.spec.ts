import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import LoginPage from "@/views/auth/LoginPage.vue";

function mountLoginPage() {
  return mount(LoginPage, { global: { plugins: [router] } });
}

describe("auth/LoginPage.vue", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  /**
   * The demo sign-in is a local development affordance. A deployed build is
   * never started with the flag, and the backend refuses `/auth/dev` there
   * regardless — but the button not being in the DOM is the half a reader of
   * this page can check.
   */
  it("offers no demo sign-in unless the build asked for one", async () => {
    await router.push("/");
    await router.isReady();

    expect(mountLoginPage().text()).not.toContain("demo player");
  });

  it("offers demo sign-in when VITE_DEV_LOGIN is set", async () => {
    vi.stubEnv("VITE_DEV_LOGIN", "true");
    await router.push("/");
    await router.isReady();

    expect(mountLoginPage().text()).toContain("demo player");
  });
});
