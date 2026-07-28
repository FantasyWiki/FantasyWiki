import { describe, it, expect, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { IonModal } from "@ionic/vue";
import router from "@/router/index";
import TeamRequiredModal from "@/components/onboarding/TeamRequiredModal.vue";
import { useAppStore } from "@/stores/app";
import { useLeagueStore } from "@/stores/league";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import { GLOBAL_LEAGUE_ID } from "../../../model/league";

/**
 * The modal is the safety net for an interrupted first run (issue #475): a
 * player who signs in but never names a team is stranded with no team in any
 * league, and the one-shot `?new=1` signal that first routed them to signup is
 * long gone. It re-proposes team creation from membership state, so these tests
 * drive the league store directly rather than the route.
 */
let pinia: Pinia;

function signIn() {
  useAppStore().setUserFromData({
    sub: "player-1",
    email: "player@example.com",
    name: "Player One",
    picture: "",
  });
}

/** Mark the league list as fetched, with or without a team in it. */
function setTeams(leagues: LeagueDTO[]) {
  const store = useLeagueStore();
  store.availableLeagues = leagues;
  store.hasLoaded = true;
}

async function mountModal(path = "/dashboard") {
  await router.push(path);
  await router.isReady();
  const wrapper = mount(TeamRequiredModal, {
    global: { plugins: [pinia, router] },
  });
  await flushPromises();
  return wrapper;
}

function isOpen(wrapper: Awaited<ReturnType<typeof mountModal>>) {
  return wrapper.findComponent(IonModal).props("isOpen");
}

describe("TeamRequiredModal.vue", () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
  });

  it("prompts an authenticated player who has no team", async () => {
    signIn();
    setTeams([]);

    expect(isOpen(await mountModal())).toBe(true);
  });

  it("prompts a player who is in another league but not the Global League", async () => {
    // Forward-looking: joining further leagues is coming, and a player can hold
    // a team elsewhere while still owing their mandatory Global League team.
    // That player has not finished onboarding, so they are still prompted.
    signIn();
    setTeams([{ id: "italy" } as LeagueDTO]);

    expect(isOpen(await mountModal())).toBe(true);
  });

  it("stays hidden while the league list has not been fetched yet", async () => {
    // Empty-and-unloaded reads the same as empty-and-teamless; the modal must
    // wait for the fetch rather than flash on the initial state.
    signIn();

    expect(isOpen(await mountModal())).toBe(false);
  });

  it("stays hidden for a player who has their Global League team", async () => {
    signIn();
    setTeams([{ id: GLOBAL_LEAGUE_ID } as LeagueDTO]);

    expect(isOpen(await mountModal())).toBe(false);
  });

  it("stays hidden for a signed-out visitor", async () => {
    setTeams([]);

    expect(isOpen(await mountModal())).toBe(false);
  });

  it("does not cover the team-creation page it sends the player to", async () => {
    // The team-creation guard re-fetches the league list to decide entry; a
    // teamless player has none, which is what lets them onto the page.
    server.use(http.get("*/api/leagues", () => HttpResponse.json([])));
    signIn();
    setTeams([]);

    expect(isOpen(await mountModal("/team-creation"))).toBe(false);
  });

  it("stays out of public pages like the landing page", async () => {
    // The prompt belongs on the in-app screens a team is needed for, not the
    // moment a teamless player lands on the marketing home.
    signIn();
    setTeams([]);

    expect(isOpen(await mountModal("/home"))).toBe(false);
  });

  it("guards the team-scoped screens a player without a team reaches", async () => {
    signIn();
    setTeams([]);

    for (const path of ["/dashboard", "/team", "/market", "/leagues"]) {
      expect(isOpen(await mountModal(path)), path).toBe(true);
    }
  });
});
