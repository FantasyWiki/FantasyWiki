import { onMounted, onUnmounted, ref, type Ref } from "vue";

/**
 * How long a caller will wait for the fonts before giving up on them. A font
 * that is slow — or never arrives — must not leave the page blank, so the flag
 * flips regardless once this elapses.
 */
const MAX_WAIT_MS = 500;

/**
 * Flips once the web fonts have finished loading, so a caller can hold content
 * back until the layout has stopped moving.
 *
 * Text first paints in the fallback family and then re-lays out the moment the
 * real fonts land (`font-display: swap`), which on a text-heavy page reads as
 * the whole thing reloading top to bottom. Self-hosting the fonts shortened
 * that window but cannot close it; gating the entrance animation on this flag
 * does, because the swap happens while the section is still invisible.
 *
 * `document.fonts` is absent under jsdom, where there is nothing to wait for.
 */
export function useFontsReady(): { isReady: Ref<boolean> } {
  const isReady = ref(false);
  let timer: number | undefined;

  onMounted(() => {
    if (typeof document === "undefined" || !document.fonts) {
      isReady.value = true;
      return;
    }

    timer = window.setTimeout(() => {
      isReady.value = true;
    }, MAX_WAIT_MS);

    void document.fonts.ready.then(() => {
      window.clearTimeout(timer);
      isReady.value = true;
    });
  });

  onUnmounted(() => window.clearTimeout(timer));

  return { isReady };
}
