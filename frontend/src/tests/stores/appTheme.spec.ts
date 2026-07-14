import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAppStore } from "@/stores/app";

// Theme used to live in three places at once (App.vue, the store, and NavBar),
// under two localStorage keys and two CSS classes, so the icon could disagree
// with the page. These lock in the single owner: key "theme", class
// "ion-palette-dark".
describe("app store — theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove("ion-palette-dark");
    setActivePinia(createPinia());
  });

  it("applies the saved theme on creation", () => {
    localStorage.setItem("theme", "dark");

    const appStore = useAppStore();

    expect(appStore.isDarkMode).toBe(true);
    expect(document.body.classList.contains("ion-palette-dark")).toBe(true);
  });

  it("falls back to the OS preference when the user never chose", () => {
    // setup.ts stubs matchMedia to report a light OS preference.
    const appStore = useAppStore();

    expect(appStore.isDarkMode).toBe(false);
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("persists an explicit choice and toggles the palette class", () => {
    const appStore = useAppStore();

    appStore.toggleDarkMode();

    expect(appStore.isDarkMode).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.body.classList.contains("ion-palette-dark")).toBe(true);

    appStore.toggleDarkMode();

    expect(appStore.isDarkMode).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.body.classList.contains("ion-palette-dark")).toBe(false);
  });
});
