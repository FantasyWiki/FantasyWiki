import { describe, it, expect } from "vitest";
import {
  CHEMISTRY_LINKS,
  createChemistryLinks,
  validateChemistryLinks,
} from "../../../../dto/formationDTO";

describe("chemistry link helpers", () => {
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
});
