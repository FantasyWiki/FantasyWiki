import { describe, it, expect } from "vitest";
import {
  basePoints,
  synergyPoints,
  teamSynergy,
  articleScore,
  teamDailyScore,
  TEAM_SYNERGY_CAP,
} from "../../../model/scoring";

// The single source of truth for daily scoring (scoring-system.md §3–§5). This
// is the *only* basePoints implementation — the Kotlin engine holds none of it.
describe("model/scoring basePoints", () => {
  // The doubling rungs + tail points from scoring-system.md §3.
  const rungs: Array<[number, number]> = [
    [2_000, 0],
    [2_828, 0.5],
    [4_000, 1],
    [8_000, 2],
    [16_000, 3],
    [32_000, 4],
    [64_000, 5],
    [128_000, 6],
    [150_000, 6.2288],
    [300_000, 9.2288],
    [476_000, 12.7488],
  ];

  it.each(rungs)(
    "scores %i normalized views as ~%f base points",
    (views, points) => {
      expect(basePoints(views)).toBeCloseTo(points, 3);
    },
  );

  it("floors at zero below the 2,000-view zero point", () => {
    expect(basePoints(1_000)).toBe(0);
    expect(basePoints(0)).toBe(0);
  });
});

describe("model/scoring synergy", () => {
  it("maps each canonical ChemistryLevel to its additive points (§4)", () => {
    expect(synergyPoints("excellent")).toBe(1.5);
    expect(synergyPoints("good")).toBe(0.5);
    expect(synergyPoints("weak")).toBe(0);
    expect(synergyPoints("empty")).toBe(0);
  });

  it("sums link values, capped at 20 (§4)", () => {
    expect(teamSynergy(["excellent", "good"])).toBeCloseTo(2.0);
    // 20 excellent links = 30 raw, capped.
    expect(teamSynergy(Array<"excellent">(20).fill("excellent"))).toBe(
      TEAM_SYNERGY_CAP,
    );
  });
});

describe("model/scoring articleScore applies the Language Scale Factor", () => {
  it("normalizes views by L before the curve (§2)", () => {
    expect(articleScore(64_000, 1.0)).toBeCloseTo(5.0);
    // L=2 doubles views -> one extra doubling rung.
    expect(articleScore(64_000, 2.0)).toBeCloseTo(6.0);
  });
});

describe("model/scoring teamDailyScore", () => {
  it("reproduces the scoring-system.md worked example (21.23)", () => {
    const rawViews = [300_000, 64_000, 16_000, 8_000, 1_500];
    const levels = ["excellent", "good"] as const;
    // base 9.2288 + 5 + 3 + 2 + 0 = 19.2288; synergy 1.5 + 0.5 = 2.0.
    expect(teamDailyScore(rawViews, 1.0, [...levels])).toBeCloseTo(21.23, 2);
  });

  it("is zero for an empty team", () => {
    expect(teamDailyScore([], 1.0, [])).toBe(0);
  });
});
