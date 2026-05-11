import { describe, expect, it } from "vitest";
import { articles } from "@/mocks/data/articles";

describe("mocks/data/articles", () => {
  it("stores only persisted article fields with canonical app domains", () => {
    expect(articles.length).toBeGreaterThan(0);

    for (const article of articles) {
      expect(article.id).toBeTruthy();
      expect(article.title).toBeTruthy();
      expect(["en", "it"]).toContain(article.domain);
    }
  });
});
