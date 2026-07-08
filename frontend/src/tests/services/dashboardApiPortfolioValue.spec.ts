import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import api, { getContractCurrentPrice } from "@/services/api";
import { leagues } from "@/mocks/data/leagues";
import { contracts } from "@/mocks/data/contracts";
import {
  computeCurrentPrice,
  TIER_DAYS,
  type ContractTier,
} from "../../../../model/pricing";

const DAILY_VIEWS = 5_000;

function mockFlatPageviews(dailyViews: number) {
  server.use(
    http.get(
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/*",
      () =>
        HttpResponse.json({
          items: Array.from({ length: 365 }, () => ({ views: dailyViews })),
        })
    )
  );
}

/** Empty `items` is how `getArticleViews` reports "no usable history" — averageViews30d comes back undefined, not an exception. */
function mockEmptyPageviews() {
  server.use(
    http.get(
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/*",
      () => HttpResponse.json({ items: [] })
    )
  );
}

describe("dashboard portfolioValue", () => {
  it("getContractCurrentPrice prices a contract via live views at its own held tier, not purchasePrice", async () => {
    mockFlatPageviews(DAILY_VIEWS);
    const contract = contracts[0];

    const price = await getContractCurrentPrice(contract);

    const expected = computeCurrentPrice(
      DAILY_VIEWS,
      contract.article.domain,
      TIER_DAYS[contract.tier as ContractTier]
    );
    expect(price).toBe(expected);
    expect(price).not.toBe(contract.purchasePrice);
  });

  it("getDashboardData sums live current prices, not purchase prices, into portfolioValue", async () => {
    mockFlatPageviews(DAILY_VIEWS);
    const league = leagues.find((l) => l.id === "global")!;

    const data = await api.dashboard.getDashboardData(league);
    const myContracts = contracts.filter((c) => c.team.id === data.team.id);
    expect(myContracts.length).toBeGreaterThan(0);

    const expectedPortfolioValue = myContracts.reduce(
      (sum, c) =>
        sum +
        computeCurrentPrice(
          DAILY_VIEWS,
          c.article.domain,
          TIER_DAYS[c.tier as ContractTier]
        ),
      0
    );
    const purchasePriceSum = myContracts.reduce(
      (sum, c) => sum + c.purchasePrice,
      0
    );

    expect(data.portfolioValue).toBe(expectedPortfolioValue);
    expect(data.portfolioValue).not.toBe(purchasePriceSum);
  });

  it("getContractCurrentPrice falls back to purchasePrice when Wikimedia has no usable view history", async () => {
    mockEmptyPageviews();
    const contract = contracts[0];

    const price = await getContractCurrentPrice(contract);

    expect(price).toBe(contract.purchasePrice);
  });
});
