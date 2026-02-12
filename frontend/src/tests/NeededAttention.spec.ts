import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import NeededAttention from "@/modules/TeamDashboard/NeededAttention.vue";
import { Contract } from "@/types/models";
import { useLeagueStore } from "@/stores/league";

describe("NeededAttention.vue", () => {
  let mockContracts: Contract[];
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    // Create fresh Pinia instance
    pinia = createPinia();
    setActivePinia(pinia);

    // Setup league store with mock data
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

    leagueStore.notificationsList = [
      {
        id: "notif-2",
        leagueId: "italy",
        teamId: "team-1",
        message: "Nuovo trade disponibile!",
        type: "trade_offer",
        extra: "ctr-3",
        read: false,
        createdAt: "2024-02-09T08:30:00Z",
      },
    ];

    // Setup mock contracts
    mockContracts = [
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
      {
        id: "ctr-5",
        teamId: "team-2",
        leagueId: "global",
        purchasePrice: 180,
        currentPrice: 195,
        yesterdayPoints: 52,
        expiresIn: 10,
        tier: "LONG",
        article: { id: "art-5", name: "Cloud Computing", domain: "itwiki" },
      },
    ];
  });

  it("should render component title", () => {
    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain("Attention Needed");
  });

  it("should filter contracts by current league", () => {
    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
      },
      global: {
        plugins: [pinia],
      },
    });

    // Should only show contracts from italy league with expiresIn <= 3
    const items = wrapper.findAllComponents({ name: "IonItem" });
    expect(items.length).toBe(2); // Only 2 italy contracts with expiresIn <= 3
  });

  it("should show empty state when no urgent contracts", () => {
    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: [],
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.find(".empty-state").exists()).toBe(true);
    expect(wrapper.text()).toContain("No contracts need attention");
  });

  it("should display contract count in subtitle", () => {
    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain("2 contracts requiring action");
  });

  it("should display article names", () => {
    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain("Bitcoin");
    expect(wrapper.text()).toContain("Intelligenza Artificiale");
  });

  it("should show expiry warning badge for contracts expiring soon", () => {
    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
      },
      global: {
        plugins: [pinia],
      },
    });

    const badges = wrapper.findAll(".status-badge");
    const expiryBadges = badges.filter((b) => b.text().includes("d left"));
    expect(expiryBadges.length).toBeGreaterThan(0);
  });

  it("should show trade offer badge when notification exists", () => {
    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain("Trade Offer Available");
  });

  it("should display yesterday points", () => {
    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain("45 pts");
    expect(wrapper.text()).toContain("42 pts");
  });

  it("should apply correct tier color", () => {
    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
      },
      global: {
        plugins: [pinia],
      },
    });

    const badges = wrapper.findAll(".tier-badge");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("should open modal when clicking contract item", async () => {
    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
      },
      global: {
        plugins: [pinia],
      },
    });

    const item = wrapper.find(".article-item");
    await item.trigger("click");

    // Modal should be open
    expect(wrapper.find("ion-modal").isVisible()).toBe(true);
  });

  it("should have Buy More button when callback provided", () => {
    const onBuyArticles = vi.fn();

    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
        onBuyArticles,
      },
      global: {
        plugins: [pinia],
      },
    });

    // Find by text instead of attributes
    const buttons = wrapper.findAll("ion-button");
    const buyButton = buttons.find((btn) => btn.text().includes("Buy More"));

    expect(buyButton?.exists()).toBe(true);
  });

  it("should not show Buy More button when callback not provided", () => {
    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
      },
      global: {
        plugins: [pinia],
      },
    });

    const buyButton = wrapper.find('ion-button[fill="outline"]');
    expect(buyButton.exists()).toBe(false);
  });

  it("should handle plural form correctly for contract count", () => {
    const singleContract = [mockContracts[0]];

    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: singleContract,
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain("1 contract requiring action");
  });

  it("should filter out contracts from other leagues", () => {
    const leagueStore = useLeagueStore();
    leagueStore.currentLeague = {
      id: "global",
      name: "Global League",
      icon: "🌐",
      season: "2024",
      language: "All Languages",
      totalPlayers: 10523,
      endDate: "Mar 31, 2024",
    };

    const wrapper = mount(NeededAttention, {
      props: {
        urgentContract: mockContracts,
      },
      global: {
        plugins: [pinia],
      },
    });

    // Should show empty state as global league contract has expiresIn: 10
    expect(wrapper.find(".empty-state").exists()).toBe(true);
  });
});
