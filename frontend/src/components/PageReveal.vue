<template>
  <div ref="root" class="page-reveal"><slot /></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";

/**
 * Staggered page entrance. Hides its direct children, then releases them one
 * after another in DOM order once the content is ready.
 *
 * The whole system is "hide the page, then reveal it", so its failure mode is
 * an invisible page. Two guards keep that from happening:
 *
 *  - The hide is applied from JS (the `--armed` class), never from static CSS.
 *    If setup throws, or a child is never collected, no class is added and the
 *    page is merely un-animated — never blank.
 *  - A `when` that never resolves still reveals after {@link SAFETY_MS}, so no
 *    caller can hang its own content on a signal that never comes.
 *
 * The reveal rules live in `theme/variables.css`, not here: the children are
 * slotted from the host page, so they carry the page's scoped-style attribute
 * and a `<style scoped>` rule in this component would never match them.
 */
const props = withDefaults(
  defineProps<{
    /**
     * Turns true once the content is ready to be shown. Omit it entirely to
     * reveal on mount — the common case, where the wrapper sits inside a
     * `v-else` and so only mounts once the load has already resolved.
     *
     * The default is `true` rather than left undefined on purpose: Vue coerces
     * an absent `Boolean` prop to `false`, which would leave every page that
     * omits it hidden until the safety timer. Defaulting to `true` makes "omit"
     * mean "reveal now", while an explicit `:when="false"` still gates.
     */
    when?: boolean;
  }>(),
  { when: true }
);

/** Reveal regardless once this elapses, so a stuck `when` cannot blank a page. */
const SAFETY_MS = 2000;

/**
 * Seven elements get a distinct step (indices 0–6); every later child shares
 * the sixth. That caps the total stagger at 6 × --reveal-stagger ≈ 540ms
 * however many children a page has, and keeps every page's entrance identical
 * for its first seven elements instead of scaling to fit the child count.
 */
const MAX_REVEAL_INDEX = 6;

const root = ref<HTMLElement | null>(null);
let revealed = false;
let safetyTimer: number | undefined;
let unwatch: (() => void) | undefined;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function reveal(): void {
  const el = root.value;
  if (revealed || !el) return;
  revealed = true;
  window.clearTimeout(safetyTimer);
  unwatch?.();
  el.classList.add("page-reveal--revealed");
}

onMounted(() => {
  const el = root.value;
  // Reduced motion skips the animation entirely: the children are simply
  // present, never hidden and released.
  if (!el || prefersReducedMotion()) return;

  const children = Array.from(el.children) as HTMLElement[];
  children.forEach((child, i) => {
    child.style.setProperty(
      "--reveal-index",
      String(Math.min(i, MAX_REVEAL_INDEX))
    );
  });
  el.classList.add("page-reveal--armed");

  // Reveal anyway after the safety window, whatever `when` does.
  safetyTimer = window.setTimeout(reveal, SAFETY_MS);

  // React to `when` turning true later — the armed state has painted by then,
  // so adding the revealed class transitions cleanly.
  unwatch = watch(
    () => props.when,
    (ready) => {
      if (ready) reveal();
    }
  );

  // Mount default (`when` omitted, so true) or an already-true `when`: reveal
  // now, but force the armed opacity:0 to commit first so the transition
  // actually runs instead of the browser collapsing both changes into a frame.
  if (props.when) {
    void el.offsetHeight;
    reveal();
  }
});

onUnmounted(() => window.clearTimeout(safetyTimer));
</script>
