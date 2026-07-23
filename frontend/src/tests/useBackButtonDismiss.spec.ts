import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import { mount } from "@vue/test-utils";
import { useBackButtonDismiss } from "@/composables/useBackButtonDismiss";

// history.back() in jsdom unwinds a session history this test has no interest
// in, and pops asynchronously. Spying keeps the assertions about *what the
// composable asked the browser to do*, and lets the back press be delivered
// explicitly with a dispatched popstate.
let pushState: ReturnType<typeof vi.spyOn>;
let back: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  pushState = vi.spyOn(window.history, "pushState");
  back = vi.spyOn(window.history, "back").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

/**
 * Stands in for a host: `dismiss` flips `isOpen` back to false, exactly as
 * every ArticleDetail host does when it handles the `close` emit.
 */
function mountHost(isOpen: Ref<boolean>) {
  const dismiss = vi.fn(() => {
    isOpen.value = false;
  });

  const wrapper = mount(
    defineComponent({
      setup() {
        useBackButtonDismiss(isOpen, dismiss);
        return () => h("div");
      },
    })
  );

  return { wrapper, dismiss };
}

function pressBack() {
  window.dispatchEvent(new PopStateEvent("popstate"));
}

describe("useBackButtonDismiss", () => {
  it("claims a history entry when the overlay opens", async () => {
    const isOpen = ref(false);
    mountHost(isOpen);
    expect(pushState).not.toHaveBeenCalled();

    isOpen.value = true;
    await nextTick();

    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("claims one when it mounts already open", async () => {
    // Hosts render the overlay and open it in the same tick, so the watcher
    // has to fire immediately or the entry is never pushed at all.
    mountHost(ref(true));
    await nextTick();

    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("closes the overlay on a back press without stepping back again", async () => {
    const isOpen = ref(true);
    const { dismiss } = mountHost(isOpen);
    await nextTick();

    pressBack();
    await nextTick();

    expect(dismiss).toHaveBeenCalledTimes(1);
    // The browser already dropped the entry — stepping back here would eat the
    // navigation the entry was protecting.
    expect(back).not.toHaveBeenCalled();
  });

  it("consumes its entry when the overlay is closed from the UI", async () => {
    const isOpen = ref(true);
    const { dismiss } = mountHost(isOpen);
    await nextTick();

    isOpen.value = false;
    await nextTick();

    expect(back).toHaveBeenCalledTimes(1);
    // Leaving the listener attached would turn the *next* back press into a
    // second close of an overlay that is no longer on screen.
    pressBack();
    await nextTick();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("leaves history alone for an overlay that never opened", async () => {
    const isOpen = ref(true);
    mountHost(isOpen);
    await nextTick();
    pushState.mockClear();

    isOpen.value = false;
    await nextTick();
    back.mockClear();

    isOpen.value = false;
    await nextTick();

    expect(back).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("does not step back when unmounted while open", async () => {
    const isOpen = ref(true);
    const { wrapper, dismiss } = mountHost(isOpen);
    await nextTick();

    // The page navigated out from under the overlay; history has moved on.
    wrapper.unmount();
    pressBack();

    expect(back).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
