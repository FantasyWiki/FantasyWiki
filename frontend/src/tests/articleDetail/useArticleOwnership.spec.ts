import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO } from "../../../../dto/contractDTO";
import type { TeamDTO } from "../../../../dto/teamDTO";
import { useLeagueStore } from "@/stores/league";
import { useArticleOwnership } from "@/composables/useArticleOwnership";

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

function makeContract(team: TeamDTO): ContractDTO {
  const startDate = Temporal.Now.zonedDateTimeISO("UTC")
    .subtract({ days: 1 })
    .toInstant();
  return new ContractDTO(
    `contract-${team.id}`,
    team,
    { id: "article-1", title: "ChatGPT", domain: "en" },
    startDate,
    Temporal.Duration.from({ days: 7 }),
    800
  );
}

interface StoreState {
  currentTeam?: TeamDTO | null;
  isTeamLoading?: boolean;
  teamError?: string | null;
}

function setupStore(state: StoreState = {}) {
  setActivePinia(createPinia());
  const store = useLeagueStore();
  store.currentTeam =
    "currentTeam" in state ? (state.currentTeam ?? null) : viewerTeam;
  store.isTeamLoading = state.isTeamLoading ?? false;
  store.teamError = state.teamError ?? null;
  return store;
}

describe("useArticleOwnership", () => {
  it("reports loading while team context is loading and yields no detail", () => {
    setupStore({ currentTeam: null, isTeamLoading: true });
    const { status, detail } = useArticleOwnership(
      ref(makeContract(otherTeam))
    );
    expect(status.value).toBe("loading");
    expect(detail.value).toBeNull();
  });

  it("reports loading when there is no current team yet", () => {
    setupStore({ currentTeam: null });
    const { status, detail } = useArticleOwnership(
      ref(makeContract(otherTeam))
    );
    expect(status.value).toBe("loading");
    expect(detail.value).toBeNull();
  });

  it("reports error when team context failed", () => {
    setupStore({ currentTeam: null, teamError: "boom" });
    const { status, detail } = useArticleOwnership(
      ref(makeContract(otherTeam))
    );
    expect(status.value).toBe("error");
    expect(detail.value).toBeNull();
  });

  it("builds the detail model for a viewer-owned contract when ready", () => {
    setupStore({ currentTeam: viewerTeam });
    const { status, detail } = useArticleOwnership(
      ref(makeContract(viewerTeam))
    );
    expect(status.value).toBe("ready");
    expect(detail.value?.availability).toBe("owned-by-viewer");
    expect(detail.value?.showBuy).toBe(false);
    expect(detail.value?.showContractActions).toBe(true);
  });

  it("marks an article owned by another team as buy-disabled when ready", () => {
    setupStore({ currentTeam: viewerTeam });
    const { detail } = useArticleOwnership(ref(makeContract(otherTeam)));
    expect(detail.value?.availability).toBe("owned-by-other");
    expect(detail.value?.buyDisabled).toBe(true);
    expect(detail.value?.ownerTeamName).toBe("Other FC");
  });
});
