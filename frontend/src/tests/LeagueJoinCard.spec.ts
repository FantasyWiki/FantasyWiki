import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { Temporal } from "@js-temporal/polyfill";
import router from "@/router/index";
import LeagueJoinCard from "@/components/league/LeagueJoinCard.vue";
import { LeagueVisibility } from "../../../model/enums";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import i18n from "@/i18n";

function league(overrides: Partial<LeagueDTO> = {}): LeagueDTO {
  return {
    id: "some-league",
    title: "Some League",
    icon: "🏆",
    domain: "en",
    languageScale: 1.0,
    startDate: Temporal.Now.instant().subtract({ hours: 24 }),
    endDate: Temporal.Now.instant().add({ hours: 24 * 30 }),
    visibility: LeagueVisibility.PUBLIC,
    teamCount: 4,
    closedAt: null,
    ...overrides,
  };
}

function mountCard(
  props: Partial<InstanceType<typeof LeagueJoinCard>["$props"]> = {}
) {
  return mount(LeagueJoinCard, {
    props: {
      league: league(),
      myTeamId: null,
      isPending: false,
      ...props,
    },
    global: { plugins: [router, i18n] },
  });
}

describe("LeagueJoinCard", () => {
  it("sends a public league straight to the naming form", async () => {
    const card = mountCard();

    expect(card.find("ion-button").attributes("routerlink")).toBe(
      "/leagues/some-league/team-creation"
    );
  });

  it("sends a private league to the code page instead", async () => {
    // The bug this component exists to avoid: a private league's page is
    // readable by anyone, so one shared "join" button would march a
    // non-member into a form whose submit can only 403.
    const card = mountCard({
      league: league({ visibility: LeagueVisibility.PRIVATE }),
    });

    expect(card.find("ion-button").attributes("routerlink")).toBe(
      "/leagues/join"
    );
  });

  it("offers nothing to a player who already plays the league", async () => {
    const card = mountCard({ myTeamId: "team-1" });

    expect(card.find("ion-button").exists()).toBe(false);
  });

  it("stays away while the team lookup is still in flight", async () => {
    // Otherwise it flashes on every load of the player's own league page.
    const card = mountCard({ isPending: true });

    expect(card.find("ion-button").exists()).toBe(false);
  });

  it("offers no way into a league whose season has ended", async () => {
    const card = mountCard({
      league: league({
        endDate: Temporal.Now.instant().subtract({ hours: 24 }),
      }),
    });

    expect(card.find("ion-button").exists()).toBe(false);
  });

  it("offers no way into a league the admin closed early", async () => {
    // The other half of `isLeagueInactive` — a date check alone would miss it.
    const card = mountCard({
      league: league({ closedAt: Temporal.Now.instant() }),
    });

    expect(card.find("ion-button").exists()).toBe(false);
  });
});
