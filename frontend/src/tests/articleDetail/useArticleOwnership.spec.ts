import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO } from "../../../../dto/contractDTO";
import type { ArticleDTO } from "../../../../dto/articleDTO";
import type { TeamDTO } from "../../../../dto/teamDTO";
import { useArticleOwnership } from "@/composables/useArticleOwnership";

// The composable maps the my-team query's states onto an ownership status;
// mock the query with mutable state so each state is reachable
// deterministically (a real query would race MSW responses).
const myTeamMock = vi.hoisted(() => ({
  team: null as { id: string; credits: number } | null,
  isPending: false,
  error: null as Error | null,
}));

vi.mock("@/composables/useMyTeam", async () => {
  const { computed } = await import("vue");
  return {
    useMyTeam: () => ({
      myTeam: computed(() => myTeamMock.team),
      myTeamId: computed(() => myTeamMock.team?.id ?? null),
      isPending: computed(() => myTeamMock.isPending),
      error: computed(() => myTeamMock.error),
      refetch: async () => undefined,
    }),
  };
});

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

interface MyTeamState {
  currentTeam?: TeamDTO | null;
  isTeamLoading?: boolean;
  teamError?: string | null;
}

function setupMyTeam(state: MyTeamState = {}) {
  myTeamMock.team =
    "currentTeam" in state ? (state.currentTeam ?? null) : viewerTeam;
  myTeamMock.isPending = state.isTeamLoading ?? false;
  myTeamMock.error = state.teamError ? new Error(state.teamError) : null;
}

describe("useArticleOwnership", () => {
  it("reports loading while team context is loading and yields no detail", () => {
    setupMyTeam({ currentTeam: null, isTeamLoading: true });
    const { status, detail } = useArticleOwnership(
      ref(article),
      ref(makeContract(otherTeam)),
      ref(9000)
    );
    expect(status.value).toBe("loading");
    expect(detail.value).toBeNull();
  });

  it("reports loading when there is no current team yet", () => {
    setupMyTeam({ currentTeam: null });
    const { status, detail } = useArticleOwnership(
      ref(article),
      ref(makeContract(otherTeam)),
      ref(9000)
    );
    expect(status.value).toBe("loading");
    expect(detail.value).toBeNull();
  });

  it("reports error when team context failed", () => {
    setupMyTeam({ currentTeam: null, teamError: "boom" });
    const { status, detail } = useArticleOwnership(
      ref(article),
      ref(makeContract(otherTeam)),
      ref(9000)
    );
    expect(status.value).toBe("error");
    expect(detail.value).toBeNull();
  });

  it("builds the detail model for a viewer-owned contract when ready", () => {
    setupMyTeam({ currentTeam: viewerTeam });
    const { status, detail } = useArticleOwnership(
      ref(article),
      ref(makeContract(viewerTeam)),
      ref(9000)
    );
    expect(status.value).toBe("ready");
    expect(detail.value?.availability).toBe("owned-by-viewer");
  });

  it("marks an article owned by another team when ready", () => {
    setupMyTeam({ currentTeam: viewerTeam });
    const { detail } = useArticleOwnership(
      ref(article),
      ref(makeContract(otherTeam)),
      ref(9000)
    );
    expect(detail.value?.availability).toBe("owned-by-other");
    expect(detail.value?.ownerTeamName).toBe("Other FC");
  });

  it("builds a free-agent detail model when there is no contract", () => {
    setupMyTeam({ currentTeam: viewerTeam });
    const { detail } = useArticleOwnership(ref(article), ref(null), ref(9000));
    expect(detail.value?.availability).toBe("free-agent");
  });
});
