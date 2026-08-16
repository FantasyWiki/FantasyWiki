import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { useLeagueStore } from "@/stores/league";
import { leagues } from "@/mocks/data/leagues";

// Americas League is the one fixture with a past `endDate` (see
// mocks/data/leagues.ts) — it is the "ended" case here, the same way it is the
// only entry in the /leagues Ended Leagues section. The other three run on, so
// that mock mode can reach the lifecycle controls at all.
const globalLeague = leagues.find((l) => l.id === "global")!;
const americas = leagues.find((l) => l.id === "americas")!;

describe("league store — active/ended split and selection", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("splits available leagues into active and ended", async () => {
    const store = useLeagueStore();
    await store.fetchLeagues();

    expect(store.activeLeagues.map((l) => l.id)).toEqual([
      "global",
      "italy",
      "europe",
    ]);
    expect(store.endedLeagues.map((l) => l.id)).toEqual(["americas"]);
  });

  it("clears the selection instead of fabricating a placeholder league when none is active", async () => {
    server.use(http.get("*/api/leagues", () => HttpResponse.json([americas])));

    const store = useLeagueStore();
    await store.fetchLeagues();

    expect(store.currentLeague).toBeUndefined();
    // The honest fallback lives in `currentLeagueName`, not in a sentinel
    // `LeagueDTO` the type would otherwise let through as a real league.
    expect(store.currentLeagueName).toBe("No League Selected");
    expect(store.currentLeagueId).toBeNull();
  });

  it("reassigns away from a selection that has gone inactive since it was made", async () => {
    const store = useLeagueStore();
    // A stale selection: pointing at a league the next fetch reports as ended.
    store.setCurrentLeague(americas);

    await store.fetchLeagues();

    expect(store.currentLeague?.id).toBe(globalLeague.id);
    expect(JSON.parse(localStorage.getItem("currentLeague")!).id).toBe(
      globalLeague.id
    );
  });
});
