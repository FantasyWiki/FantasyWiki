import { onBeforeUnmount, ref, watch, type Ref } from "vue";

/**
 * What a touch drop resolves to. Mirrors the two moves TeamFormation/BenchSection
 * already support via native HTML5 drag-and-drop (`swap`, `moveToEmpty`) so the
 * touch path can drive the exact same handlers.
 */
export type DropDecision =
  | { kind: "swap"; targetId: string }
  | { kind: "moveToEmpty"; position: string }
  | { kind: "none" };

const ARTICLE_HOVER_CLASS = "article-node--dragover";
const EMPTY_SLOT_HOVER_CLASS = "pitch-slot-empty--dragover";
const DRAG_SOURCE_CLASS = "article-node--drag-source";

interface ResolvedDrop {
  decision: DropDecision;
  /** Element to apply hover styling to while dragging over it; null if none. */
  element: Element | null;
  hoverClass: string | null;
}

/**
 * Pure hit-test decision: given the element under the finger and the id of the
 * article being carried, decides whether this is a swap (dropped on another
 * article, pitch or bench), a move onto an empty pitch slot, or a no-op.
 *
 * Deliberately DOM-geometry-free (no getBoundingClientRect/elementFromPoint) so
 * it can be unit-tested with plain elements in jsdom.
 */
export function resolveDrop(
  target: Element | null,
  sourceId: string
): ResolvedDrop {
  if (!target)
    return { decision: { kind: "none" }, element: null, hoverClass: null };

  const articleEl = target.closest("[data-article-id]");
  if (articleEl) {
    const targetId = articleEl.getAttribute("data-article-id");
    if (targetId && targetId !== sourceId) {
      return {
        decision: { kind: "swap", targetId },
        element: articleEl,
        hoverClass: ARTICLE_HOVER_CLASS,
      };
    }
    return { decision: { kind: "none" }, element: null, hoverClass: null };
  }

  const slotEl = target.closest("[data-position]");
  if (slotEl) {
    const position = slotEl.getAttribute("data-position");
    if (position) {
      return {
        decision: { kind: "moveToEmpty", position },
        element: slotEl,
        hoverClass: EMPTY_SLOT_HOVER_CLASS,
      };
    }
  }

  return { decision: { kind: "none" }, element: null, hoverClass: null };
}

interface ScrollableContent extends Element {
  scrollByPoint(x: number, y: number, duration: number): Promise<void>;
}

function asScrollable(el: Element | null): ScrollableContent | null {
  if (!el) return null;
  const candidate = el as Partial<ScrollableContent>;
  return typeof candidate.scrollByPoint === "function"
    ? (el as ScrollableContent)
    : null;
}

const LONG_PRESS_MS = 400;
const MOVE_THRESHOLD_PX = 10;
const EDGE_ZONE_PX = 64;
const MAX_SCROLL_SPEED_PX = 14;

export interface UseTouchDragDropOptions {
  /** Id of the article this handle carries, read lazily at drop time. */
  articleId: () => string;
  disabled?: () => boolean;
  /** Called once per completed drag (i.e. the long-press engaged), even when the drop is a no-op. */
  onDrop: (decision: DropDecision) => void;
}

/**
 * Long-press-and-drag for touch devices, driving the same swap/moveToEmpty
 * handlers as the existing HTML5 drag-and-drop path (which is unreliable on
 * touch — see ArticleNode.vue). A long press on `handleRef` lifts a floating
 * clone that follows the finger; releasing over another article swaps, over
 * an empty pitch slot moves, anywhere else cancels.
 *
 * Autoscrolls the nearest `ion-content` ancestor near the viewport edges so a
 * bench tile can reach an off-screen pitch row (and vice versa) without first
 * scrolling by hand.
 */
export function useTouchDragDrop(
  handleRef: Ref<HTMLElement | null>,
  options: UseTouchDragDropOptions
) {
  const isDragging = ref(false);

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;
  let touchIdentifier: number | null = null;
  let offsetX = 0;
  let offsetY = 0;

  let ghost: HTMLElement | null = null;
  let hoverEl: Element | null = null;
  let hoverClass: string | null = null;

  let scrollHost: ScrollableContent | null = null;
  let scrollSpeed = 0;
  let scrollRaf: number | null = null;

  function clearHover() {
    if (hoverEl && hoverClass) hoverEl.classList.remove(hoverClass);
    hoverEl = null;
    hoverClass = null;
  }

  function updateHover(target: Element | null) {
    const resolved = resolveDrop(target, options.articleId());
    if (resolved.element === hoverEl) return;
    clearHover();
    if (resolved.element && resolved.hoverClass) {
      resolved.element.classList.add(resolved.hoverClass);
      hoverEl = resolved.element;
      hoverClass = resolved.hoverClass;
    }
  }

  function stepAutoscroll() {
    if (scrollSpeed !== 0 && scrollHost) {
      void scrollHost.scrollByPoint(0, scrollSpeed, 0);
    }
    scrollRaf = requestAnimationFrame(stepAutoscroll);
  }

  function startAutoscrollLoop() {
    if (scrollRaf == null) scrollRaf = requestAnimationFrame(stepAutoscroll);
  }

  function stopAutoscrollLoop() {
    if (scrollRaf != null) cancelAnimationFrame(scrollRaf);
    scrollRaf = null;
    scrollSpeed = 0;
  }

  function updateAutoscroll(clientY: number) {
    if (!scrollHost) {
      scrollSpeed = 0;
      return;
    }
    const rect = scrollHost.getBoundingClientRect();
    const topDist = clientY - rect.top;
    const bottomDist = rect.bottom - clientY;

    if (topDist < EDGE_ZONE_PX) {
      const ratio = 1 - Math.max(topDist, 0) / EDGE_ZONE_PX;
      scrollSpeed = -MAX_SCROLL_SPEED_PX * ratio;
    } else if (bottomDist < EDGE_ZONE_PX) {
      const ratio = 1 - Math.max(bottomDist, 0) / EDGE_ZONE_PX;
      scrollSpeed = MAX_SCROLL_SPEED_PX * ratio;
    } else {
      scrollSpeed = 0;
    }
  }

  function moveGhost(clientX: number, clientY: number) {
    if (!ghost) return;
    ghost.style.transform = `translate(${clientX - offsetX}px, ${clientY - offsetY}px) scale(1.05)`;
  }

  function createGhost(source: HTMLElement, touch: Touch) {
    const rect = source.getBoundingClientRect();
    offsetX = touch.clientX - rect.left;
    offsetY = touch.clientY - rect.top;

    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.top = "0";
    clone.style.left = "0";
    clone.style.margin = "0";
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.pointerEvents = "none";
    clone.style.zIndex = "9999";
    clone.style.opacity = "0.92";
    clone.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.25)";
    clone.style.transition = "none";
    clone.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(1.05)`;
    document.body.appendChild(clone);
    ghost = clone;
  }

  function destroyGhost() {
    ghost?.remove();
    ghost = null;
  }

  function cleanupDrag() {
    isDragging.value = false;
    destroyGhost();
    clearHover();
    stopAutoscrollLoop();
    scrollHost = null;
    touchIdentifier = null;
    handleRef.value?.classList.remove(DRAG_SOURCE_CLASS);
  }

  function findTouch(e: TouchEvent): Touch | null {
    if (touchIdentifier == null) return e.changedTouches[0] ?? null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdentifier)
        return e.changedTouches[i];
    }
    return null;
  }

  function onTouchStart(e: TouchEvent) {
    if (options.disabled?.() || isDragging.value) return;
    const touch = e.touches[0];
    if (!touch) return;

    touchIdentifier = touch.identifier;
    startX = touch.clientX;
    startY = touch.clientY;

    pressTimer = setTimeout(() => {
      pressTimer = null;
      const handle = handleRef.value;
      if (!handle) return;
      isDragging.value = true;
      scrollHost = asScrollable(handle.closest("ion-content"));
      createGhost(handle, touch);
      handle.classList.add(DRAG_SOURCE_CLASS);
      startAutoscrollLoop();
    }, LONG_PRESS_MS);
  }

  function onTouchMove(e: TouchEvent) {
    const touch = findTouch(e);
    if (!touch) return;

    if (!isDragging.value) {
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (pressTimer && Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      return;
    }

    // Dragging is engaged: stop the page from scrolling under the gesture.
    e.preventDefault();
    moveGhost(touch.clientX, touch.clientY);
    updateAutoscroll(touch.clientY);
    updateHover(document.elementFromPoint(touch.clientX, touch.clientY));
  }

  function onTouchEnd(e: TouchEvent) {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (!isDragging.value) return;

    const touch = findTouch(e) ?? e.changedTouches[0] ?? null;
    const target = touch
      ? document.elementFromPoint(touch.clientX, touch.clientY)
      : null;
    const { decision } = resolveDrop(target, options.articleId());
    cleanupDrag();
    options.onDrop(decision);
  }

  function onTouchCancel() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (isDragging.value) cleanupDrag();
  }

  function attach(el: HTMLElement) {
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchCancel);
  }

  function detach(el: HTMLElement) {
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchmove", onTouchMove);
    el.removeEventListener("touchend", onTouchEnd);
    el.removeEventListener("touchcancel", onTouchCancel);
  }

  watch(handleRef, (el, prevEl) => {
    if (prevEl) detach(prevEl);
    if (el) attach(el);
  });
  if (handleRef.value) attach(handleRef.value);

  onBeforeUnmount(() => {
    if (pressTimer) clearTimeout(pressTimer);
    cleanupDrag();
    if (handleRef.value) detach(handleRef.value);
  });

  return { isDragging };
}
