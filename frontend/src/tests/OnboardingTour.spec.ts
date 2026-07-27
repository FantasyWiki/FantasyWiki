import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mount,
  flushPromises,
  enableAutoUnmount,
  VueWrapper,
} from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import router from "@/router/index";
import i18n from "@/i18n";
import TourDock from "@/components/onboarding/TourDock.vue";
import { useAppStore } from "@/stores/app";
import { useOnboardingStore, TOUR_STEPS } from "@/stores/onboarding";

/**
 * The tour is a state the real app is in, so these tests drive the store and
 * the dock and assert on the *routes* and the *real elements* the tour claims
 * to be pointing at — never on slide content, because there is none.
 */
function signIn() {
  useAppStore().setUserFromData({
    sub: "player-1",
    email: "player@example.com",
    name: "Player One",
    picture: "",
  });
}

function findButton(wrapper: VueWrapper, text: string) {
  return wrapper.findAll("ion-button").find((b) => b.text().includes(text));
}

/** Stands in for a real page element the tour rings. */
function plantTarget(name: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-tour", name);
  document.body.appendChild(el);
  return el;
}

/**
 * Stands in for an Ionic page in the router outlet, with the tour anchors it
 * carries. Ionic keeps the page you came from mounted, so several pages can
 * hold an element matching the same selector at once.
 */
function plantPage(...names: string[]): Record<string, HTMLElement> {
  const page = document.createElement("div");
  page.className = "ion-page";
  document.body.appendChild(page);
  return Object.fromEntries(
    names.map((name) => {
      const el = document.createElement("div");
      el.setAttribute("data-tour", name);
      page.appendChild(el);
      return [name, el];
    })
  );
}

// The dock and the test have to share one store instance, so the spec's own
// pinia is passed at mount rather than relying on the global test default.
let pinia: Pinia;

async function mountDock() {
  const wrapper = mount(TourDock, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return wrapper;
}

// Every dock listens to the one shared router, so a wrapper left mounted keeps
// reacting to the next test's navigation. Unmount them as they finish.
enableAutoUnmount(afterEach);

describe("the guided tour", () => {
  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    signIn();
    i18n.global.locale.value = "en";
    await router.push("/dashboard");
    await router.isReady();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    i18n.global.locale.value = "en";
  });

  it("stays out of the way until it is started", async () => {
    const wrapper = await mountDock();

    expect(wrapper.find(".tour-dock").exists()).toBe(false);
  });

  it("narrates the dashboard first, with no way back from step one", async () => {
    const onboarding = useOnboardingStore();
    const wrapper = await mountDock();

    onboarding.start();
    await flushPromises();

    expect(wrapper.find(".tour-dock").exists()).toBe(true);
    expect(wrapper.text()).toContain("Points and credits");
    expect(wrapper.text()).toContain(`Step 1 of ${TOUR_STEPS.length}`);
    expect(findButton(wrapper, "Back")).toBeFalsy();
    // Still on the real dashboard: the tour never replaces the page.
    expect(router.currentRoute.value.path).toBe("/dashboard");
  });

  it("rings the real element a step is about", async () => {
    const stats = plantTarget("stats");
    const onboarding = useOnboardingStore();
    await mountDock();

    onboarding.start();
    await flushPromises();

    expect(stats.classList.contains("tour-ring")).toBe(true);
  });

  it("moves the ring off the previous element when the step changes", async () => {
    const stats = plantTarget("stats");
    const league = plantTarget("league");
    const onboarding = useOnboardingStore();
    await mountDock();

    onboarding.start();
    await flushPromises();
    onboarding.next();
    await flushPromises();

    expect(stats.classList.contains("tour-ring")).toBe(false);
    expect(league.classList.contains("tour-ring")).toBe(true);
  });

  it("walks the player onto the real market and team pages", async () => {
    const onboarding = useOnboardingStore();
    const wrapper = await mountDock();

    onboarding.start();
    await flushPromises();

    onboarding.next(); // league selector, still on the dashboard
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/dashboard");

    onboarding.next(); // market
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/market");
    expect(wrapper.text()).toContain("The market");

    // Back to the dashboard to point at the button that opens the pitch,
    // before showing the pitch itself: it has no navigation entry of its own.
    onboarding.next();
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/dashboard");
    expect(wrapper.text()).toContain("Getting to your pitch");

    onboarding.next(); // pitch
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/team");

    onboarding.next(); // wrap up, back where it started
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/dashboard");
    expect(wrapper.find("a[href='/guide']").exists()).toBe(true);
  });

  it("rings the navigation button for the page a step is about", async () => {
    // The mobile navigation is a row of bare icons, so naming the icon is the
    // point of the step, not a decoration on it.
    const stats = plantTarget("stats");
    const navDashboard = plantTarget("nav-dashboard");
    const onboarding = useOnboardingStore();
    await mountDock();

    onboarding.start();
    await flushPromises();

    expect(stats.classList.contains("tour-ring")).toBe(true);
    expect(navDashboard.classList.contains("tour-ring")).toBe(true);
  });

  it("rings the navigation button on the page it arrived at, not the one it left", async () => {
    // The bug this pins down: the ring used to be applied in the same tick as
    // the navigation, so the market step lit up the *dashboard's* copy of the
    // market button, which then vanished with the outgoing page and left the
    // market page with nothing highlighted.
    const leaving = plantPage("nav-market");
    const entering = plantPage("market", "nav-market");
    const onboarding = useOnboardingStore();
    await mountDock();

    onboarding.start();
    await flushPromises();
    onboarding.next(); // league
    await flushPromises();
    onboarding.next(); // market, on /market
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/market");
    expect(entering.market.classList.contains("tour-ring")).toBe(true);
    expect(entering["nav-market"].classList.contains("tour-ring")).toBe(true);
    expect(leaving["nav-market"].classList.contains("tour-ring")).toBe(false);
  });

  it("ends itself when the player leaves for the written guide", async () => {
    const onboarding = useOnboardingStore();
    const wrapper = await mountDock();

    onboarding.start();
    await flushPromises();
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      onboarding.next();
      await flushPromises();
    }

    await wrapper.get("a[href='/guide']").trigger("click");
    await flushPromises();

    expect(onboarding.isActive).toBe(false);
  });

  it("finishes on the dashboard and takes the dock with it", async () => {
    const onboarding = useOnboardingStore();
    const wrapper = await mountDock();

    onboarding.start();
    await flushPromises();
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      onboarding.next();
      await flushPromises();
    }

    await findButton(wrapper, "Done")!.trigger("click");
    await flushPromises();

    expect(onboarding.isActive).toBe(false);
    expect(wrapper.find(".tour-dock").exists()).toBe(false);
    expect(router.currentRoute.value.path).toBe("/dashboard");
  });

  it("can be skipped from any step before the last", async () => {
    const onboarding = useOnboardingStore();
    const wrapper = await mountDock();

    onboarding.start();
    await flushPromises();
    await findButton(wrapper, "Skip")!.trigger("click");
    await flushPromises();

    expect(onboarding.isActive).toBe(false);
  });

  it("follows a language switch made while it is running", async () => {
    const onboarding = useOnboardingStore();
    const wrapper = await mountDock();

    onboarding.start();
    await flushPromises();
    expect(wrapper.text()).toContain("Points and credits");

    // The settings menu (and its language rows) stays reachable throughout the
    // tour, so the copy has to re-resolve rather than freeze at the locale the
    // tour started in.
    i18n.global.locale.value = "it";
    await flushPromises();

    expect(wrapper.text()).toContain("Punti e crediti");
    expect(wrapper.text()).toContain(`Passo 1 di ${TOUR_STEPS.length}`);
  });

  it("replays from ?tour=1 and clears the flag behind it", async () => {
    const onboarding = useOnboardingStore();
    await router.push("/dashboard?tour=1");
    await mountDock();

    expect(onboarding.isActive).toBe(true);
    expect(router.currentRoute.value.query.tour).toBeUndefined();
  });

  it("never routes a replaying player back into team creation", async () => {
    // A returning player already has a team, and creating a second one is not
    // a thing: no step may point at the creation route.
    expect(TOUR_STEPS.some((step) => step.route === "/team-creation")).toBe(
      false
    );
  });

  it("keeps the old /onboarding link working by redirecting it to the tour", async () => {
    const onboarding = useOnboardingStore();
    await mountDock();

    await router.push("/onboarding");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/dashboard");
    expect(onboarding.isActive).toBe(true);
  });
});
