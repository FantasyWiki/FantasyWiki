import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO } from "../../../../dto/contractDTO";
import type { ArticleDTO } from "../../../../dto/articleDTO";
import type { TeamDTO } from "../../../../dto/teamDTO";
import { useLeagueStore } from "@/stores/league";
import { useArticleOwnership } from "@/composables/useArticleOwnership";

const viewerTeam: TeamDTO = {
  id: "team-viewer",
  name: "Viewer FC",
  credits: 1200,
  player: { id: "viewer-player", name: "Viewer" },
};

const otherTeam: TeamDTO = {
  id: "team-other",
  name: "Other FC",
  credits: 1200,
  player: { id: "other-player", name: "Other" },
};

const article: ArticleDTO = { id: "article-1", title: "ChatGPT", domain: "en" };

function makeContract(team: TeamDTO): ContractDTO {
  const startDate = Temporal.Now.zonedDateTimeISO("UTC")
    .subtract({ days: 1 })
    .toInstant();
  return new ContractDTO(
    `contract-${team.id}`,
    team,
    article,
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
      ref(article),
      ref(makeContract(otherTeam))
    );
    expect(status.value).toBe("loading");
    expect(detail.value).toBeNull();
  });

  it("reports loading when there is no current team yet", () => {
    setupStore({ currentTeam: null });
    const { status, detail } = useArticleOwnership(
      ref(article),
      ref(makeContract(otherTeam))
    );
    expect(status.value).toBe("loading");
    expect(detail.value).toBeNull();
  });

  it("reports error when team context failed", () => {
    setupStore({ currentTeam: null, teamError: "boom" });
    const { status, detail } = useArticleOwnership(
      ref(article),
      ref(makeContract(otherTeam))
    );
    expect(status.value).toBe("error");
    expect(detail.value).toBeNull();
  });

  it("builds the detail model for a viewer-owned contract when ready", () => {
    setupStore({ currentTeam: viewerTeam });
    const { status, detail } = useArticleOwnership(
      ref(article),
      ref(makeContract(viewerTeam))
    );
    expect(status.value).toBe("ready");
    expect(detail.value?.availability).toBe("owned-by-viewer");
  });

  it("marks an article owned by another team when ready", () => {
    setupStore({ currentTeam: viewerTeam });
    const { detail } = useArticleOwnership(
      ref(article),
      ref(makeContract(otherTeam))
    );
    expect(detail.value?.availability).toBe("owned-by-other");
    expect(detail.value?.ownerTeamName).toBe("Other FC");
  });

  it("builds a free-agent detail model when there is no contract", () => {
    setupStore({ currentTeam: viewerTeam });
    const { detail } = useArticleOwnership(ref(article), ref(null));
    expect(detail.value?.availability).toBe("free-agent");
  });
});
