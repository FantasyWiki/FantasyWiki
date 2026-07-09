import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, Pinia, setActivePinia } from "pinia";
import router from "@/router/index";
import LogoutConfirmPage from "@/views/auth/LogoutConfirmPage.vue";
import { useAppStore } from "@/stores/app";

describe("LogoutConfirmPage.vue", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("shows the signed-in user's identity and avatar", async () => {
    await router.push("/");
    await router.isReady();

    const appStore = useAppStore();
    appStore.isAuthenticated = true;
    appStore.currentUser = {
      sub: "test-user",
      name: "Test User",
      email: "test@example.com",
      picture: "https://example.com/avatar.png",
    };

    const wrapper = mount(LogoutConfirmPage, {
      global: { plugins: [router, pinia] },
    });

    expect(wrapper.text()).toContain("Test User");
    expect(wrapper.text()).toContain("test@example.com");
    expect(wrapper.find("ion-avatar img").attributes("src")).toBe(
      "https://example.com/avatar.png"
    );
  });
});
