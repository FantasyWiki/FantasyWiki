import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { useLeagueStore } from "@/stores/league";
import { leagues } from "@/mocks/data/leagues";

// Italia/Europe/Americas League already carry a past `endDate` in the mock
// fixtures (see mocks/data/leagues.ts) — they double as the "ended" cases
// here, the same way they exercise the /leagues Ended Leagues section.
const globalLeague = leagues.find((l) => l.id === "global")!;
const italy = leagues.find((l) => l.id === "italy")!;

describe("league store — active/ended split and selection", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("splits available leagues into active and ended", async () => {
    const store = useLeagueStore();
    await store.fetchLeagues();

    expect(store.activeLeagues.map((l) => l.id)).toEqual(["global"]);
    expect(store.endedLeagues.map((l) => l.id).sort()).toEqual([
      "americas",
      "europe",
      "italy",
    ]);
  });

  it("clears the selection instead of fabricating a placeholder league when none is active", async () => {
    server.use(http.get("*/api/leagues", () => HttpResponse.json([italy])));

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
    store.setCurrentLeague(italy);

    await store.fetchLeagues();

    expect(store.currentLeague?.id).toBe(globalLeague.id);
    expect(JSON.parse(localStorage.getItem("currentLeague")!).id).toBe(
      globalLeague.id
    );
  });
});
