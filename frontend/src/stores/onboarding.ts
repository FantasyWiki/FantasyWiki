import { defineStore } from "pinia";
import { computed, ref } from "vue";

/**
 * The guided first-run tour.
 *
 * The tour is not a place you go: it is a state the app is in. Every step
 * happens on a *real* route, with the real NavBar, the real data and the real
 * buttons on screen; the only thing this store adds is which step is current.
 * That is why there is no `/onboarding` view and no slide content here — the
 * pages themselves are the content, and `TourDock.vue` narrates them.
 *
 * Nothing is persisted. The trigger for a first run is creating a team (the
 * one thing a new player necessarily does, and can only do once), and the
 * trigger for a replay is `?tour=1`, so there is no "has seen onboarding" flag
 * to keep in sync with the backend.
 */
export type TourStepId =
  | "stats"
  | "league"
  | "market"
  | "manageTeam"
  | "formation"
  | "wrap";

export interface TourStep {
  id: TourStepId;
  /** Route the step is narrated on. Entering the step navigates there. */
  route: string;
  /**
   * Elements the step is about, as selectors, most important first. Resolved
   * best-effort at runtime: a step whose targets never appear still narrates,
   * just without a ring.
   *
   * Most steps name two — the thing on the page *and* the navigation button
   * that reaches it. The mobile navigation is a row of bare icons, so the tour
   * has to say which icon it is talking about, not just what the page holds.
   */
  targets?: readonly string[];
}

/**
 * Order follows the navigation bar (dashboard, leagues, market, team) so the
 * tour teaches the menu the player is about to use, in the order they read it.
 *
 * Two deliberate detours:
 *  - `league` has no route of its own. `/leagues` is still a stub, and the
 *    league switcher in the NavBar is the real thing a player needs to find, so
 *    the tour points at it in place rather than walking them into a placeholder.
 *  - `manageTeam` sends the player back to the dashboard to show the button
 *    that opens the pitch *before* the pitch itself. The pitch has no
 *    navigation entry of its own, so without this step a player would learn a
 *    screen they cannot find again.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "stats",
    route: "/dashboard",
    targets: ["[data-tour='stats']", "[data-tour='nav-dashboard']"],
  },
  { id: "league", route: "/dashboard", targets: ["[data-tour='league']"] },
  {
    id: "market",
    route: "/market",
    targets: ["[data-tour='market']", "[data-tour='nav-market']"],
  },
  {
    id: "manageTeam",
    route: "/dashboard",
    targets: ["[data-tour='manage-team']"],
  },
  { id: "formation", route: "/team", targets: ["[data-tour='formation']"] },
  { id: "wrap", route: "/dashboard" },
] as const;

export const useOnboardingStore = defineStore("onboarding", () => {
  const isActive = ref(false);
  const stepIndex = ref(0);

  const currentStep = computed<TourStep | undefined>(() =>
    isActive.value ? TOUR_STEPS[stepIndex.value] : undefined
  );

  const totalSteps = computed(() => TOUR_STEPS.length);
  const isFirstStep = computed(() => stepIndex.value === 0);
  const isLastStep = computed(() => stepIndex.value === TOUR_STEPS.length - 1);

  /** Begin (or restart) the tour at its first step. */
  function start() {
    stepIndex.value = 0;
    isActive.value = true;
  }

  /** Advance; the last step's "next" is the finish. */
  function next() {
    if (!isActive.value) return;
    if (isLastStep.value) {
      end();
      return;
    }
    stepIndex.value += 1;
  }

  function back() {
    if (!isActive.value || isFirstStep.value) return;
    stepIndex.value -= 1;
  }

  function end() {
    isActive.value = false;
    stepIndex.value = 0;
  }

  return {
    isActive,
    stepIndex,
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    start,
    next,
    back,
    end,
  };
});
