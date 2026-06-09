import { describe, it, expect } from "vitest";
import {
  CHEMISTRY_LINKS,
  ChemistryLevel,
  createChemistryLinks,
  validateChemistryLinks,
  calculateChemistry,
  computeChemistryLinks,
} from "../../../../dto/formationDTO";
import { ContractDTO } from "../../../../dto/contractDTO";

function contractWith(title: string): ContractDTO {
  return ContractDTO.fromRaw({
    id: `c-${title}`,
    team: {
      id: "t",
      name: "T",
      credits: 0,
      player: { id: "p", name: "P" },
      points: 0,
    },
    article: { id: `a-${title}`, title, domain: "en" },
    startDate: "2026-01-01T00:00:00Z",
    duration: "P7D",
    purchasePrice: 0,
  });
}

describe("chemistry link helpers", () => {
  describe("calculateChemistry", () => {
    it("returns EMPTY if either article is missing", () => {
      expect(calculateChemistry(null, [], "Albert Einstein", [])).toBe(
        ChemistryLevel.EMPTY
      );
      expect(calculateChemistry("Isaac Newton", [], undefined, [])).toBe(
        ChemistryLevel.EMPTY
      );
      expect(calculateChemistry("", [], "Albert Einstein", [])).toBe(
        ChemistryLevel.EMPTY
      );
    });

    it("returns EXCELLENT if both articles link to each other", () => {
      const a1 = "Albert Einstein";
      const links1 = ["Physics", "Isaac Newton", "Switzerland"];
      const a2 = "Isaac Newton";
      const links2 = ["Calculus", "Albert Einstein", "Gravity"];

      expect(calculateChemistry(a1, links1, a2, links2)).toBe(
        ChemistryLevel.EXCELLENT
      );
    });

    it("returns GOOD if only one article links to the other", () => {
      const a1 = "Albert Einstein";
      const a2 = "Isaac Newton";

      // a1 links to a2, but a2 does not link to a1
      expect(calculateChemistry(a1, ["Isaac Newton"], a2, [])).toBe(
        ChemistryLevel.GOOD
      );

      // a2 links to a1, but a1 does not link to a2
      expect(calculateChemistry(a1, [], a2, ["Albert Einstein"])).toBe(
        ChemistryLevel.GOOD
      );
    });

    it("returns WEAK if neither article links to the other", () => {
      expect(
        calculateChemistry("Albert Einstein", ["Physics"], "Isaac Newton", [
          "Calculus",
        ])
      ).toBe(ChemistryLevel.WEAK);
    });
  });

  it("creates the schema link pairs with default empty level", () => {
    const links = createChemistryLinks("4-3-3");
    const expectedPairs = CHEMISTRY_LINKS["4-3-3"].map(
      ([from, to]) => `${from}-${to}`
    );
    const actualPairs = links.map((link) => `${link.from}-${link.to}`);

    expect(links).toHaveLength(expectedPairs.length);
    expect(actualPairs.sort()).toEqual(expectedPairs.sort());
    expect(links.every((link) => link.level === "empty")).toBe(true);
  });

  it("rejects missing or duplicate chemistry pairs", () => {
    const valid = createChemistryLinks("4-3-3");

    const missing = valid.slice(1);
    expect(validateChemistryLinks("4-3-3", missing)).toBe(false);

    const duplicate = [...valid, valid[0]];
    expect(validateChemistryLinks("4-3-3", duplicate)).toBe(false);
  });

  describe("computeChemistryLinks", () => {
    it("assigns EXCELLENT for a mutually linked schema pair", () => {
      const formation = {
        LW: contractWith("Messi"),
        ST: contractWith("Ronaldo"),
      };
      const linksMap = new Map<string, string[]>([
        ["Messi", ["Ronaldo"]],
        ["Ronaldo", ["Messi"]],
      ]);

      const links = computeChemistryLinks("4-3-3", formation, linksMap);
      const lwSt = links.find((l) => l.from === "LW" && l.to === "ST");

      expect(lwSt?.level).toBe(ChemistryLevel.EXCELLENT);
    });

    it("assigns GOOD for one-way links and WEAK for none", () => {
      const formation = {
        LW: contractWith("Messi"),
        ST: contractWith("Ronaldo"),
      };

      const oneWay = computeChemistryLinks(
        "4-3-3",
        formation,
        new Map([["Messi", ["Ronaldo"]]])
      );
      expect(oneWay.find((l) => l.from === "LW" && l.to === "ST")?.level).toBe(
        ChemistryLevel.GOOD
      );

      const none = computeChemistryLinks("4-3-3", formation, new Map());
      expect(none.find((l) => l.from === "LW" && l.to === "ST")?.level).toBe(
        ChemistryLevel.WEAK
      );
    });

    it("assigns EMPTY when a link has a missing slot and returns the full topology", () => {
      const formation = { LW: contractWith("Messi") }; // ST empty
      const links = computeChemistryLinks(
        "4-3-3",
        formation,
        new Map([["Messi", ["Ronaldo"]]])
      );

      expect(links.find((l) => l.from === "LW" && l.to === "ST")?.level).toBe(
        ChemistryLevel.EMPTY
      );
      expect(links).toHaveLength(CHEMISTRY_LINKS["4-3-3"].length);
    });
  });
});
