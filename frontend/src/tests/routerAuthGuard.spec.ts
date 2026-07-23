import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import router from "@/router/index";
import { useAppStore } from "@/stores/app";

describe("router auth guard", () => {
  beforeEach(async () => {
    // The guard resolves the store itself, outside any component, so the
    // active Pinia has to be the one this test reads back.
    setActivePinia(createPinia());
    await router.replace("/home");
    await router.isReady();
  });

  it("explains the bounce instead of redirecting in silence", async () => {
    const appStore = useAppStore();
    expect(appStore.isAuthenticated).toBe(false);

    await router.push("/market");

    expect(router.currentRoute.value.path).toBe("/home");
    expect(appStore.isLoginModalOpen).toBe(true);
    expect(appStore.loginReason).toBe("auth-required");
  });

  it("lets a signed-in player through untouched", async () => {
    const appStore = useAppStore();
    appStore.setUserFromData({
      sub: "player-1",
      email: "player@example.com",
      name: "Player One",
      picture: "",
    });

    await router.push("/market");

    expect(router.currentRoute.value.path).toBe("/market");
    expect(appStore.isLoginModalOpen).toBe(false);
    expect(appStore.loginReason).toBeNull();
  });

  it("leaves public pages alone", async () => {
    await router.push("/legal");

    expect(router.currentRoute.value.path).toBe("/legal");
    expect(useAppStore().isLoginModalOpen).toBe(false);
  });
});
