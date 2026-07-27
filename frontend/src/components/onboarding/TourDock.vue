<template>
  <transition name="dock">
    <aside
      v-if="onboarding.isActive"
      class="tour-dock"
      role="region"
      :aria-label="t('onboarding.tour.label')"
    >
      <div class="dock-rail" aria-hidden="true">
        <span class="dock-rail__fill" :style="{ width: railWidth }" />
      </div>

      <!-- Announced politely: the step changes under a screen reader that is
           reading the page behind it, not a dialog it was moved into. -->
      <div class="dock-body" aria-live="polite">
        <p class="dock-count">
          {{
            t("onboarding.tour.progress", {
              current: onboarding.stepIndex + 1,
              total: onboarding.totalSteps,
            })
          }}
        </p>
        <h2 class="dock-title">{{ copy.title }}</h2>
        <p class="dock-text">{{ copy.body }}</p>
        <!-- Leaving for the written guide ends the tour: a dock still
             narrating the dashboard on top of a page the player deliberately
             navigated away to is just clutter. -->
        <router-link
          v-if="onboarding.isLastStep"
          to="/guide"
          class="dock-link"
          @click="onboarding.end()"
        >
          {{ t("onboarding.tour.guideLink") }}
        </router-link>
      </div>

      <div class="dock-actions">
        <ion-button
          v-if="!onboarding.isLastStep"
          fill="clear"
          size="small"
          class="dock-skip"
          @click="onboarding.end()"
        >
          {{ t("onboarding.tour.skip") }}
        </ion-button>
        <span class="dock-spacer" />
        <ion-button
          v-if="!onboarding.isFirstStep"
          fill="clear"
          size="small"
          @click="onboarding.back()"
        >
          {{ t("onboarding.tour.back") }}
        </ion-button>
        <ion-button
          color="primary"
          fill="solid"
          size="small"
          class="dock-next"
          @click="onboarding.next()"
        >
          {{ onboarding.isLastStep ? t("onboarding.tour.done") : nextLabel }}
        </ion-button>
      </div>
    </aside>
  </transition>
</template>

<script setup lang="ts">
import { computed, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { IonButton } from "@ionic/vue";
import { useOnboardingStore, type TourStepId } from "@/stores/onboarding";

/**
 * Narrates the tour from a dock pinned above the navigation, while the player
 * looks at the real page behind it.
 *
 * Two rules keep it from becoming the slideshow it replaced:
 *  - it never covers the app and never blocks input, so the player can ignore
 *    it, scroll, switch language or click the very button it is describing;
 *  - it owns no content of its own beyond one line per step. The screen behind
 *    it is the explanation.
 *
 * The ring it draws on the described element is a *best effort* side effect: a
 * step whose target is still loading (or absent, on a page that failed to
 * fetch) narrates anyway rather than stalling the tour.
 */
const RING_CLASS = "tour-ring";
/**
 * Retry budget for a target that has not rendered yet (~5s total). The
 * dashboard ledger and the market listing only exist once their fetch
 * resolves, and the market's comes from Wikimedia, which on a cold first load
 * is the slowest thing here (~8s of patience).
 */
const RING_RETRY_MS = 200;
const RING_MAX_TRIES = 40;
/**
 * Ionic animates a page in over roughly 300ms, and scrolling a page that is
 * still sliding either gets lost or lands on the wrong offset. Wait for it to
 * settle, then move.
 */
const SCROLL_SETTLE_MS = 360;
/** Length of the scroll itself: long enough to be followed by eye. */
const SCROLL_MS = 320;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const onboarding = useOnboardingStore();

// Copy is resolved through a computed rather than baked into the step list, so
// switching language mid-tour (the settings menu is reachable throughout)
// re-renders the dock instead of freezing it in the locale it started in.
const copyByStep = computed<
  Record<TourStepId, { title: string; body: string }>
>(() => ({
  stats: {
    title: t("onboarding.tour.stats.title"),
    body: t("onboarding.tour.stats.body"),
  },
  league: {
    title: t("onboarding.tour.league.title"),
    body: t("onboarding.tour.league.body"),
  },
  market: {
    title: t("onboarding.tour.market.title"),
    body: t("onboarding.tour.market.body"),
  },
  manageTeam: {
    title: t("onboarding.tour.manageTeam.title"),
    body: t("onboarding.tour.manageTeam.body"),
  },
  formation: {
    title: t("onboarding.tour.formation.title"),
    body: t("onboarding.tour.formation.body"),
  },
  wrap: {
    title: t("onboarding.tour.wrap.title"),
    body: t("onboarding.tour.wrap.body"),
  },
}));

const copy = computed(() => {
  const step = onboarding.currentStep;
  return step ? copyByStep.value[step.id] : { title: "", body: "" };
});

// "Next" reads as "take me there" when the step is on another page, so the
// button says what the click will actually do.
const nextLabel = computed(() => {
  const step = onboarding.currentStep;
  return step && step.route !== route.path
    ? t("onboarding.tour.take")
    : t("onboarding.tour.next");
});

const railWidth = computed(
  () => `${((onboarding.stepIndex + 1) / onboarding.totalSteps) * 100}%`
);

// ── Ring ────────────────────────────────────────────────────────────────────

let ringEls: HTMLElement[] = [];
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let scrollTimer: ReturnType<typeof setTimeout> | undefined;
let hasScrolled = false;

function clearRings() {
  clearTimeout(retryTimer);
  clearTimeout(scrollTimer);
  retryTimer = undefined;
  scrollTimer = undefined;
  ringEls.forEach((el) => el.classList.remove(RING_CLASS));
  ringEls = [];
  hasScrolled = false;
}

/**
 * Puts the ringed element on screen. A highlight below the fold is not a
 * highlight: the Manage team button sits under the dashboard hero on a phone,
 * so the step that points at it has to bring it up.
 *
 * An Ionic page scrolls inside its own `ion-content`, not the window, so
 * `scrollIntoView` alone is unreliable here. Ask the content element to do it
 * when there is one, and keep the plain DOM call as the fallback for anything
 * rendered outside a page (and for jsdom, which has neither).
 */
async function bringIntoView(el: HTMLElement): Promise<void> {
  const content = el.closest("ion-content") as HTMLIonContentElement | null;

  if (typeof content?.getScrollElement === "function") {
    const scroller = await content.getScrollElement();
    const offset =
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    // Centre it, so the dock pinned to the bottom never sits on top of it.
    const centred = offset - (scroller.clientHeight - el.clientHeight) / 2;
    await content.scrollToPoint(0, Math.max(0, centred), SCROLL_MS);
    return;
  }

  el.scrollIntoView?.({ block: "center", behavior: "smooth" });
}

function resolveTarget(
  selector: string,
  scope: ParentNode = document
): HTMLElement | null {
  const matches = Array.from(
    scope.querySelectorAll<HTMLElement>(selector)
  ).filter((el) => el.isConnected && !el.closest(".ion-page-hidden"));
  if (!matches.length) return null;
  // One selector can match several elements: Ionic keeps visited pages mounted
  // in the router outlet, and a couple of anchors (the market listing, the
  // navigation links) exist once for mobile and once for desktop. Prefer one
  // that is actually laid out, then the last in document order, which is the
  // most recently entered page.
  return (
    matches.find((el) => el.offsetParent !== null) ??
    matches[matches.length - 1]
  );
}

/** The Ionic page an element belongs to, so siblings can be found within it. */
function pageOf(el: HTMLElement): ParentNode {
  return el.closest(".ion-page") ?? document;
}

/**
 * Rings the targets of a step, on the page the step is about.
 *
 * The first selector is the subject and drives everything: nothing is ringed
 * until it resolves, and the remaining selectors (the navigation button that
 * reaches this page) are then looked up **inside the subject's own Ionic
 * page**. That scoping is load-bearing. Ionic keeps the page you came from
 * mounted, so a document-wide lookup for the navigation button finds the
 * *previous* page's copy, rings it, and the ring vanishes with that page a
 * moment later, leaving the entered page with nothing lit up.
 */
function applyRings(
  selectors: readonly string[],
  triesLeft = RING_MAX_TRIES
): void {
  const [subject, ...companions] = selectors;

  const subjectEl = resolveTarget(subject);
  if (!subjectEl) {
    // The page is still arriving or still fetching. Keep looking for a bounded
    // while, then give up quietly: the dock has already said its line.
    if (triesLeft > 0) {
      retryTimer = setTimeout(
        () => applyRings(selectors, triesLeft - 1),
        RING_RETRY_MS
      );
    }
    return;
  }

  ring(subjectEl);
  if (!hasScrolled) {
    hasScrolled = true;
    scrollTimer = setTimeout(
      () => void bringIntoView(subjectEl),
      SCROLL_SETTLE_MS
    );
  }

  const page = pageOf(subjectEl);
  for (const selector of companions) {
    const el = resolveTarget(selector, page);
    if (el) ring(el);
  }
}

function ring(el: HTMLElement): void {
  if (el.classList.contains(RING_CLASS)) return;
  el.classList.add(RING_CLASS);
  ringEls.push(el);
}

// ── Step driving ────────────────────────────────────────────────────────────

// Driven by the step *and* the route, because a step is only ringable once the
// app is actually on its page. Navigating and ringing in the same tick lit up
// the outgoing page; now the navigation happens, this watcher fires again on
// arrival, and only then does anything get ringed. It also means a player who
// wanders off mid-step gets the ring back when they return.
watch(
  [() => onboarding.currentStep, () => route.path],
  ([step, path]) => {
    clearRings();
    if (!step) return;
    if (step.route !== path) {
      void router.push(step.route);
      return;
    }
    if (step.targets?.length) applyRings(step.targets);
  },
  { immediate: true }
);

// Replay entry point. `?tour=1` on the dashboard is what the settings menu and
// the public guide link to: it is a normal auth-gated route, so an anonymous
// visitor following it from the guide gets the login modal rather than a
// broken tour. The flag is stripped once consumed so a later reload is clean.
watch(
  () => route.query.tour,
  (flag) => {
    if (flag !== "1") return;
    onboarding.start();
    const query = { ...route.query };
    delete query.tour;
    void router.replace({ path: route.path, query });
  },
  { immediate: true }
);

onUnmounted(clearRings);
</script>

<style scoped>
.tour-dock {
  position: fixed;
  z-index: 999;
  left: 50%;
  transform: translateX(-50%);
  /* Clears the mobile navigation footer, which is where the thumb is. */
  bottom: calc(4.5rem + env(safe-area-inset-bottom));
  width: min(31rem, calc(100vw - 1.5rem));
  overflow: hidden;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-background-color);
  /* The themed shadow token, so the dock does not glow white in dark mode. */
  box-shadow: 0 6px 28px var(--ion-box-shadow-color);
}

@media (min-width: 768px) {
  .tour-dock {
    bottom: 1.5rem;
  }
}

.dock-rail {
  height: 2px;
  background: var(--ion-background-color-step-100);
}

.dock-rail__fill {
  display: block;
  height: 100%;
  background: var(--ion-color-primary);
  transition: width 220ms ease-out;
}

.dock-body {
  padding: 0.875rem 1rem 0.25rem;
}

.dock-count {
  margin: 0 0 0.35rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}

.dock-title {
  margin: 0 0 0.25rem;
  font-family: var(--ion-font-family);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ion-text-color);
}

.dock-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--ion-color-medium);
}

.dock-link {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ion-color-primary);
  text-decoration: none;
}

.dock-link:hover {
  text-decoration: underline;
}

.dock-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.65rem 0.6rem;
}

.dock-spacer {
  flex: 1;
}

.dock-next {
  --padding-start: 14px;
  --padding-end: 14px;
}

/* Enter and leave: 200ms, transform and opacity only. */
.dock-enter-active,
.dock-leave-active {
  transition:
    opacity 200ms ease-out,
    transform 200ms ease-out;
}

.dock-enter-from,
.dock-leave-to {
  opacity: 0;
  transform: translate(-50%, 0.75rem);
}

@media (prefers-reduced-motion: reduce) {
  .dock-enter-active,
  .dock-leave-active,
  .dock-rail__fill {
    transition: none;
  }
}
</style>
