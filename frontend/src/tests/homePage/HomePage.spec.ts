import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, type Ref } from "vue";
import router from "@/router/index";
import { createPinia, Pinia } from "pinia";
import HomePage from "@/views/HomePage.vue";

// The reveal is driven by a flag this spec owns, so the assertions are about
// what the page does with it rather than about jsdom's font loading. The ref is
// created inside the factory because hoisted mocks run before `vue` is
// imported.
const fontsReady = vi.hoisted(() => ({
  isReady: null as unknown as Ref<boolean>,
}));

vi.mock("@/composables/useFontsReady", async () => {
  const { ref } = await import("vue");
  fontsReady.isReady = ref(false);
  return { useFontsReady: () => ({ isReady: fontsReady.isReady }) };
});

describe("HomePage.vue", () => {
  let pinia: Pinia;

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    pinia = createPinia();
    fontsReady.isReady.value = false;
  });

  function mountPage() {
    return mount(HomePage, {
      global: {
        plugins: [router, pinia],
        stubs: {
          HeroSection: {
            template: "<div data-testid='hero-stub' />",
          },
        },
      },
    });
  }

  it("should mount without any console errors or warnings", async () => {
    router.push("/");
    await router.isReady();
    const wrapper = mountPage();

    expect(wrapper.exists()).toBe(true);
  });

  it("holds the sections back until the fonts have settled", async () => {
    router.push("/");
    await router.isReady();
    const wrapper = mountPage();

    // Hidden, not absent: the sections are laid out all along, so the font
    // swap they used to visibly re-run happens behind them.
    const reveal = wrapper.get(".home-reveal");
    expect(reveal.classes()).not.toContain("home-reveal--visible");

    fontsReady.isReady.value = true;
    await nextTick();

    expect(reveal.classes()).toContain("home-reveal--visible");
  });
});
