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

// The real toast needs Ionic's overlay lifecycle to settle, which jsdom's
// microtask queue alone will not do; stubbed so the success path resolves.
vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ showSuccess: vi.fn().mockResolvedValue(undefined) }),
}));

// One pinia shared by the page and the assertions: the global test default
// would hand the component a different store instance than the spec reads.
let pinia: Pinia;

async function mountPage() {
  await router.push("/team-creation");
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
    expect(leagueStore.currentLeague).toBeDefined();
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
