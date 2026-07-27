import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, Pinia, setActivePinia } from "pinia";
import router from "@/router/index";
import SettingsMenu from "@/components/SettingsMenu.vue";
import { useAppStore } from "@/stores/app";

function mountMenu(pinia: Pinia) {
  return mount(SettingsMenu, { global: { plugins: [pinia, router] } });
}

describe("SettingsMenu.vue", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
  });

  it("opens the login modal from the auth row when signed out", async () => {
    const appStore = useAppStore();
    appStore.isAuthenticated = false;

    const wrapper = mountMenu(pinia);
    await wrapper.get(".auth-row").trigger("click");

    expect(appStore.isLoginModalOpen).toBe(true);
    expect(appStore.isLogoutModalOpen).toBe(false);
    // The menu asks to be dismissed first — Ionic will not stack a modal
    // reliably over a popover that is still open.
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("opens the logout modal from the auth row when signed in", async () => {
    const appStore = useAppStore();
    appStore.isAuthenticated = true;

    const wrapper = mountMenu(pinia);
    await wrapper.get(".auth-row").trigger("click");

    expect(appStore.isLogoutModalOpen).toBe(true);
    expect(appStore.isLoginModalOpen).toBe(false);
  });

  it("shows the account row only when signed in", async () => {
    const appStore = useAppStore();
    appStore.isAuthenticated = false;
    expect(mountMenu(pinia).find(".account-row").exists()).toBe(false);

    appStore.isAuthenticated = true;
    appStore.currentUser = {
      sub: "test-user",
      name: "Test User",
      email: "test@example.com",
      picture: "https://example.com/avatar.png",
    };
    expect(mountMenu(pinia).find(".account-row").exists()).toBe(true);
  });

  it("opens the written guide from the user-guide row, signed in or not", async () => {
    await router.push("/home");
    await router.isReady();

    const appStore = useAppStore();
    // The guide is public, so someone still deciding whether to play can read
    // the rules from the same row a player uses.
    appStore.isAuthenticated = false;
    expect(mountMenu(pinia).find(".user-guide-row").exists()).toBe(true);

    appStore.setUserFromData({
      sub: "player-1",
      email: "player@example.com",
      name: "Player One",
      picture: "",
    });
    const wrapper = mountMenu(pinia);
    // The row hands over a page to read; replaying the guided tour is a
    // deliberate second choice, offered at the end of that page.
    const pushSpy = vi.spyOn(router, "push");
    await wrapper.get(".user-guide-row").trigger("click");

    expect(pushSpy).toHaveBeenCalledWith("/guide");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("switches language from the sub-menu and returns to the root view", async () => {
    const appStore = useAppStore();
    const wrapper = mountMenu(pinia);

    const rows = () => wrapper.findAll("ion-item");
    // Root view: account row is absent (signed out), so language is first.
    await rows()[0].trigger("click");

    // Sub-menu: a back row followed by one row per available language.
    expect(rows()).toHaveLength(1 + appStore.availableLanguages.length);

    const italian = rows().find((row) => row.text().includes("Italiano"));
    await italian!.trigger("click");

    expect(appStore.languageCode).toBe("it");
    expect(localStorage.getItem("language")).toBe("it");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
