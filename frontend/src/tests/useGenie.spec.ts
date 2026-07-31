import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { createPinia, setActivePinia } from "pinia";
import { Temporal } from "@js-temporal/polyfill";
import { server } from "@/mocks/server";
import { bucketFor, useGenie } from "@/composables/useGenie";
import { useLeagueStore } from "@/stores/league";
import type { LeagueDTO } from "../../../dto/leagueDTO";

const league = {
  id: "global",
  title: "Global",
  icon: "🌍",
  domain: "en",
  startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
  endDate: Temporal.Instant.from("2026-12-31T00:00:00Z"),
} as unknown as LeagueDTO;

beforeEach(() => {
  setActivePinia(createPinia());
  useLeagueStore().currentLeague = league;
  // The Wikimedia client caches searches and link sets in localStorage, so one
  // test's seed would otherwise answer the next one's.
  localStorage.clear();
  // The session deliberately lives at module scope so it survives the panel
  // closing — which means it also survives from one test to the next.
  useGenie().reset();
});

/** Never narrows and never says done, so only the turn cap can end the hunt. */
function neverNarrows() {
  return [
    http.get("https://api.wikimedia.org/core/v1/wikipedia/*/search/page*", () =>
      HttpResponse.json({
        pages: Array.from({ length: 12 }, (_, i) => ({
          key: `Article_${i}`,
          title: `Article ${i}`,
          description: "Something",
        })),
      })
    ),
    http.post("*/api/me/genie-turns", async ({ request }) => {
      const { candidates } = (await request.json()) as {
        candidates: { id: number }[];
      };
      return HttpResponse.json({
        utterance: "Mhh — is it a person?",
        question: "Is it a person?",
        keep: candidates.map((c) => c.id),
        options: ["Yes", "No"],
        kind: "filter",
        done: false,
      });
    }),
  ];
}

/**
 * A replayable stand-in for `Math.random`. A constant would do for determinism
 * but risks wedging anything that draws until a value differs; this varies and
 * still repeats exactly for a given seed.
 */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** Waits for the loop to settle on a state that is not mid-flight. */
async function settle(status: { value: string }) {
  await vi.waitFor(
    () => {
      expect(["asking", "results", "asleep", "idle"]).toContain(status.value);
    },
    { timeout: 3000 }
  );
}

describe("bucketFor", () => {
  it("describes the set in words, never in numbers", () => {
    // A Genie that says "31 articles left" is not a Genie — the count reads as
    // debug output and breaks character.
    expect(bucketFor(40)).toBe("vast");
    expect(bucketFor(20)).toBe("many");
    expect(bucketFor(12)).toBe("a dozen or so");
    expect(bucketFor(7)).toBe("a handful");
    expect(bucketFor(2)).toBe("almost there");

    for (const count of [0, 1, 5, 9, 16, 31, 100]) {
      expect(bucketFor(count)).not.toMatch(/\d/);
    }
  });
});

describe("useGenie", () => {
  it("seeds, asks a question and offers taps to answer it", async () => {
    // Enough candidates that the loop has something to narrow: with only a
    // handful seeded it is right to skip straight to results.
    server.use(
      http.get(
        "https://api.wikimedia.org/core/v1/wikipedia/*/search/page*",
        () =>
          HttpResponse.json({
            pages: Array.from({ length: 12 }, (_, i) => ({
              key: `Mathematician_${i}`,
              title: `Mathematician ${i}`,
              description: "American mathematician",
            })),
          })
      ),
      // …and a turn that narrows gently, so the loop stays in the question
      // phase instead of dropping straight to five.
      http.post("*/api/me/genie-turns", async ({ request }) => {
        const { candidates } = (await request.json()) as {
          candidates: { id: number }[];
        };
        return HttpResponse.json({
          utterance: "Mhh — was she a mathematician?",
          question: "Was she a mathematician?",
          keep: candidates.map((c) => c.id),
          options: ["Yes", "No"],
          kind: "filter",
          done: false,
        });
      })
    );

    const genie = useGenie();
    await genie.start("the female mathematician who worked at NASA");
    await settle(genie.status);

    expect(genie.status.value).toBe("asking");
    expect(genie.utterance.value).toBeTruthy();
    expect(genie.options.value.length).toBeGreaterThan(0);
  });

  it("reaches priced results the market table can render", async () => {
    const genie = useGenie();
    await genie.start("bitcoin");
    await settle(genie.status);

    // The mock narrows to three and then sets done, so a couple of taps get
    // there regardless of which branch ends the loop.
    for (let i = 0; i < 3 && genie.status.value === "asking"; i += 1) {
      await genie.answer(genie.options.value[0]);
      await settle(genie.status);
    }

    expect(genie.status.value).toBe("results");
    expect(genie.results.value.length).toBeGreaterThan(0);
    for (const article of genie.results.value) {
      expect(article.title).toBeTruthy();
      expect(typeof article.price).toBe("number");
    }
  });

  it("writes only the bare question into history, never the flavour", async () => {
    let lastHistory: { question: string; answer: string }[] = [];
    server.use(
      http.get(
        "https://api.wikimedia.org/core/v1/wikipedia/*/search/page*",
        () =>
          HttpResponse.json({
            pages: Array.from({ length: 12 }, (_, i) => ({
              key: `Article_${i}`,
              title: `Article ${i}`,
              description: "Something",
            })),
          })
      ),
      http.post("*/api/me/genie-turns", async ({ request }) => {
        const body = (await request.json()) as {
          candidates: { id: number }[];
          history: { question: string; answer: string }[];
        };
        lastHistory = body.history;
        return HttpResponse.json({
          utterance: "Mhh, how curious — is it a person?",
          question: "Is it a person?",
          keep: body.candidates.map((c) => c.id),
          options: ["Yes", "No"],
          kind: "filter",
          done: false,
        });
      })
    );

    const genie = useGenie();
    await genie.start("something");
    await settle(genie.status);
    await genie.answer("Yes");
    await settle(genie.status);

    expect(lastHistory).toEqual([
      { question: "Is it a person?", answer: "Yes" },
    ]);
  });

  it("keeps the panel up to offer another five when the cap is what stopped it", async () => {
    server.use(...neverNarrows());

    const genie = useGenie();
    await genie.start("something");
    await settle(genie.status);

    for (let i = 0; i < 12 && genie.status.value === "asking"; i += 1) {
      await genie.answer("Yes");
      await settle(genie.status);
    }

    expect(genie.status.value).toBe("results");
    // Stopping here was the cap's doing rather than the Genie's, so the finish
    // screen offers another five questions alongside its OK.
    expect(genie.canExtend.value).toBe(true);
  });

  it("survives being dismissed, so a stray tap costs nothing", async () => {
    server.use(
      http.get(
        "https://api.wikimedia.org/core/v1/wikipedia/*/search/page*",
        () =>
          HttpResponse.json({
            pages: Array.from({ length: 12 }, (_, i) => ({
              key: `Article_${i}`,
              title: `Article ${i}`,
              description: "Something",
            })),
          })
      ),
      http.post("*/api/me/genie-turns", async ({ request }) => {
        const { candidates } = (await request.json()) as {
          candidates: { id: number }[];
        };
        return HttpResponse.json({
          utterance: "Mhh — is it a person?",
          question: "Is it a person?",
          keep: candidates.map((c) => c.id),
          options: ["Yes", "No"],
          kind: "filter",
          done: false,
        });
      })
    );

    const genie = useGenie();
    await genie.start("something");
    await settle(genie.status);
    expect(genie.status.value).toBe("asking");

    // The panel is dismissed and opened again — a fresh composable call, and on
    // a fresh mount the component would get fresh local state.
    const reopened = useGenie();
    reopened.resumeOrReset();

    expect(reopened.status.value).toBe("asking");
    expect(reopened.utterance.value).toBe("Mhh — is it a person?");
    expect(reopened.options.value).toEqual(["Yes", "No"]);
  });

  it("starts over once the session has gone cold", async () => {
    const genie = useGenie();
    await genie.start("bitcoin");
    await settle(genie.status);
    expect(genie.status.value).not.toBe("idle");

    // Eleven minutes later: they are looking for something else by now.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60 * 1000);
    genie.resumeOrReset();

    expect(genie.status.value).toBe("idle");
    vi.restoreAllMocks();
  });

  it("does not resume an asleep session onto a screen with nothing to do", async () => {
    server.use(
      http.post("*/api/me/genie-seeds", () =>
        HttpResponse.json({ error: "GENIE_ASLEEP" }, { status: 503 })
      )
    );

    const genie = useGenie();
    await genie.start("anything");
    await settle(genie.status);
    expect(genie.status.value).toBe("asleep");

    genie.resumeOrReset();

    // Reopening onto the asleep line, with no way forward, is worse than
    // starting over.
    expect(genie.status.value).toBe("idle");
  });

  it("changes pose every question and never twice in a row", async () => {
    // Runs to the turn cap, so every pose in the rotation gets on screen.
    server.use(...neverNarrows());

    const genie = useGenie();
    await genie.start("something");
    await settle(genie.status);

    const seen: string[] = [];
    for (let i = 0; i < 12 && genie.status.value === "asking"; i += 1) {
      seen.push(genie.pose.value);
      await genie.answer("Yes");
      await settle(genie.status);
    }

    expect(seen.length).toBeGreaterThan(6);
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]).not.toBe(seen[i - 1]);
    }
    // The whole set is used rather than a couple of poses alternating: the
    // rotation is dealt in passes, each spending every pose once.
    expect(new Set(seen).size).toBe(6);
    // …and the busy pose is never one of them, or the figure would not change
    // across the flash between one question and the next.
    expect(seen).not.toContain("thinking");

    // Finishing always looks the same, whichever question ended the hunt.
    expect(genie.status.value).toBe("results");
    expect(genie.pose.value).toBe("celebrating");
  });

  it("deals a fresh running order to each hunt", async () => {
    server.use(...neverNarrows());

    const genie = useGenie();
    const runs: string[][] = [];

    // The order is drawn inside `start`, so the seed has to be in place for it.
    for (const seed of [1, 7]) {
      vi.spyOn(Math, "random").mockImplementation(seededRandom(seed));

      await genie.start("something");
      await settle(genie.status);

      const seen: string[] = [];
      for (let i = 0; i < 12 && genie.status.value === "asking"; i += 1) {
        seen.push(genie.pose.value);
        await genie.answer("Yes");
        await settle(genie.status);
      }
      runs.push(seen);
      vi.restoreAllMocks();
    }

    // Two hunts, same questions, different faces asking them — the third
    // question is not forever the reading pose.
    expect(runs[0]).not.toEqual(runs[1]);
    // …and each hunt still holds the guarantee that matters on screen.
    for (const run of runs) {
      for (let i = 1; i < run.length; i += 1) {
        expect(run[i]).not.toBe(run[i - 1]);
      }
    }
  });

  it("falls asleep when the model is unavailable", async () => {
    server.use(
      http.post("*/api/me/genie-seeds", () =>
        HttpResponse.json({ error: "GENIE_ASLEEP" }, { status: 503 })
      )
    );

    const genie = useGenie();
    await genie.start("anything at all");
    await settle(genie.status);

    // Quota, transport and an unparseable reply all land here: the panel
    // dismisses to the ordinary search bar, and buying is unaffected.
    expect(genie.status.value).toBe("asleep");
    expect(genie.options.value).toEqual([]);
  });

  it("falls asleep rather than showing an empty hunt", async () => {
    server.use(
      http.get(
        "https://api.wikimedia.org/core/v1/wikipedia/*/search/page*",
        () => HttpResponse.json({ pages: [] })
      )
    );

    const genie = useGenie();
    await genie.start("a query that finds nothing");
    await settle(genie.status);

    expect(genie.status.value).toBe("asleep");
  });
});
