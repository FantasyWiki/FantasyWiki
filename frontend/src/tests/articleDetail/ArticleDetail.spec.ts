import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { Temporal } from "@js-temporal/polyfill";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import ArticleDetail from "@/components/ArticleDetail.vue";
import { ContractDTO } from "../../../../dto/contractDTO";
import { useLeagueStore } from "@/stores/league";
import type { TeamDTO } from "../../../../dto/teamDTO";
import type { LeagueDTO } from "../../../../dto/leagueDTO";

vi.mock("@/composables/useArticleSummary", () => ({
  useArticleSummary: () => ({
    summary: ref({
      title: "ChatGPT",
      extract: "ChatGPT summary",
      thumbnailUrl: undefined,
    }),
    isLoading: ref(false),
    error: ref(null),
  }),
}));

const viewerTeam: TeamDTO = {
  id: "team-viewer",
  name: "Viewer FC",
  credits: 1200,
  player: { id: "viewer-player", name: "Viewer" },
  points: 0,
};

const otherTeam: TeamDTO = {
  id: "team-other",
  name: "Other FC",
  credits: 1200,
  player: { id: "other-player", name: "Other" },
  points: 0,
};

const league: LeagueDTO = {
  id: "league-1",
  title: "League",
  description: "",
  domain: "en",
  icon: "L",
  startDate: Temporal.Now.instant(),
  endDate: Temporal.Now.instant().add({ hours: 1 }),
  teams: [viewerTeam, otherTeam],
};

function makeContract(team: TeamDTO, purchasePrice = 800): ContractDTO {
  const startDate = Temporal.Now.zonedDateTimeISO("UTC")
    .subtract({ days: 1 })
    .toInstant();
  return new ContractDTO(
    `contract-${team.id}`,
    team,
    { id: "article-1", title: "ChatGPT", domain: "en" },
    startDate,
    Temporal.Duration.from({ days: 7 }),
    purchasePrice
  );
}

interface MountOptions {
  currentTeam?: TeamDTO | null;
  isTeamLoading?: boolean;
  teamError?: string | null;
}

function mountWithStores(contract: ContractDTO, options: MountOptions = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const leagueStore = useLeagueStore();
  leagueStore.currentLeague = league;
  leagueStore.currentTeam = options.currentTeam ?? viewerTeam;
  leagueStore.isTeamLoading = options.isTeamLoading ?? false;
  leagueStore.teamError = options.teamError ?? null;

  return mount(ArticleDetail, {
    props: {
      selectedContract: contract,
      isOpen: true,
    },
    global: {
      plugins: [pinia],
      stubs: {
        IonModal: {
          template: "<div><slot /></div>",
        },
      },
    },
  });
}

describe("ArticleDetail.vue", () => {
  it("shows renew and swap actions for viewer-owned contract", () => {
    const wrapper = mountWithStores(makeContract(viewerTeam), {
      currentTeam: viewerTeam,
    });

    expect(wrapper.text()).toContain("Renew Contract");
    expect(wrapper.text()).toContain("Swap Article");
    expect(wrapper.text()).not.toContain("Buy");
    expect(wrapper.text()).toContain("Availability");
    const wikipediaLink = wrapper.find(".summary-link");
    expect(wikipediaLink.exists()).toBe(true);
    expect(wikipediaLink.attributes("href")).toContain(
      "https://en.wikipedia.org/wiki/ChatGPT"
    );
  });

  it("delays actions while ownership context is loading", () => {
    const wrapper = mountWithStores(makeContract(otherTeam), {
      currentTeam: null,
      isTeamLoading: true,
    });

    expect(wrapper.text()).toContain("Resolving ownership...");
    expect(wrapper.text()).toContain(
      "Actions will appear when your team context is ready."
    );
    expect(wrapper.text()).not.toContain("Buy");
    expect(wrapper.text()).not.toContain("Renew Contract");
    expect(wrapper.text()).not.toContain("Swap Article");
  });

  it("shows ownership-unavailable state when team context fails", () => {
    const wrapper = mountWithStores(makeContract(otherTeam), {
      currentTeam: null,
      teamError: "boom",
    });

    expect(wrapper.text()).toContain("Unable to determine ownership");
    expect(wrapper.text()).toContain("Retry ownership check");
    expect(wrapper.text()).not.toContain("Buy");
    expect(wrapper.text()).not.toContain("Renew Contract");
    expect(wrapper.text()).not.toContain("Swap Article");
  });
});
