import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { Temporal } from "@js-temporal/polyfill";
import { createPinia, setActivePinia } from "pinia";
import ArticleDetail from "@/components/ArticleDetail.vue";
import { ContractDTO } from "../../../../dto/contractDTO";
import { useAppStore } from "@/stores/app";
import { useLeagueStore } from "@/stores/league";
import type { TeamDTO } from "../../../../dto/teamDTO";
import type { LeagueDTO } from "../../../../dto/leagueDTO";

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

function mountWithStores(contract: ContractDTO) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const appStore = useAppStore();
  appStore.isAuthenticated = true;
  appStore.currentUser = {
    sub: "viewer-player",
    email: "viewer@test.com",
    name: "Viewer",
    picture: "",
  };

  const leagueStore = useLeagueStore();
  leagueStore.currentLeague = league;

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
    const wrapper = mountWithStores(makeContract(viewerTeam));

    expect(wrapper.text()).toContain("Renew Contract");
    expect(wrapper.text()).toContain("Swap Article");
    expect(wrapper.text()).not.toContain("Buy");
    expect(wrapper.text()).toContain("Availability");
  });

  it("shows disabled buy and hides renew/swap when owned by another team", () => {
    const wrapper = mountWithStores(makeContract(otherTeam));

    expect(wrapper.text()).toContain("Buy");
    expect(wrapper.text()).toContain("Already Owned");
    expect(wrapper.text()).toContain("Other FC");
    expect(wrapper.text()).not.toContain("Renew Contract");
    expect(wrapper.text()).not.toContain("Swap Article");
  });
});
