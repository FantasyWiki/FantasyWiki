/**
 * DashboardHero.vue — unit tests
 *
 * Environment notes:
 * - Ionic components are web-component stubs in jsdom.  `.attributes("color")`
 *   returns undefined; use `.props("color")` for Vue prop bindings.
 * - IonPopover portal content is outside the wrapper DOM — test reactive vm
 *   state instead of querying portal elements.
 * - `trigger()` cannot set event.target — emit events on components directly.
 * - Navigation: each test that checks routing gets its own router instance so
 *   there is no cross-test route state pollution.
 */
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import DashboardHero from "@/modules/TeamDashboard/DashboardHero.vue";
import { useLeagueStore } from "@/stores/league";
import type { DashboardSummary, League, Team } from "@/types/models";

// ── Fixtures ────────────────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Each call gets a fresh router so navigation tests don't pollute each other. */
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

function mountHero(
  overrides: {
    currentLeague?: League | null;
    currentTeam?: Team | null;
    summary?: DashboardSummary | null;
  } = {},
  router = makeRouter()
) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const leagueStore = useLeagueStore();
  leagueStore.currentLeague =
    overrides.currentLeague !== undefined
      ? overrides.currentLeague
      : mockLeague;

  return {
    wrapper: mount(DashboardHero, {
      props: {
        currentLeague:
          overrides.currentLeague !== undefined
            ? overrides.currentLeague
            : mockLeague,
        currentTeam:
          overrides.currentTeam !== undefined
            ? overrides.currentTeam
            : mockTeam,
        summary:
          overrides.summary !== undefined ? overrides.summary : mockSummary,
      },
      global: {
        plugins: [
          pinia,
          router,
          [VueQueryPlugin, { queryClient: makeQueryClient() }],
        ],
      },
    }),
    router,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DashboardHero.vue", () => {
  // ── 1. Rendering & props ──────────────────────────────────────────────────

  describe("rendering & props", () => {
    it("mounts without errors", () => {
      expect(mountHero().wrapper.exists()).toBe(true);
    });

    it("displays the team name from currentTeam prop", () => {
      const { wrapper } = mountHero();
      expect(wrapper.find(".team-name").text()).toContain("I Cesarini");
    });

    it("falls back to 'Your Team' when currentTeam prop is null", () => {
      const { wrapper } = mountHero({ currentTeam: null });
      expect(wrapper.find(".team-name").text()).toBe("Your Team");
    });

    it("shows the league name", () => {
      expect(mountHero().wrapper.text()).toContain("Italia League");
    });

    it("shows the league icon", () => {
      const { wrapper } = mountHero();
      expect(wrapper.find(".league-icon").text()).toContain("🍕");
    });

    it("shows the season badge text", () => {
      const { wrapper } = mountHero();
      expect(wrapper.find(".season-badge").text()).toBe("2024");
    });

    it("shows the rank with # prefix in the rank pill", () => {
      const { wrapper } = mountHero();
      expect(wrapper.find(".rank-value").text()).toContain("#4");
    });

    it("shows total players in the rank label", () => {
      const { wrapper } = mountHero();
      expect(wrapper.find(".rank-label").text()).toContain("523");
    });

    it("hides the rank pill when summary is null", () => {
      const { wrapper } = mountHero({ summary: null });
      expect(wrapper.find(".rank-pill").exists()).toBe(false);
    });

    it("renders the hero-wrapper container", () => {
      expect(mountHero().wrapper.find(".hero-wrapper").exists()).toBe(true);
    });
  });

  // ── 2. Featured-card carousel ─────────────────────────────────────────────

  describe("featured-card carousel", () => {
    it("renders the featured-card-wrapper when summary is provided", () => {
      expect(mountHero().wrapper.find(".featured-card-wrapper").exists()).toBe(
        true
      );
    });

    it("does NOT render featured-card-wrapper when summary is null", () => {
      expect(
        mountHero({ summary: null })
          .wrapper.find(".featured-card-wrapper")
          .exists()
      ).toBe(false);
    });

    it("renders the skeleton card when summary is null", () => {
      expect(
        mountHero({ summary: null })
          .wrapper.find(".featured-card--skeleton")
          .exists()
      ).toBe(true);
    });

    it("does not render the skeleton card when summary is provided", () => {
      expect(
        mountHero().wrapper.find(".featured-card--skeleton").exists()
      ).toBe(false);
    });

    it("renders four dot indicators", () => {
      expect(mountHero().wrapper.findAll(".dot").length).toBe(4);
    });

    it("marks the first dot as active on initial render", () => {
      const { wrapper } = mountHero();
      const dots = wrapper.findAll(".dot");
      expect(dots[0].classes()).toContain("dot--active");
      expect(dots[1].classes()).not.toContain("dot--active");
    });

    it("advances to the next stat when the featured card is clicked", async () => {
      const { wrapper } = mountHero();
      await wrapper.find(".featured-card").trigger("click");
      expect(wrapper.findAll(".dot")[1].classes()).toContain("dot--active");
    });

    it("wraps back to the first stat after four clicks", async () => {
      const { wrapper } = mountHero();
      const card = wrapper.find(".featured-card");
      for (let i = 0; i < 4; i++) await card.trigger("click");
      expect(wrapper.findAll(".dot")[0].classes()).toContain("dot--active");
    });

    it("navigates directly to a dot when it is clicked", async () => {
      const { wrapper } = mountHero();
      const dots = wrapper.findAll(".dot");
      await dots[2].trigger("click");
      expect(dots[2].classes()).toContain("dot--active");
      expect(dots[0].classes()).not.toContain("dot--active");
    });

    it("renders three small-stat cards", () => {
      expect(mountHero().wrapper.findAll(".small-stat").length).toBe(3);
    });

    it("clicking a small-stat changes the active dot", async () => {
      const { wrapper } = mountHero();
      await wrapper.findAll(".small-stat")[0].trigger("click");
      expect(wrapper.findAll(".dot")[1].classes()).toContain("dot--active");
    });

    it("shows 'Yesterday's Points' label in the first featured card", () => {
      const { wrapper } = mountHero();
      expect(wrapper.find(".featured-label").text()).toContain(
        "Yesterday's Points"
      );
    });

    it("shows the summary value in the featured-value element", () => {
      const { wrapper } = mountHero();
      expect(wrapper.find(".featured-value").text()).toBe("127");
    });

    it("auto-advances after the configured interval (fake timers)", async () => {
      vi.useFakeTimers();
      const { wrapper } = mountHero();
      expect(wrapper.findAll(".dot")[0].classes()).toContain("dot--active");
      vi.advanceTimersByTime(3500);
      await wrapper.vm.$nextTick();
      expect(wrapper.findAll(".dot")[1].classes()).toContain("dot--active");
      vi.useRealTimers();
    });
  });

  // ── 3. Bell button & badge ────────────────────────────────────────────────

  describe("bell badge", () => {
    it("renders the bell icon button", () => {
      expect(mountHero().wrapper.find(".bell-icon-btn").exists()).toBe(true);
    });

    it("bell-wrapper contains the button", () => {
      expect(
        mountHero().wrapper.find(".bell-wrapper .bell-icon-btn").exists()
      ).toBe(true);
    });

    it("shows a bell-badge after unread notifications resolve via MSW", async () => {
      const { wrapper } = mountHero();
      await flushPromises();
      expect(wrapper.find(".bell-badge").exists()).toBe(true);
    });

    it("bell badge text represents a count greater than zero", async () => {
      const { wrapper } = mountHero();
      await flushPromises();
      const text = wrapper.find(".bell-badge").text();
      // Could be "9+" or a plain digit
      const numeric = parseInt(text, 10);
      if (!isNaN(numeric)) expect(numeric).toBeGreaterThan(0);
      else expect(text).toBe("9+"); // capped display
    });

    it("aria-label on bell button includes the pending count", async () => {
      const { wrapper } = mountHero();
      await flushPromises();
      const label =
        wrapper.find(".bell-icon-btn").attributes("aria-label") ?? "";
      expect(label).toMatch(/Trade inbox – \d+ pending trade proposal/);
    });
  });

  // ── 4. Inbox popover open / close ─────────────────────────────────────────

  describe("inbox popover", () => {
    it("IonPopover isOpen prop starts as false", () => {
      const { wrapper } = mountHero();
      expect(
        wrapper.findComponent({ name: "IonPopover" }).props("isOpen")
      ).toBe(false);
    });

    it("IonPopover isOpen becomes true after bell click", async () => {
      const { wrapper } = mountHero();
      await wrapper.find(".bell-icon-btn").trigger("click");
      expect(
        wrapper.findComponent({ name: "IonPopover" }).props("isOpen")
      ).toBe(true);
    });

    it("IonPopover isOpen returns to false after did-dismiss event", async () => {
      const { wrapper } = mountHero();
      await wrapper.find(".bell-icon-btn").trigger("click");
      await wrapper
        .findComponent({ name: "IonPopover" })
        .trigger("did-dismiss");
      expect(
        wrapper.findComponent({ name: "IonPopover" }).props("isOpen")
      ).toBe(false);
    });

    it("internal inboxOpen ref mirrors popover isOpen", async () => {
      const { wrapper } = mountHero();
      const vm = wrapper.vm as unknown as { inboxOpen: boolean };
      expect(vm.inboxOpen).toBe(false);
      await wrapper.find(".bell-icon-btn").trigger("click");
      expect(vm.inboxOpen).toBe(true);
    });
  });

  // ── 5. Trade proposals via vm state ──────────────────────────────────────

  describe("trade proposals — reactive state", () => {
    it("incomingPending has entries after MSW responds", async () => {
      const { wrapper } = mountHero();
      await flushPromises();
      const vm = wrapper.vm as unknown as {
        incomingPending: Array<{ id: string }>;
      };
      expect(vm.incomingPending.length).toBeGreaterThan(0);
    });

    it("incoming proposals contain expected proposer usernames", async () => {
      const { wrapper } = mountHero();
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
      const { wrapper } = mountHero();
      await flushPromises();
      const vm = wrapper.vm as unknown as {
        incomingPending: unknown[];
        pendingCount: number;
      };
      expect(vm.pendingCount).toBe(vm.incomingPending.length);
    });

    it("calling handleAccept() reduces incomingPending length", async () => {
      const { wrapper } = mountHero();
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
      const { wrapper } = mountHero();
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

  // ── 6. Navigation ─────────────────────────────────────────────────────────

  describe("navigation", () => {
    it("renders the Buy Articles button", () => {
      const { wrapper } = mountHero();
      expect(
        wrapper
          .findAll("ion-button")
          .some((b) => b.text().includes("Buy Articles"))
      ).toBe(true);
    });

    //TODO: Re-enable when market is implemented
    /*it("navigates to /market when Buy Articles is clicked", async () => {
      // Each navigation test gets its own router — no shared state with other tests
      const testRouter = makeRouter();
      await testRouter.push("/");
      await testRouter.isReady();

      const { wrapper } = mountHero({}, testRouter);

      const buyBtn = wrapper
        .findAll("ion-button")
        .find((b) => b.text().includes("Buy Articles"));

      await buyBtn!.trigger("click");
      await testRouter.isReady();

      expect(testRouter.currentRoute.value.path).toBe("/market");
    });*/
  });
});
