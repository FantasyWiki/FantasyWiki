import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import router from "@/router/index";
import TeamCreationPage from "@/views/TeamCreationPage.vue";
import { useAppStore } from "@/stores/app";
import { useLeagueStore } from "@/stores/league";
import { useOnboardingStore } from "@/stores/onboarding";
import { leagues } from "@/mocks/data/leagues";

// The real toast needs Ionic's overlay lifecycle to settle, which jsdom's
// microtask queue alone will not do; stubbed so the success path resolves.
vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ showSuccess: vi.fn().mockResolvedValue(undefined) }),
}));

// One pinia shared by the page and the assertions: the global test default
// would hand the component a different store instance than the spec reads.
let pinia: Pinia;

/**
 * The leagues the player already has a team in. The default fixture hands out
 * every league to everybody, which is neither state this page is reached in:
 * a player creating a team is either brand new (none) or not yet a member of
 * the league they are joining. It also drives the route guard, so it has to be
 * in place before the navigation, not just before the mount.
 */
function mockMyLeagues(ids: string[]) {
  server.use(
    http.get("*/api/leagues", () =>
      HttpResponse.json(leagues.filter((lg) => ids.includes(lg.id)))
    )
  );
}

async function mountPage(path = "/team-creation") {
  await router.push(path);
  await router.isReady();
  const wrapper = mount(TeamCreationPage, {
    global: { plugins: [pinia, router] },
  });
  await flushPromises();
  return wrapper;
}

async function submitName(wrapper: VueWrapper, name: string) {
  const input = wrapper.find("ion-input");
  (input.element as unknown as { value: string }).value = name;
  await input.trigger("ionInput");
  await wrapper.find("form").trigger("submit");
  await flushPromises();
}

describe("TeamCreationPage.vue", () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    useAppStore().setUserFromData({
      sub: "player-1",
      email: "player@example.com",
      name: "Player One",
      picture: "",
    });
  });

  describe("signup (no league in the route)", () => {
    // Signup is only reachable by a player who is in no league at all.
    beforeEach(() => mockMyLeagues([]));

    it("explains the game beside the form instead of before it", async () => {
      const wrapper = await mountPage();
      const text = wrapper.text();

      expect(text).toContain("Welcome to FantasyWiki");
      // The objective and the day loop are on the same screen as the field the
      // player has to fill in, not on slides in front of it.
      expect(text).toContain("How a day scores");
      expect(text).toContain("at the end of the league wins");
      expect(wrapper.find("ion-input").exists()).toBe(true);
    });

    it("loads the Global League from /api/leagues/global and shows it", async () => {
      const wrapper = await mountPage();

      expect(wrapper.text()).toContain("Global League");
      expect(wrapper.text()).toContain("🌍");
    });

    it("hands over to the populated dashboard with the tour running", async () => {
      const leagueStore = useLeagueStore();
      const onboarding = useOnboardingStore();
      const wrapper = await mountPage();

      await submitName(wrapper, "The Wiki Wizards");

      // The league store was empty a moment ago (the player had no team), so
      // without this refresh the dashboard would greet them with its "no league"
      // card instead of their team.
      expect(leagueStore.currentLeague?.id).toBe("global");
      expect(onboarding.isActive).toBe(true);
      expect(router.currentRoute.value.path).toBe("/dashboard");
    });

    it("shows an error message and re-enables the form when team creation fails", async () => {
      server.use(
        http.post("*/api/leagues/:leagueId/my-team", () =>
          HttpResponse.json(
            { error: "This team name is already taken in this league." },
            { status: 400 }
          )
        )
      );

      const wrapper = await mountPage();
      await submitName(wrapper, "The Wiki Wizards");

      expect(wrapper.text()).toContain(
        "This team name is already taken in this league."
      );
      expect(useOnboardingStore().isActive).toBe(false);
    });

    it("rejects a name that is too short before calling the API", async () => {
      const wrapper = await mountPage();
      await submitName(wrapper, "ab");

      expect(wrapper.text()).toContain("at least 3 characters");
      expect(router.currentRoute.value.path).toBe("/team-creation");
    });
  });

  describe("entering a further league (league in the route)", () => {
    const joinPath = "/leagues/italy/team-creation";
    /**
     * This route is the *public* way in: it carries no invitation code, so a
     * private league would answer 403 here and the join-by-code page
     * (`/leagues/join`) is what a private league's page links to instead. The
     * tests above only render Italia — reading a private league is allowed —
     * but the one that actually submits has to target a league anyone may
     * enter.
     */
    const publicJoinPath = "/leagues/open-science/team-creation";

    // A player already in the Global League, not yet in Italia.
    beforeEach(() => mockMyLeagues(["global"]));

    it("names the league from the route, not the Global League", async () => {
      const wrapper = await mountPage(joinPath);
      // Scoped to the form: the NavBar's league switcher names the league the
      // player is currently *in*, which is a different thing.
      const form = wrapper.find(".start-form").text();

      expect(form).toContain("Italia League");
      expect(form).not.toContain("Global League");
    });

    it("does not re-explain the game to a player who already plays it", async () => {
      const wrapper = await mountPage(joinPath);

      expect(wrapper.text()).not.toContain("Welcome to FantasyWiki");
      // The form itself is the whole page here.
      expect(wrapper.find("ion-input").exists()).toBe(true);
    });

    it("lands on the league just joined, with no tour", async () => {
      const leagueStore = useLeagueStore();
      const onboarding = useOnboardingStore();
      // A returning player: the store already holds the league they were in,
      // and a plain refetch would resolve back to it.
      localStorage.setItem(
        "currentLeague",
        JSON.stringify({
          id: "global",
          title: "Global League",
          domain: "en",
          icon: "🌍",
          startDate: "2024-01-01T00:00:00Z",
          endDate: "2024-12-31T23:59:59Z",
          teams: [],
        })
      );
      await leagueStore.initialize();

      const wrapper = await mountPage(publicJoinPath);
      await submitName(wrapper, "The Wiki Wizards");

      expect(leagueStore.currentLeague?.id).toBe("open-science");
      expect(onboarding.isActive).toBe(false);
      expect(router.currentRoute.value.path).toBe("/dashboard");
    });

    it("says so instead of offering a form when the league cannot be loaded", async () => {
      server.use(
        http.get("*/api/leagues/:leagueId", () =>
          HttpResponse.json({ error: "League not found" }, { status: 404 })
        )
      );

      const wrapper = await mountPage("/leagues/nope/team-creation");
      await flushPromises();

      expect(wrapper.text()).toContain("That league could not be loaded");
      expect(wrapper.find("form").exists()).toBe(false);
    });
  });

  // Whether the page is reachable at all is the route guard's job, and it is
  // covered in TeamCreationGuard.spec.ts rather than here: once this spec has
  // mounted a component, the guard's `useLeagueStore()` no longer resolves to
  // the same instance the assertions read, so an earlier test's league list
  // decides the outcome instead of the mock. Nothing in *this* file exercises
  // the guard — the repeated pushes to a route the singleton router is already
  // on are duplicate navigations that never reach it.
});
