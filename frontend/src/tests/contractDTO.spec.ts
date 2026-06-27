import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO, type RawContract } from "../../../dto/contractDTO";
import type { TeamDTO } from "../../../dto/teamDTO";
import type { ArticleDTO } from "../../../dto/articleDTO";

const team: TeamDTO = {
  id: "team-1",
  name: "Viewer FC",
  credits: 500,
  player: { id: "player-1", name: "Viewer" },
};

const article: ArticleDTO = {
  id: "article-1",
  title: "ChatGPT",
  domain: "en",
};

describe("ContractDTO.fromRaw", () => {
  it("deserializes string dates/durations into Temporal types and preserves fields", () => {
    const raw: RawContract = {
      id: "contract-1",
      team,
      article,
      startDate: "2026-01-01T00:00:00Z",
      duration: "P7D",
      purchasePrice: 800,
    };

    const contract = ContractDTO.fromRaw(raw);

    expect(contract).toBeInstanceOf(ContractDTO);
    expect(contract.startDate).toBeInstanceOf(Temporal.Instant);
    expect(contract.duration).toBeInstanceOf(Temporal.Duration);
    expect(
      contract.startDate.equals(Temporal.Instant.from("2026-01-01T00:00:00Z"))
    ).toBe(true);
    expect(contract.duration.total({ unit: "days" })).toBe(7);
    expect(contract.id).toBe("contract-1");
    expect(contract.team).toBe(team);
    expect(contract.article).toBe(article);
    expect(contract.purchasePrice).toBe(800);
  });

  it("accepts duration in object form", () => {
    const raw: RawContract = {
      id: "contract-2",
      team,
      article,
      startDate: "2026-02-01T00:00:00Z",
      duration: { days: 3 },
      purchasePrice: 400,
    };

    const contract = ContractDTO.fromRaw(raw);

    expect(contract.duration).toBeInstanceOf(Temporal.Duration);
    expect(contract.duration.total({ unit: "days" })).toBe(3);
  });
});
