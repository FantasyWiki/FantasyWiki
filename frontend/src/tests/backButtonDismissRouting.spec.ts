import { describe, it, expect, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import { useBackButtonDismiss } from "@/composables/useBackButtonDismiss";

/**
 * The composable's own spec asserts what it asks the browser to do. This one
 * asserts what the browser and vue-router then actually do about it, against a
 * real history stack: the whole point of the fix is that a back press stops at
 * the overlay instead of unwinding the route behind it.
 */
const Blank = defineComponent({ render: () => h("div") });

function makeRouter() {
  return createRouter({
    history: createWebHistory("/"),
    routes: [
      { path: "/dashboard", component: Blank },
      { path: "/market", component: Blank },
    ],
  });
}

/** Resolves after the browser has delivered its (asynchronous) popstate. */
function popped() {
  return new Promise<void>((resolve) =>
    window.addEventListener("popstate", () => resolve(), { once: true })
  );
}

describe("useBackButtonDismiss against a real history stack", () => {
  it("spends the back press on the overlay, not on the route", async () => {
    const router = makeRouter();
    await router.push("/dashboard");
    await router.push("/market");

    const isOpen = ref(false);
    const dismiss = vi.fn(() => {
      isOpen.value = false;
    });

    mount(
      defineComponent({
        setup() {
          useBackButtonDismiss(isOpen, dismiss);
          return () => h("div");
        },
      }),
      { global: { plugins: [router] } }
    );

    isOpen.value = true;
    await nextTick();

    const settled = popped();
    window.history.back();
    await settled;
    await nextTick();

    expect(dismiss).toHaveBeenCalledTimes(1);
    // The reported bug: this used to land back on /dashboard with the modal
    // still on screen.
    expect(router.currentRoute.value.path).toBe("/market");
  });

  it("hands the next back press to the route once the overlay is closed", async () => {
    const router = makeRouter();
    await router.push("/dashboard");
    await router.push("/market");

    const isOpen = ref(false);
    mount(
      defineComponent({
        setup() {
          useBackButtonDismiss(isOpen, () => {
            isOpen.value = false;
          });
          return () => h("div");
        },
      }),
      { global: { plugins: [router] } }
    );

    // Opened, then closed from the UI — the entry it pushed must be gone, or
    // the press below would be swallowed by an overlay nobody can see.
    isOpen.value = true;
    await nextTick();
    const consumed = popped();
    isOpen.value = false;
    await nextTick();
    await consumed;
    // vue-router resolves a popstate asynchronously; the next press has to
    // land on a settled stack, exactly as a second thumb tap would.
    await flushPromises();

    const settled = popped();
    window.history.back();
    await settled;
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/dashboard");
  });
});
