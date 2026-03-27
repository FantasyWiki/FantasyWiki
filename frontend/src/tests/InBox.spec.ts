/**
 * InBox.vue — unit tests
 *
 * Covers: bell button rendering, badge count, popover open/close via vm state,
 * aria-label, incoming trade proposals (via DashboardHero as host), accept/reject.
 *
 * Strategy: InBox is a presentational component that receives all data as props
 * and emits events upward. For the trade-proposal tests that require MSW data
 * (useTrades / useNotifications), we mount DashboardHero as the host so the
 * composables are exercised end-to-end, matching real usage.
 *
 * Environment notes:
 * - Ionic components are web-component stubs in jsdom; portal content (popover
 *   body) lives outside the wrapper DOM — test reactive vm state instead.
 * - `trigger()` cannot set event.target — emit events on the component vm.
 * - Each test that mounts DashboardHero gets its own QueryClient to prevent
 *   cross-test cache pollution.
 */
import { describe, it, expect } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import DashboardHero from "@/modules/TeamDashboard/DashboardHero.vue";
import InBox from "@/modules/InBox.vue";
import { useLeagueStore } from "@/stores/league";
import type {
  DashboardSummary,
  League,
  Team,
  Notification,
  TradeProposal,
} from "@/types/models";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockLeague: League = {
  id: "italy",
  name: "Italia League",
  icon: "🍕",
  season: "2024",
  language: "Italiano",
  totalPlayers: 523,
  endDate: "Feb 28, 2024",
};

const mockTeam: Team = {
  id: "team-1",
  name: "I Cesarini",
  playerId: "player-1",
  leagueId: "italy",
  credits: 550,
  totalValue: 1000,
  rank: 4,
  points: 7250,
  yesterdayPoints: 127,
  pointsChange: 12.5,
};

const mockSummary: DashboardSummary = {
  yesterdayPoints: 127,
  pointsChange: 12.5,
  rank: 4,
  totalPlayers: 523,
  credits: 550,
  portfolioValue: 1000,
  activeContracts: 4,
  maxContracts: 18,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div/>" } },
      { path: "/market", component: { template: "<div/>" } },
      { path: "/leagues", component: { template: "<div/>" } },
    ],
  });
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
}

/** Mount DashboardHero as the host — it owns useTrades + useNotifications. */
function mountHero() {
  const pinia = createPinia();
  setActivePinia(pinia);

  const leagueStore = useLeagueStore();
  leagueStore.currentLeague = mockLeague;

  const wrapper = mount(DashboardHero, {
    props: {
      currentLeague: mockLeague,
      currentTeam: mockTeam,
      summary: mockSummary,
    },
    global: {
      plugins: [
        pinia,
        makeRouter(),
        [VueQueryPlugin, { queryClient: makeQueryClient() }],
      ],
    },
  });

  return wrapper;
}

/**
 * Mount InBox directly with explicit props — for pure presentational tests
 * that do not need MSW data.
 */
function mountInBox(
  props: {
    notifications?: Notification[];
    badgeCount?: number;
    outgoingCount?: number;
    leagueIcon?: string;
    leagueName?: string;
    actioning?: boolean;
    loading?: boolean;
    error?: string | null;
  } = {}
) {
  const pinia = createPinia();
  setActivePinia(pinia);

  return mount(InBox, {
    props: {
      notifications: props.notifications ?? [],
      badgeCount: props.badgeCount ?? 0,
      outgoingCount: props.outgoingCount ?? 0,
      leagueIcon: props.leagueIcon ?? "🍕",
      leagueName: props.leagueName ?? "Italia League",
      actioning: props.actioning ?? false,
      loading: props.loading ?? false,
      error: props.error ?? null,
    },
    global: {
      plugins: [pinia, makeRouter()],
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InBox.vue", () => {
  // ── 1. Bell button rendering ────────────────────────────────────────────

  describe("bell button", () => {
    it("renders the bell icon button inside DashboardHero", () => {
      expect(mountHero().find(".bell-icon-btn").exists()).toBe(true);
    });

    it("bell-wrapper contains the button", () => {
      expect(mountHero().find(".bell-wrapper .bell-icon-btn").exists()).toBe(
        true
      );
    });

    it("renders the default bell trigger button when mounted standalone", () => {
      const wrapper = mountInBox({ badgeCount: 3 });
      expect(wrapper.find(".bell-btn").exists()).toBe(true);
    });

    it("does not show a bell-badge when badgeCount is 0", () => {
      expect(mountInBox({ badgeCount: 0 }).find(".bell-badge").exists()).toBe(
        false
      );
    });

    it("shows a bell-badge when badgeCount > 0", () => {
      expect(mountInBox({ badgeCount: 2 }).find(".bell-badge").exists()).toBe(
        true
      );
    });

    it("caps the badge display at '9+' when badgeCount > 9", () => {
      expect(mountInBox({ badgeCount: 15 }).find(".bell-badge").text()).toBe(
        "9+"
      );
    });

    it("shows the exact count when badgeCount is between 1 and 9", () => {
      expect(mountInBox({ badgeCount: 5 }).find(".bell-badge").text()).toBe(
        "5"
      );
    });
  });

  // ── 2. Bell badge — via DashboardHero + MSW ──────────────────────────────

  describe("bell badge (MSW data)", () => {
    it("shows a bell-badge after unread notifications resolve via MSW", async () => {
      const wrapper = mountHero();
      await flushPromises();
      expect(wrapper.find(".bell-badge").exists()).toBe(true);
    });

    it("bell badge text represents a count greater than zero", async () => {
      const wrapper = mountHero();
      await flushPromises();
      const text = wrapper.find(".bell-badge").text();
      const numeric = parseInt(text, 10);
      if (!isNaN(numeric)) expect(numeric).toBeGreaterThan(0);
      else expect(text).toBe("9+");
    });

    it("aria-label on bell button includes the pending count", async () => {
      const wrapper = mountHero();
      await flushPromises();
      const label =
        wrapper.find(".bell-icon-btn").attributes("aria-label") ?? "";
      expect(label).toMatch(/Trade inbox – \d+ pending trade proposal/);
    });
  });

  // ── 3. Popover open / close — standalone ────────────────────────────────

  describe("popover open / close (standalone)", () => {
    it("IonPopover isOpen prop starts as false", () => {
      expect(
        mountInBox().findComponent({ name: "IonPopover" }).props("isOpen")
      ).toBe(false);
    });

    it("IonPopover isOpen becomes true after bell-btn click", async () => {
      const wrapper = mountInBox({ badgeCount: 1 });
      await wrapper.find(".bell-btn").trigger("click");
      expect(
        wrapper.findComponent({ name: "IonPopover" }).props("isOpen")
      ).toBe(true);
    });

    it("IonPopover isOpen returns to false after did-dismiss event", async () => {
      const wrapper = mountInBox({ badgeCount: 1 });
      await wrapper.find(".bell-btn").trigger("click");
      await wrapper
        .findComponent({ name: "IonPopover" })
        .trigger("did-dismiss");
      expect(
        wrapper.findComponent({ name: "IonPopover" }).props("isOpen")
      ).toBe(false);
    });

    it("exposes openInbox() which sets isOpen to true", async () => {
      const wrapper = mountInBox();
      const vm = wrapper.vm as unknown as {
        openInbox: () => void;
        isOpen: boolean;
      };
      vm.openInbox();
      await wrapper.vm.$nextTick();
      expect(
        wrapper.findComponent({ name: "IonPopover" }).props("isOpen")
      ).toBe(true);
    });

    it("exposes closeInbox() which sets isOpen to false", async () => {
      const wrapper = mountInBox({ badgeCount: 1 });
      await wrapper.find(".bell-btn").trigger("click");
      const vm = wrapper.vm as unknown as { closeInbox: () => void };
      vm.closeInbox();
      await wrapper.vm.$nextTick();
      expect(
        wrapper.findComponent({ name: "IonPopover" }).props("isOpen")
      ).toBe(false);
    });
  });

  // ── 4. Popover open / close — via DashboardHero ──────────────────────────

  describe("popover open / close (via DashboardHero)", () => {
    it("IonPopover isOpen starts as false in DashboardHero", () => {
      const wrapper = mountHero();
      expect(
        wrapper.findComponent({ name: "IonPopover" }).props("isOpen")
      ).toBe(false);
    });

    it("IonPopover isOpen becomes true after bell click in DashboardHero", async () => {
      const wrapper = mountHero();
      await wrapper.find(".bell-icon-btn").trigger("click");
      expect(
        wrapper.findComponent({ name: "IonPopover" }).props("isOpen")
      ).toBe(true);
    });

    it("IonPopover isOpen returns to false after did-dismiss in DashboardHero", async () => {
      const wrapper = mountHero();
      await wrapper.find(".bell-icon-btn").trigger("click");
      await wrapper
        .findComponent({ name: "IonPopover" })
        .trigger("did-dismiss");
      expect(
        wrapper.findComponent({ name: "IonPopover" }).props("isOpen")
      ).toBe(false);
    });

    it("internal inboxOpen ref mirrors popover isOpen in DashboardHero", async () => {
      const wrapper = mountHero();
      const vm = wrapper.vm as unknown as { inboxOpen: boolean };
      expect(vm.inboxOpen).toBe(false);
      await wrapper.find(".bell-icon-btn").trigger("click");
      expect(vm.inboxOpen).toBe(true);
    });
  });

  // ── 5. Empty / loading / error states — standalone ──────────────────────

  describe("content states (standalone)", () => {
    it("shows loading spinner when loading prop is true", () => {
      const wrapper = mountInBox({ loading: true });
      expect(wrapper.findComponent({ name: "IonSpinner" }).exists()).toBe(true);
    });

    it("shows empty state when notifications list is empty and not loading", async () => {
      const wrapper = mountInBox({ notifications: [], loading: false });
      // open the popover so the content renders
      const vm = wrapper.vm as unknown as { openInbox: () => void };
      vm.openInbox();
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain("No pending notifications");
    });

    it("shows error message when error prop is set", async () => {
      const wrapper = mountInBox({ error: "Network error" });
      const vm = wrapper.vm as unknown as { openInbox: () => void };
      vm.openInbox();
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain("Network error");
    });

    it("shows outgoing hint when outgoingCount > 0", async () => {
      const wrapper = mountInBox({ outgoingCount: 2 });
      const vm = wrapper.vm as unknown as { openInbox: () => void };
      vm.openInbox();
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain("2 outgoing notifications pending");
    });
  });

  // ── 6. Trade proposals — via DashboardHero + MSW ─────────────────────────

  describe("trade proposals (MSW data)", () => {
    it("incomingPending has entries after MSW responds", async () => {
      const wrapper = mountHero();
      await flushPromises();
      const vm = wrapper.vm as unknown as {
        incomingPending: Array<{ id: string }>;
      };
      expect(vm.incomingPending.length).toBeGreaterThan(0);
    });

    it("incoming proposals contain expected proposer usernames", async () => {
      const wrapper = mountHero();
      await flushPromises();
      const vm = wrapper.vm as unknown as {
        incomingPending: Array<{ fromUsername: string }>;
      };
      const names = vm.incomingPending.map((p) => p.fromUsername);
      expect(names.some((n) => ["WikiMaster", "DataKing"].includes(n))).toBe(
        true
      );
    });

    it("pendingCount equals incomingPending.length", async () => {
      const wrapper = mountHero();
      await flushPromises();
      const vm = wrapper.vm as unknown as {
        incomingPending: unknown[];
        pendingCount: number;
      };
      expect(vm.pendingCount).toBe(vm.incomingPending.length);
    });

    it("calling handleAccept() reduces incomingPending length", async () => {
      const wrapper = mountHero();
      await flushPromises();
      const vm = wrapper.vm as unknown as {
        incomingPending: Array<{ id: string }>;
        handleAccept: (id: string) => Promise<void>;
      };
      const before = vm.incomingPending.length;
      await vm.handleAccept(vm.incomingPending[0].id);
      await flushPromises();
      expect(vm.incomingPending.length).toBeLessThan(before);
    });

    it("calling handleReject() reduces incomingPending length", async () => {
      const wrapper = mountHero();
      await flushPromises();
      const vm = wrapper.vm as unknown as {
        incomingPending: Array<{ id: string }>;
        handleReject: (id: string) => Promise<void>;
      };
      const before = vm.incomingPending.length;
      await vm.handleReject(vm.incomingPending[0].id);
      await flushPromises();
      expect(vm.incomingPending.length).toBeLessThan(before);
    });
  });

  // ── 7. Emits — standalone ───────────────────────────────────────────────

  describe("emits", () => {
    it("emits 'close' when closeInbox() is called", async () => {
      const wrapper = mountInBox({ badgeCount: 1 });
      await wrapper.find(".bell-btn").trigger("click");
      const vm = wrapper.vm as unknown as { closeInbox: () => void };
      vm.closeInbox();
      expect(wrapper.emitted("close")).toBeTruthy();
    });

    it("emits 'accept' with the trade id when accept button is clicked", async () => {
      const fakeNotification = {
        id: "notif-1",
        leagueId: "italy",
        teamId: "team-1",
        message: "Nuovo trade da WikiMaster",
        type: "trade_offer" as const,
        extra: "trd-1",
        read: false,
        createdAt: new Date().toISOString(),
        fromUsername: "WikiMaster",
        requestedArticle: { id: "art-7", name: "Python", basePrice: 950 },
        offeredArticle: {
          id: "art-11",
          name: "Albert Einstein",
          basePrice: 850,
        },
        contractTier: "2 Weeks",
      } as Notification & TradeProposal;

      const wrapper = mountInBox({
        notifications: [fakeNotification as unknown as Notification],
        badgeCount: 1,
      });
      const vm = wrapper.vm as unknown as { openInbox: () => void };
      vm.openInbox();
      await wrapper.vm.$nextTick();

      const acceptBtn = wrapper
        .findAll("ion-button")
        .find((b) => b.attributes("color") === "primary");
      await acceptBtn?.trigger("click");
      expect(wrapper.emitted("accept")?.[0]).toEqual(["notif-1"]);
    });

    it("emits 'reject' with the trade id when reject button is clicked", async () => {
      const fakeNotification = {
        id: "notif-2",
        leagueId: "italy",
        teamId: "team-1",
        message: "Nuovo trade da DataKing",
        type: "trade_offer" as const,
        extra: "trd-2",
        read: false,
        createdAt: new Date().toISOString(),
        fromUsername: "DataKing",
        requestedArticle: { id: "art-8", name: "JavaScript", basePrice: 1100 },
        offeredCredits: 1200,
        contractTier: "1 Month",
      } as Notification & Partial<TradeProposal>;

      const wrapper = mountInBox({
        notifications: [fakeNotification as unknown as Notification],
        badgeCount: 1,
      });
      const vm = wrapper.vm as unknown as { openInbox: () => void };
      vm.openInbox();
      await wrapper.vm.$nextTick();

      const rejectBtn = wrapper
        .findAll("ion-button")
        .find((b) => b.attributes("color") === "danger");
      await rejectBtn?.trigger("click");
      expect(wrapper.emitted("reject")?.[0]).toEqual(["notif-2"]);
    });

    it("emits 'retry' when retry button is clicked in error state", async () => {
      const wrapper = mountInBox({ error: "Network error" });
      const vm = wrapper.vm as unknown as { openInbox: () => void };
      vm.openInbox();
      await wrapper.vm.$nextTick();
      const retryBtn = wrapper
        .findAll("ion-button")
        .find((b) => b.text().includes("Retry"));
      await retryBtn?.trigger("click");
      expect(wrapper.emitted("retry")).toBeTruthy();
    });
  });
});
