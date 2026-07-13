import { describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { Temporal } from "@js-temporal/polyfill";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import RenewalRiskChip from "@/components/teamDashboard/RenewalRiskChip.vue";
import { ContractDTO } from "../../../../dto/contractDTO";
import { computeCurrentPrice, TIER_DAYS } from "../../../../model/pricing";
import type { TeamDTO } from "../../../../dto/teamDTO";
import type { ArticleDTO } from "../../../../dto/articleDTO";

const AVG_VIEWS = 9000;

vi.mock("@/composables/useArticleViews", () => ({
  useArticleViews: () => ({
    views: ref({ averageViews30d: AVG_VIEWS }),
    isLoading: ref(false),
  }),
}));

const myTeamMock = vi.hoisted(() => ({ credits: 0 }));

vi.mock("@/composables/useMyTeam", async () => {
  const { computed } = await import("vue");
  return {
    useMyTeam: () => ({
      myTeam: computed(() => ({
        id: "team-viewer",
        credits: myTeamMock.credits,
      })),
      myTeamId: computed(() => "team-viewer"),
      isPending: computed(() => false),
      error: computed(() => null),
      refetch: async () => undefined,
    }),
  };
});

const viewerTeam: TeamDTO = {
  id: "team-viewer",
  name: "Viewer FC",
  credits: 0,
  player: { id: "viewer-player", name: "Viewer" },
};

const article: ArticleDTO = { id: "article-1", title: "ChatGPT", domain: "en" };

/** MEDIUM-tier contract, so the renewal price is computeCurrentPrice(…, 7 days). */
function contractWith(purchasePrice: number, renewalElected = true) {
  return new ContractDTO(
    "contract-1",
    viewerTeam,
    article,
    Temporal.Now.instant().subtract({ hours: 24 * 6 }),
    Temporal.Duration.from({ days: TIER_DAYS.MEDIUM }),
    purchasePrice,
    0,
    renewalElected
  );
}

const renewalPrice = computeCurrentPrice(AVG_VIEWS, "en", TIER_DAYS.MEDIUM);

function mountChip(contract: ContractDTO, credits: number) {
  const pinia = createPinia();
  setActivePinia(pinia);
  myTeamMock.credits = credits;
  return mount(RenewalRiskChip, {
    props: { contract },
    global: { plugins: [pinia] },
  });
}

/**
 * The sweep compares the *incremental* cost (renewalPrice − purchasePrice)
 * against credits, not the full renewal price — the original stake is already
 * sunk in the derived ledger. The chip must use the same comparison, or it would
 * warn about renewals that will in fact go through.
 */
describe("RenewalRiskChip", () => {
  it("warns with the shortfall when the top-up exceeds the team's credits", async () => {
    // purchasePrice 0 => incremental cost is the whole renewal price.
    const wrapper = mountChip(contractWith(0), renewalPrice - 30);
    await flushPromises();

    expect(wrapper.text()).toContain("Renewal at risk");
    expect(wrapper.text()).toContain("30");
  });

  it("stays silent when credits cover the top-up", async () => {
    const wrapper = mountChip(contractWith(0), renewalPrice);
    await flushPromises();

    expect(wrapper.text()).toBe("");
  });

  it("stays silent on a broke team when the article got cheaper (renewal refunds)", async () => {
    // Paid far above today's price => incremental cost is negative.
    const wrapper = mountChip(contractWith(renewalPrice + 500), 0);
    await flushPromises();

    expect(wrapper.text()).toBe("");
  });

  it("stays silent when no renewal is elected", async () => {
    const wrapper = mountChip(contractWith(0, false), 0);
    await flushPromises();

    expect(wrapper.text()).toBe("");
  });
});
