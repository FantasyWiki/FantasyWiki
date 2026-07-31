import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { seedCandidates } from "@/services/genieService";

/** Records the search queries the seed actually issued. */
let searchQueries: string[] = [];

beforeEach(() => {
  searchQueries = [];
  // The client caches searches and link sets in localStorage; without this one
  // test's seed answers the next one's.
  localStorage.clear();
});

/**
 * Answers the keyword search and the `linksto:` search differently, so a test
 * can tell which candidates came from which seed.
 */
function interceptSearch(
  byQuery: Record<
    string,
    { key: string; title: string; description?: string }[]
  >
) {
  server.use(
    http.get(
      "https://api.wikimedia.org/core/v1/wikipedia/*/search/page*",
      ({ request }) => {
        const query = new URL(request.url).searchParams.get("q") ?? "";
        searchQueries.push(query);
        const pages = byQuery[query] ?? [];
        return HttpResponse.json({ pages });
      }
    )
  );
}

function interceptLinks(linksByTitle: Record<string, string[]>) {
  server.use(
    http.get("https://*.wikipedia.org/w/api.php", ({ request }) => {
      const title = new URL(request.url).searchParams.get("titles") ?? "";
      return HttpResponse.json({
        query: {
          pages: [
            {
              pageid: 1,
              ns: 0,
              title,
              links: (linksByTitle[title] ?? []).map((t) => ({
                ns: 0,
                title: t,
              })),
            },
          ],
        },
      });
    })
  );
}

describe("seedCandidates", () => {
  it("runs both seeds and merges them, so a misparse cannot lose the answer", async () => {
    interceptSearch({
      "portuguese explorer india": [
        {
          key: "Vasco_da_Gama",
          title: "Vasco da Gama",
          description: "Explorer",
        },
      ],
      "linksto:Portugal linksto:India": [
        { key: "Goa", title: "Goa", description: "State in India" },
      ],
    });
    interceptLinks({ Portugal: [], India: [] });

    const candidates = await seedCandidates("en", {
      keywords: "portuguese explorer india",
      anchors: ["Portugal", "India"],
    });

    const titles = candidates.map((c) => c.title);
    // Routing to the anchor seed alone would have dropped Vasco da Gama and
    // left the player looking at a Genie that simply failed.
    expect(titles).toContain("Vasco da Gama");
    expect(titles).toContain("Goa");
  });

  it("underscores multi-word anchors, which `linksto:` silently mis-parses", async () => {
    interceptSearch({});
    interceptLinks({ "Formula One": [] });

    await seedCandidates("en", {
      keywords: "races",
      anchors: ["Formula One"],
    });

    // `linksto:Formula One` parses as `linksto:Formula` plus the free text
    // "One" and returns unrelated articles.
    expect(searchQueries).toContain("linksto:Formula_One");
    expect(searchQueries).not.toContain("linksto:Formula One");
  });

  it("ranks a mutual link above a one-way one", async () => {
    interceptSearch({
      relation: [],
      "linksto:OpenAI linksto:Portugal": [
        { key: "Google", title: "Google", description: "Tech company" },
        {
          key: "Artificial_intelligence_arms_race",
          title: "Artificial intelligence arms race",
          description: "Competition over AI",
        },
      ],
    });
    // Only the arms-race article is linked back by both anchors, so only it
    // holds a mutual link with them.
    interceptLinks({
      OpenAI: ["Artificial intelligence arms race"],
      Portugal: ["Artificial intelligence arms race"],
    });

    const candidates = await seedCandidates("en", {
      keywords: "relation",
      anchors: ["OpenAI", "Portugal"],
    });

    expect(candidates[0].title).toBe("Artificial intelligence arms race");
    expect(candidates[0].mutualAnchors).toBe(2);
    expect(candidates[1].mutualAnchors).toBe(0);
  });

  it("keeps the cheap boilerplate the anchors both link out to", async () => {
    interceptSearch({ relation: [] });
    interceptLinks({
      OpenAI: ["ArXiv (identifier)", "Microsoft"],
      Portugal: ["ArXiv (identifier)", "Spain"],
    });

    const candidates = await seedCandidates("en", {
      keywords: "relation",
      anchors: ["OpenAI", "Portugal"],
    });

    // Low-traffic articles are not noise: they cost almost nothing and still
    // carry chemistry, so they are ranked rather than filtered out.
    //
    // Cased as Wikipedia has it, not folded: the fold is a match key, and a
    // lowercased title is not an article — pageviews would 404, which is
    // swallowed into a zero price and blank stats with no error anywhere.
    expect(candidates.map((c) => c.canonicalTitle)).toContain(
      "ArXiv_(identifier)"
    );
    const arxiv = candidates.find((c) => c.title === "ArXiv (identifier)");
    expect(arxiv).toBeDefined();
  });

  it("assigns the small integer ids the model answers in", async () => {
    interceptSearch({
      bitcoin: [
        { key: "Bitcoin", title: "Bitcoin", description: "Cryptocurrency" },
        { key: "Blockchain", title: "Blockchain", description: "Ledger" },
      ],
    });

    const candidates = await seedCandidates("en", {
      keywords: "bitcoin",
      anchors: [],
    });

    expect(candidates.map((c) => c.id)).toEqual([0, 1]);
  });
});
