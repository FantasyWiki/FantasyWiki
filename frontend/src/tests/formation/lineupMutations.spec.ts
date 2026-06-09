import { describe, expect, it } from "vitest";
import {
  createDraftFormation,
  type Position,
} from "../../../../dto/formationDTO";
import { ContractDTO } from "../../../../dto/contractDTO";
import {
  type DraftLineup,
  assignToPosition,
  removeFromPosition,
  swapSlots,
  moveToEmpty,
  setSchema,
} from "../../../../dto/lineupMutations";

function contract(id: string): ContractDTO {
  return ContractDTO.fromRaw({
    id,
    team: {
      id: "t",
      name: "T",
      credits: 0,
      player: { id: "p", name: "P" },
      points: 0,
    },
    article: { id: `a-${id}`, title: id, domain: "en" },
    startDate: "2026-01-01T00:00:00Z",
    duration: "P7D",
    purchasePrice: 0,
  });
}

function lineup(
  formationMap: Partial<Record<Position, ContractDTO>>,
  bench: ContractDTO[]
): DraftLineup {
  return { formation: createDraftFormation("4-3-3", formationMap), bench };
}

const id = (c?: ContractDTO | null) => c?.id ?? null;

describe("lineup mutations", () => {
  describe("assignToPosition", () => {
    it("places a bench contract onto an empty position and removes it from the bench", () => {
      const a = contract("a");
      const next = assignToPosition(lineup({}, [a]), "ST", a);
      expect(id(next.formation.formation.ST)).toBe("a");
      expect(next.bench).toHaveLength(0);
    });

    it("displaces the current occupant to the bench", () => {
      const a = contract("a");
      const b = contract("b");
      const next = assignToPosition(lineup({ ST: a }, [b]), "ST", b);
      expect(id(next.formation.formation.ST)).toBe("b");
      expect(next.bench.map(id)).toEqual(["a"]);
    });
  });

  describe("removeFromPosition", () => {
    it("clears the position and returns the contract to the bench", () => {
      const a = contract("a");
      const next = removeFromPosition(lineup({ ST: a }, []), "ST");
      expect(next.formation.formation.ST).toBeUndefined();
      expect(next.bench.map(id)).toEqual(["a"]);
    });

    it("is a no-op for an empty position", () => {
      const state = lineup({}, []);
      expect(removeFromPosition(state, "ST")).toBe(state);
    });
  });

  describe("swapSlots", () => {
    it("swaps two filled positions", () => {
      const a = contract("a");
      const b = contract("b");
      const next = swapSlots(lineup({ LW: a, ST: b }, []), "a", "ST", "b");
      expect(id(next.formation.formation.ST)).toBe("a");
      expect(id(next.formation.formation.LW)).toBe("b");
      expect(next.bench).toHaveLength(0);
    });

    it("moves a position contract to the bench (toPos=bench, no target)", () => {
      const a = contract("a");
      const next = swapSlots(lineup({ ST: a }, []), "a", "bench", null);
      expect(next.formation.formation.ST).toBeUndefined();
      expect(next.bench.map(id)).toEqual(["a"]);
    });

    it("swaps a bench contract onto a filled position, benching the occupant", () => {
      const a = contract("a"); // on bench
      const b = contract("b"); // on ST
      const next = swapSlots(lineup({ ST: b }, [a]), "a", "ST", "b");
      expect(id(next.formation.formation.ST)).toBe("a");
      expect(next.bench.map(id)).toEqual(["b"]);
    });

    it("reorders two bench contracts (bench<->bench)", () => {
      const a = contract("a");
      const b = contract("b");
      const next = swapSlots(lineup({}, [a, b]), "a", "bench", "b");
      expect(next.bench.map(id)).toEqual(["b", "a"]);
    });
  });

  describe("moveToEmpty", () => {
    it("moves a bench contract to an empty position", () => {
      const a = contract("a");
      const next = moveToEmpty(lineup({}, [a]), "a", "ST");
      expect(id(next.formation.formation.ST)).toBe("a");
      expect(next.bench).toHaveLength(0);
    });

    it("is a no-op when the target position is occupied", () => {
      const a = contract("a");
      const b = contract("b");
      const state = lineup({ ST: b }, [a]);
      expect(moveToEmpty(state, "a", "ST")).toBe(state);
    });
  });

  describe("setSchema", () => {
    it("remaps the formation to the new schema, keeping the bench reference when nothing is dropped", () => {
      const a = contract("a");
      const bench = [contract("b")];
      const next = setSchema(lineup({ ST: a }, bench), "4-4-2");
      expect(next.formation.schema).toBe("4-4-2");
      expect(next.bench).toBe(bench);
    });

    it("benches contracts that cannot be carried into the new schema", () => {
      const a = contract("a");
      const b = contract("b");
      // b sits on a position the source schema does not define, so the remap
      // cannot carry it forward; it must land on the bench rather than vanish.
      const next = setSchema(lineup({ ST: a, CDM: b }, []), "4-4-2");
      const placedIds = Object.values(next.formation.formation)
        .filter((c): c is ContractDTO => !!c)
        .map((c) => c.id);
      expect(placedIds).not.toContain("b");
      expect(next.bench.map((c) => c.id)).toContain("b");
    });
  });
});
