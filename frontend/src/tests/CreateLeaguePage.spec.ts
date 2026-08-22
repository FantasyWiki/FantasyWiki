import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import router from "@/router/index";
import CreateLeaguePage from "@/views/CreateLeaguePage.vue";
import { useAppStore } from "@/stores/app";
import i18n from "@/i18n";
import { LeagueVisibility } from "../../../model/enums";

function makePlugins() {
  const pinia = createPinia();
  setActivePinia(pinia);

  useAppStore().setUserFromData({
    sub: "player-1",
    email: "player@example.com",
    name: "Player One",
    picture: "",
    features: { articleGenie: false },
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugins: any[] = [
    pinia,
    [VueQueryPlugin, { queryClient }],
    router,
    i18n,
  ];
  return plugins;
}

let wrapper: VueWrapper | null = null;

async function mountPage() {
  wrapper = mount(CreateLeaguePage, { global: { plugins: makePlugins() } });
  await flushPromises();
  return wrapper;
}

/**
 * Fill the two free-text fields and submit. Driven through the model rather
 * than the inputs: `ion-input` is a custom element here, so `setValue` has no
 * real input to write to. Everything else on the form already has a usable
 * default, which is the point.
 */
async function createLeague(page: VueWrapper, visibility?: LeagueVisibility) {
  const vm = page.vm as unknown as {
    name: string;
    teamName: string;
    visibility: LeagueVisibility;
  };
  vm.name = "Sunday Scholars";
  vm.teamName = "Wiki Wanderers";
  if (visibility) vm.visibility = visibility;
  await page.vm.$nextTick();

  await page.find("form").trigger("submit");
  await flushPromises();
}

beforeEach(async () => {
  await router.push("/leagues/new");
  await router.isReady();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

describe("CreateLeaguePage", () => {
  it("asks for the founding team on the same form as the league", async () => {
    // The league and this team are written together — a second screen would be
    // a second chance to end up with a league nobody is in.
    const page = await mountPage();

    expect(page.find("#league-name").exists()).toBe(true);
    expect(page.find("#team-name").exists()).toBe(true);
  });

  it("shows the invitation code once a private league exists", async () => {
    const page = await mountPage();

    await createLeague(page);

    expect(page.find(".success").exists()).toBe(true);
    expect(page.find(".code").text()).toBe("ZK7QW");
  });

  it("shows no code for a public league, which has none to show", async () => {
    const page = await mountPage();

    await createLeague(page, LeagueVisibility.PUBLIC);

    expect(page.find(".success").exists()).toBe(true);
    expect(page.find(".code").exists()).toBe(false);
  });
});
