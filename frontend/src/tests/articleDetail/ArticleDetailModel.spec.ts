import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO } from "../../../../dto/contractDTO";
import type { TeamDTO } from "../../../../dto/teamDTO";
import type { ArticleDTO } from "../../../../dto/articleDTO";
import { buildArticleDetail } from "@/types/articleDetail";

const viewerTeam: TeamDTO = {
  id: "team-viewer",
  name: "Viewer FC",
  credits: 900,
  player: { id: "viewer-player", name: "Viewer" },
  points: 0,
};

const otherTeam: TeamDTO = {
  id: "team-other",
  name: "Other FC",
  credits: 1200,
  player: { id: "other-player", name: "Other" },
  points: 0,
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
  it("marks contract owned by viewer and hides buy action", () => {
    const model = buildArticleDetail({
      article,
      currentPrice: 1000,
      purchasePrice: 800,
      expiresIn: Temporal.Duration.from({ days: 5 }),
      tier: "MEDIUM",
      ownerTeamId: viewerTeam.id,
      ownerTeamName: viewerTeam.name,
      viewerTeamId: viewerTeam.id,
      viewerCredits: viewerTeam.credits,
    });

    expect(model.availability).toBe("owned-by-viewer");
    expect(model.showBuy).toBe(false);
    expect(model.showContractActions).toBe(true);
  });

  it("marks contract owned by other team and disables buy", () => {
    const contract = makeContract(otherTeam, 700);

    const model = buildArticleDetail({
      article: contract.article,
      currentPrice: contract.currentPrice,
      purchasePrice: contract.purchasePrice,
      expiresIn: contract.expiresIn,
      tier: contract.tier,
      ownerTeamId: contract.team.id,
      ownerTeamName: contract.team.name,
      viewerTeamId: viewerTeam.id,
      viewerCredits: viewerTeam.credits,
    });

    expect(model.availability).toBe("owned-by-other");
    expect(model.ownerTeamName).toBe("Other FC");
    expect(model.showBuy).toBe(true);
    expect(model.buyDisabled).toBe(true);
    expect(model.buyDisabledReason).toBe("Already owned");
    expect(model.showContractActions).toBe(false);
  });

  it("marks free-agent and disables buy when viewer credits are insufficient", () => {
    const model = buildArticleDetail({
      article,
      currentPrice: 1000,
      viewerTeamId: viewerTeam.id,
      viewerCredits: 700,
    });

    expect(model.availability).toBe("free-agent");
    expect(model.showBuy).toBe(true);
    expect(model.buyDisabled).toBe(true);
    expect(model.buyDisabledReason).toBe("Not enough credits");
    expect(model.showContractActions).toBe(false);
  });
});
