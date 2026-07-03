import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO } from "../../../../dto/contractDTO";
import type { TeamDTO } from "../../../../dto/teamDTO";
import type { ArticleDTO } from "../../../../dto/articleDTO";
import { buildArticleDetail } from "@/types/articleDetail";
import {
  LANGUAGE_SCALE,
  TIER_DAYS,
  computeContractPrice,
  normalizedViews,
} from "../../../../model/pricing";

const averageViews30d = 9000;
const expectedCurrentPrice = computeContractPrice(
  normalizedViews(averageViews30d, LANGUAGE_SCALE.en),
  TIER_DAYS.MEDIUM
);

const viewerTeam: TeamDTO = {
  id: "team-viewer",
  name: "Viewer FC",
  credits: 900,
  player: { id: "viewer-player", name: "Viewer" },
};

const otherTeam: TeamDTO = {
  id: "team-other",
  name: "Other FC",
  credits: 1200,
  player: { id: "other-player", name: "Other" },
};

const article: ArticleDTO = {
  id: "article-chatgpt",
  title: "ChatGPT",
  domain: "en",
};

function makeContract(team: TeamDTO, purchasePrice = 800): ContractDTO {
  const yesterday = Temporal.Now.zonedDateTimeISO("UTC")
    .subtract({ days: 1 })
    .toInstant();
  return new ContractDTO(
    `contract-${team.id}`,
    team,
    article,
    yesterday,
    Temporal.Duration.from({ days: 7 }),
    purchasePrice
  );
}

describe("articleDetailModel", () => {
  it("marks a contract owned by the viewer and exposes contract fields", () => {
    const contract = makeContract(viewerTeam, 800);

    const model = buildArticleDetail({
      article,
      contract,
      viewerTeamId: viewerTeam.id,
      viewerCredits: viewerTeam.credits,
      averageViews30d,
    });

    expect(model.availability).toBe("owned-by-viewer");
    if (model.availability !== "owned-by-viewer")
      throw new Error("unreachable");
    expect(model.contractId).toBe(contract.id);
    expect(model.tier).toBe(contract.tier);
    expect(model.ownerTeamName).toBe("Viewer FC");
    expect(model.currentPrice).toBe(expectedCurrentPrice);
    expect(model.purchasePrice).toBe(800);
  });

  it("marks a contract owned by another team, showing current price but hiding purchase price", () => {
    const contract = makeContract(otherTeam, 700);

    const model = buildArticleDetail({
      article,
      contract,
      viewerTeamId: viewerTeam.id,
      viewerCredits: viewerTeam.credits,
      averageViews30d,
    });

    expect(model.availability).toBe("owned-by-other");
    if (model.availability !== "owned-by-other") throw new Error("unreachable");
    expect(model.contractId).toBe(contract.id);
    expect(model.ownerTeamName).toBe("Other FC");
    expect(model.unlockIn).toBeInstanceOf(Temporal.Duration);
    // Current price (the article's live market value) is shown to everyone;
    // only the owner's purchase price stays private.
    expect(model.currentPrice).toBe(expectedCurrentPrice);
    expect((model as { purchasePrice?: number }).purchasePrice).toBeUndefined();
  });

  it("marks a free agent with no contract, computing current price and tier options from views", () => {
    const model = buildArticleDetail({
      article,
      contract: null,
      viewerTeamId: viewerTeam.id,
      viewerCredits: 700,
      averageViews30d,
    });

    expect(model.availability).toBe("free-agent");
    if (model.availability !== "free-agent") throw new Error("unreachable");
    expect(model.tierOptions).toHaveLength(3);
    expect(model.tierOptions.map((o) => o.tier)).toEqual([
      "SHORT",
      "MEDIUM",
      "LONG",
    ]);
    expect(model.tierOptions.find((o) => o.tier === "MEDIUM")?.price).toBe(
      expectedCurrentPrice
    );
    expect(model.viewerCredits).toBe(700);
    expect(model.currentPrice).toBe(expectedCurrentPrice);
  });
});
