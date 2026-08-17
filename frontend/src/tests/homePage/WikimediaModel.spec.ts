import { describe, expect, it } from "vitest";
import { normalizeTopReadEntries } from "../../../../external-apis/wikimedia/wikimedia";

describe("model/wikimedia", () => {
  it("filters non-content entries and reassigns filtered rank", () => {
    const entries = normalizeTopReadEntries(
      [
        { article: "Main_Page", views: 5000, rank: 1 },
        { article: "Special:Search", views: 4000, rank: 2 },
        { article: "ChatGPT", views: 3000, rank: 3 },
        { article: "Portal:Current_events", views: 2000, rank: 4 },
        { article: "Pope_Francis", views: 1000, rank: 5 },
      ],
      5
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      canonicalTitle: "ChatGPT",
      displayTitle: "ChatGPT",
      sourceRank: 3,
      filteredRank: 1,
      dailyViews: 3000,
    });
    expect(entries[1]).toMatchObject({
      canonicalTitle: "Pope_Francis",
      displayTitle: "Pope Francis",
      sourceRank: 5,
      filteredRank: 2,
      dailyViews: 1000,
    });
  });

  it("filters an edition's own project pages when given its namespaces", () => {
    // The English names above catch nothing on it.wikipedia, which is why the
    // edition's own siteinfo has to supply them (ADR 0002). These titles and the
    // 201,977 views are the real 2026-08-15 it.wikipedia top-read payload:
    // `Pagina_principale` is genuinely its rank-1 entry, so without this the most
    // prominent thing in an Italian market is the main page.
    const entries = normalizeTopReadEntries(
      [
        { article: "Pagina_principale", views: 201977, rank: 1 },
        { article: "Speciale:Ricerca", views: 50000, rank: 2 },
        { article: "Categoria:Film", views: 9000, rank: 3 },
        { article: "File:Flag_of_Italy.svg", views: 8000, rank: 4 },
        { article: "Ferruccio_Lamborghini", views: 7000, rank: 5 },
      ],
      5,
      "it",
      {
        nonArticlePrefixes: [
          "Speciale:",
          "Categoria:",
          "File:",
          "Discussione:",
        ],
        mainPageTitle: "Pagina_principale",
      }
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      canonicalTitle: "Ferruccio_Lamborghini",
      filteredRank: 1,
      articleUrl: "https://it.wikipedia.org/wiki/Ferruccio_Lamborghini",
    });
  });

  it("keeps a real article whose title merely starts with a word like a prefix", () => {
    // `Filesystem` is not in the `File:` namespace. Matching on the colon is what
    // keeps the filter from eating articles.
    const entries = normalizeTopReadEntries(
      [{ article: "Filesystem", views: 100, rank: 1 }],
      5,
      "en",
      { nonArticlePrefixes: ["File:"], mainPageTitle: "Main_Page" }
    );

    expect(entries.map((e) => e.canonicalTitle)).toEqual(["Filesystem"]);
  });
});
