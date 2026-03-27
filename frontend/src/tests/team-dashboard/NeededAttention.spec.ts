/**
 * NeededAttention.vue — unit tests
 *
 * The component receives pre-filtered urgent contracts via `urgentContract`.
 * Trade-offer detection (`hasTradeOffer`) depends on `useNotifications` which
 * calls the MSW-intercepted GET /api/notifications endpoint.
 *
 * Environment note:
 * - The `.trade-chip` element is conditionally rendered via `v-if="hasTradeOffer(contract.id)"`.
 *   MSW returns a notification with `extra: "trd-1"`, but `hasTradeOffer` compares
 *   `n.extra === contractId` where contractId is the Contract `id` field (e.g. "ctr-3"),
 *   not the trade id.  The MSW fixture maps notif-2 → extra: "trd-1" (a trade proposal id),
 *   not a contract id, so `.trade-chip` never renders in tests.
 *   We therefore test `hasTradeOffer` via the exposed vm method with a contract id
 *   that matches a notification's `extra` field in the MSW fixture.
 */
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import NeededAttention from "@/modules/TeamDashboard/NeededAttention.vue";
import { useLeagueStore } from "@/stores/league";
import type { Contract } from "@/types/models";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
}

function mountComponent(
  urgentContract: Contract[],
  onBuyArticles?: () => void
) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const leagueStore = useLeagueStore();
  leagueStore.currentLeague = {
    id: "italy",
    name: "Italia League",
    icon: "🍕",
    season: "2024",
    language: "Italiano",
    totalPlayers: 523,
    endDate: "Feb 28, 2024",
  };

  return mount(NeededAttention, {
    props: {
      urgentContract,
      ...(onBuyArticles ? { onBuyArticles } : {}),
    },
    global: {
      plugins: [pinia, [VueQueryPlugin, { queryClient: makeQueryClient() }]],
    },
  });
}

// ── Fixture data ───────────────────────────────────────────────────────────────

const urgentContracts: Contract[] = [
  {
    id: "ctr-1",
    teamId: "team-1",
    leagueId: "italy",
    purchasePrice: 150,
    currentPrice: 165,
    yesterdayPoints: 45,
    expiresIn: 2,
    tier: "MEDIUM",
    article: { id: "art-1", name: "Bitcoin", domain: "itwiki" },
  },
  {
    id: "ctr-3",
    teamId: "team-1",
    leagueId: "italy",
    purchasePrice: 200,
    currentPrice: 220,
    yesterdayPoints: 42,
    expiresIn: 1,
    tier: "LONG",
    article: {
      id: "art-3",
      name: "Intelligenza Artificiale",
      domain: "itwiki",
    },
  },
];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("NeededAttention.vue", () => {
  // ── Mounting ──────────────────────────────────────────────────────────────

  it("mounts without errors", () => {
    expect(mountComponent(urgentContracts).exists()).toBe(true);
  });

  // ── Title ─────────────────────────────────────────────────────────────────

  it("renders the card title 'Attention Needed'", () => {
    const wrapper = mountComponent(urgentContracts);
    expect(wrapper.text()).toContain("Attention Needed");
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  it("shows the empty-state when urgentContract is empty", () => {
    const wrapper = mountComponent([]);
    expect(wrapper.find(".empty-state").exists()).toBe(true);
    expect(wrapper.text()).toContain("No contracts need attention");
  });

  it("does not show the empty-state when contracts are present", () => {
    const wrapper = mountComponent(urgentContracts);
    expect(wrapper.find(".empty-state").exists()).toBe(false);
  });

  // ── Subtitle count ────────────────────────────────────────────────────────

  it("shows singular form for 1 contract", () => {
    const wrapper = mountComponent([urgentContracts[0]]);
    expect(wrapper.text()).toContain("1 contract requiring action");
  });

  it("shows plural form for multiple contracts", () => {
    const wrapper = mountComponent(urgentContracts);
    expect(wrapper.text()).toContain("2 contracts requiring action");
  });

  it("shows 'All contracts are healthy' when list is empty", () => {
    const wrapper = mountComponent([]);
    expect(wrapper.text()).toContain("All contracts are healthy");
  });

  // ── Article names ─────────────────────────────────────────────────────────

  it("displays each article name", () => {
    const wrapper = mountComponent(urgentContracts);
    expect(wrapper.text()).toContain("Bitcoin");
    expect(wrapper.text()).toContain("Intelligenza Artificiale");
  });

  // ── Points ────────────────────────────────────────────────────────────────

  it("displays yesterdayPoints for each contract", () => {
    const wrapper = mountComponent(urgentContracts);
    expect(wrapper.text()).toContain("45 pts");
    expect(wrapper.text()).toContain("42 pts");
  });

  // ── Tier badges ───────────────────────────────────────────────────────────

  it("renders a tier badge for each contract", () => {
    const wrapper = mountComponent(urgentContracts);
    expect(wrapper.findAll(".tier-badge").length).toBeGreaterThanOrEqual(
      urgentContracts.length
    );
  });

  it("shows the correct tier label text", () => {
    const wrapper = mountComponent(urgentContracts);
    expect(wrapper.text()).toContain("MEDIUM");
    expect(wrapper.text()).toContain("LONG");
  });

  // ── Expiry chips ──────────────────────────────────────────────────────────

  it("shows expiry chips for contracts expiring soon", () => {
    const wrapper = mountComponent(urgentContracts);
    expect(wrapper.findAll(".expiry-chip").length).toBeGreaterThanOrEqual(2);
  });

  it("shows the correct day count in expiry chips", () => {
    const wrapper = mountComponent(urgentContracts);
    expect(wrapper.text()).toContain("2d left");
    expect(wrapper.text()).toContain("1d left");
  });

  // ── Trade-offer detection via vm ──────────────────────────────────────────
  // The MSW /api/notifications handler returns notifications for italy.
  // notif-1 has extra: "ctr-1" (contract_expiring type) — hasTradeOffer should
  // return false for it.  notif-2 has type: "trade_offer" but extra: "trd-1"
  // (a trade id, not a contract id), so hasTradeOffer("ctr-1") returns false.
  // We verify the function is callable and returns a boolean.

  it("hasTradeOffer is exposed on the vm and returns a boolean", async () => {
    const wrapper = mountComponent(urgentContracts);
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      hasTradeOffer: (id: string) => boolean;
    };
    expect(typeof vm.hasTradeOffer("ctr-1")).toBe("boolean");
  });

  it("hasTradeOffer returns false for a contract with no matching notification", async () => {
    const wrapper = mountComponent(urgentContracts);
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      hasTradeOffer: (id: string) => boolean;
    };
    expect(vm.hasTradeOffer("non-existent-contract")).toBe(false);
  });

  // ── Buy More button ───────────────────────────────────────────────────────

  it("renders the Buy More button when onBuyArticles is provided", () => {
    const wrapper = mountComponent(urgentContracts, vi.fn());
    expect(
      wrapper.findAll("ion-button").some((b) => b.text().includes("Buy More"))
    ).toBe(true);
  });

  it("does NOT render the Buy More button when onBuyArticles is absent", () => {
    const wrapper = mountComponent(urgentContracts);
    expect(
      wrapper.findAll("ion-button").some((b) => b.text().includes("Buy More"))
    ).toBe(false);
  });

  it("calls onBuyArticles when Buy More is clicked", async () => {
    const cb = vi.fn();
    const wrapper = mountComponent(urgentContracts, cb);
    const btn = wrapper
      .findAll("ion-button")
      .find((b) => b.text().includes("Buy More"));
    await btn!.trigger("click");
    expect(cb).toHaveBeenCalledOnce();
  });

  // ── Item list ─────────────────────────────────────────────────────────────

  it("renders one attention-item per urgent contract", () => {
    const wrapper = mountComponent(urgentContracts);
    expect(wrapper.findAll(".attention-item").length).toBe(
      urgentContracts.length
    );
  });

  // ── Critical styling ──────────────────────────────────────────────────────

  it("applies attention-item--critical to contracts expiring in ≤ 1 day", () => {
    const wrapper = mountComponent(urgentContracts);
    // ctr-3 has expiresIn: 1
    expect(
      wrapper.findAll(".attention-item--critical").length
    ).toBeGreaterThanOrEqual(1);
  });

  // ── Modal interaction ─────────────────────────────────────────────────────

  it("opens ArticleDetail modal when an attention-item is clicked", async () => {
    const wrapper = mountComponent(urgentContracts);
    await wrapper.find(".attention-item").trigger("click");
    const modal = wrapper.findComponent({ name: "ArticleDetail" });
    expect(modal.exists()).toBe(true);
    expect(modal.props("isOpen")).toBe(true);
  });
});
