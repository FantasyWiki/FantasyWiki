import { describe, it, expect, vi, afterEach } from "vitest";
import { defineComponent, h, nextTick, type Ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { useFontsReady } from "@/composables/useFontsReady";

/**
 * Installs a FontFaceSet whose `ready` this test resolves by hand, so the wait
 * can be held open. jsdom has no font loading of its own.
 */
function stubFontFaceSet(): { settle: () => void } {
  let settle: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    settle = resolve;
  });

  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready },
  });

  return { settle };
}

function removeFontFaceSet() {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: undefined,
  });
}

function mountHost(): Ref<boolean> {
  let flag!: Ref<boolean>;
  mount(
    defineComponent({
      setup() {
        flag = useFontsReady().isReady;
        return () => h("div");
      },
    })
  );
  return flag;
}

afterEach(() => {
  vi.useRealTimers();
  removeFontFaceSet();
});

describe("useFontsReady", () => {
  it("waits for the fonts, then flips", async () => {
    const { settle } = stubFontFaceSet();
    const isReady = mountHost();
    await nextTick();

    expect(isReady.value).toBe(false);

    settle();
    await flushPromises();

    expect(isReady.value).toBe(true);
  });

  it("gives up on fonts that never arrive", async () => {
    vi.useFakeTimers();
    stubFontFaceSet();
    const isReady = mountHost();
    await nextTick();

    expect(isReady.value).toBe(false);

    // A slow font must not leave the page holding back its content forever.
    await vi.advanceTimersByTimeAsync(500);

    expect(isReady.value).toBe(true);
  });

  it("does not wait at all where font loading is unobservable", async () => {
    removeFontFaceSet();
    const isReady = mountHost();
    await nextTick();

    expect(isReady.value).toBe(true);
  });
});
