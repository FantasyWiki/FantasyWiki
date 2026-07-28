import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import router from "@/router/index";
import { useAppStore } from "@/stores/app";
import { leagues } from "@/mocks/data/leagues";

/**
 * A team is one-shot per league — `teams` is `UNIQUE (playerId, leagueId)` — so
 * hand-typing a team-creation path used to land on a form whose only possible
 * outcome was a rejected submit. These are navigations, not mounts: the guard
 * decides before the page exists.
 *
 * Its own file on purpose. The router and the store the guard reads are module
 * singletons, so in a spec that also mounts pages an earlier test's league list
 * survives into the guard and decides the outcome instead of the mock below.
 */
function mockMyLeagues(ids: string[]) {
  server.use(
    http.get("*/api/leagues", () =>
      HttpResponse.json(leagues.filter((lg) => ids.includes(lg.id)))
    )
  );
}

async function typePath(path: string) {
  await router.push(path);
  return router.currentRoute.value.path;
}

describe("team creation route guard", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    useAppStore().setUserFromData({
      sub: "player-1",
      email: "player@example.com",
      name: "Player One",
      picture: "",
    });
  });

  it("keeps signup away from a player who already plays", async () => {
    mockMyLeagues(["global"]);

    expect(await typePath("/team-creation")).toBe("/dashboard");
  });

  it("lets a brand-new player reach signup", async () => {
    mockMyLeagues([]);

    expect(await typePath("/team-creation")).toBe("/team-creation");
  });

  it("keeps a league the player is already in away from them", async () => {
    mockMyLeagues(["global", "italy"]);

    expect(await typePath("/leagues/italy/team-creation")).toBe("/dashboard");
  });

  it("lets a player into a league they have no team in", async () => {
    mockMyLeagues(["global"]);

    expect(await typePath("/leagues/italy/team-creation")).toBe(
      "/leagues/italy/team-creation"
    );
  });

  it("lets the player through when the league list cannot be fetched", async () => {
    // Fail open: the backend still refuses a duplicate, whereas redirecting on
    // a failed fetch would lock a genuinely new player out of signup.
    server.use(http.get("*/api/leagues", () => HttpResponse.error()));

    expect(await typePath("/team-creation")).toBe("/team-creation");
  });
});
