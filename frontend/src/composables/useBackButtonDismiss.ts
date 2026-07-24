import { onUnmounted, watch, type Ref } from "vue";

/**
 * Makes an overlay answer the phone's back button by closing, instead of
 * letting the page underneath it navigate away.
 *
 * An Ionic modal driven by `is-open` is invisible to history, so on the web —
 * where the phone's back button is the browser's — a back press unwound the
 * route stack while the modal stayed on screen over whatever page landed
 * there. The fix is to give the open overlay a history entry of its own for
 * that press to consume.
 *
 * The entry repeats the current URL and the router's own state object, so
 * vue-router sees nothing on the way in (`pushState` fires no `popstate`) and
 * resolves to the location it is already on when the entry is popped — a
 * redundant navigation it drops. Only the listener below reacts.
 *
 * @param isOpen whether the overlay is currently presented
 * @param dismiss closes the overlay; called when back is pressed
 */
export function useBackButtonDismiss(
  isOpen: Ref<boolean>,
  dismiss: () => void
) {
  // Whether the entry below is ours to consume. Guards the two ways this can
  // go wrong: closing without having pushed (which would eat a real history
  // entry) and popping twice for a single press.
  let pushedEntry = false;

  function onPopState() {
    // Back was pressed. The browser has already dropped our entry, so there is
    // nothing left to consume — just close.
    pushedEntry = false;
    window.removeEventListener("popstate", onPopState);
    dismiss();
  }

  watch(
    isOpen,
    (open) => {
      if (open) {
        if (pushedEntry) return;
        window.history.pushState(window.history.state, "");
        pushedEntry = true;
        window.addEventListener("popstate", onPopState);
        return;
      }

      if (!pushedEntry) return;
      // Closed from the UI — the X, a swipe down, or an action that finished.
      // Drop the listener before stepping back so the resulting `popstate`
      // finds no handler, then consume the entry we added: leaving it would
      // make the next back press do nothing at all.
      pushedEntry = false;
      window.removeEventListener("popstate", onPopState);
      window.history.back();
    },
    // Hosts typically render the overlay and open it in the same tick, so the
    // first `true` arrives before any watcher would have run.
    { immediate: true }
  );

  onUnmounted(() => {
    // Unmounting while open means the page navigated out from under the
    // overlay. History has already moved on; stepping back would undo that
    // navigation, so the orphaned entry is left alone.
    window.removeEventListener("popstate", onPopState);
  });
}
