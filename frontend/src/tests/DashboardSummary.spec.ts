/**
 * DashboardSummary.vue — unit tests
 *
 * Key facts about the component:
 * - `maxContracts` is hardcoded as 18 inside the component (not a prop).
 * - When `summaryData` is null the component renders IonSkeletonText placeholders;
 *   the four IonCard elements are always present.
 * - IonChip is a web-component stub in jsdom — `.attributes("color")` returns
 *   undefined.  The template binds `:color="..."` as a prop, visible via
 *   `wrapper.findComponent({ name: 'IonChip' }).props('color')`.
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DashboardSummary from "@/modules/TeamDashboard/DashboardSummary.vue";
import type { DashboardSummary as DashboardSummaryType } from "@/types/models";

// ── Fixture ────────────────────────────────────────────────────────────────────

const fullSummary: DashboardSummaryType = {
  yesterdayPoints: 127,
  pointsChange: 12.5,
  rank: 4,
  totalPlayers: 523,
  credits: 550,
  portfolioValue: 1000,
  activeContracts: 4,
  maxContracts: 18,
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("DashboardSummary.vue", () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  it("mounts without errors with full data", () => {
    expect(
      mount(DashboardSummary, { props: { summaryData: fullSummary } }).exists()
    ).toBe(true);
  });

  it("mounts without errors when summaryData is null (skeleton mode)", () => {
    expect(
      mount(DashboardSummary, { props: { summaryData: null } }).exists()
    ).toBe(true);
  });

  it("always renders four IonCard elements regardless of data", () => {
    const withData = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    const withNull = mount(DashboardSummary, { props: { summaryData: null } });
    expect(withData.findAllComponents({ name: "IonCard" }).length).toBe(4);
    expect(withNull.findAllComponents({ name: "IonCard" }).length).toBe(4);
  });

  // ── Skeleton state (null data) ─────────────────────────────────────────────

  it("renders IonSkeletonText elements when summaryData is null", () => {
    const wrapper = mount(DashboardSummary, { props: { summaryData: null } });
    expect(
      wrapper.findAllComponents({ name: "IonSkeletonText" }).length
    ).toBeGreaterThan(0);
  });

  it("does NOT render IonSkeletonText when summaryData is provided", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    expect(wrapper.findAllComponents({ name: "IonSkeletonText" }).length).toBe(
      0
    );
  });

  // ── Yesterday's Points ─────────────────────────────────────────────────────

  it("displays yesterdayPoints value", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    expect(wrapper.text()).toContain("127");
  });

  it("displays pointsChange with '+' prefix for positive values", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    expect(wrapper.text()).toContain("+12.5%");
  });

  it("displays pointsChange without '+' prefix for negative values", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: { ...fullSummary, pointsChange: -5.2 } },
    });
    expect(wrapper.text()).toContain("-5.2%");
    expect(wrapper.text()).not.toContain("+-5.2%");
  });

  it("uses a 'success' colour prop on IonChip for positive pointsChange", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    // IonChip is a stub — read the bound prop, not the HTML attribute
    const chip = wrapper.findComponent({ name: "IonChip" });
    expect(chip.props("color")).toBe("success");
  });

  it("uses a 'danger' colour prop on IonChip for negative pointsChange", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: { ...fullSummary, pointsChange: -3 } },
    });
    const chip = wrapper.findComponent({ name: "IonChip" });
    expect(chip.props("color")).toBe("danger");
  });

  // ── League Standing ────────────────────────────────────────────────────────

  it("displays the rank prefixed with #", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    expect(wrapper.text()).toContain("#4");
  });

  it("displays the total player count", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    expect(wrapper.text()).toContain("of 523 players");
  });

  // ── Credits ────────────────────────────────────────────────────────────────

  it("displays the credits value", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    expect(wrapper.text()).toContain("550");
  });

  it("displays the portfolio value with 'Cr' suffix", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    expect(wrapper.text()).toContain("Portfolio: 1000 Cr");
  });

  // ── Active Contracts ───────────────────────────────────────────────────────

  it("displays activeContracts / hardcoded max 18", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    expect(wrapper.text()).toContain("4/18");
  });

  it("calculates remaining slots correctly (18 - activeContracts)", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    expect(wrapper.text()).toContain("14 slots available");
  });

  it("shows 0 slots available when activeContracts equals 18", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: { ...fullSummary, activeContracts: 18 } },
    });
    expect(wrapper.text()).toContain("18/18");
    expect(wrapper.text()).toContain("0 slots available");
  });

  // ── Section labels ─────────────────────────────────────────────────────────

  it("renders all four section labels", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: fullSummary },
    });
    const text = wrapper.text();
    expect(text).toContain("Yesterday's Points");
    expect(text).toContain("League Standing");
    expect(text).toContain("Available Credits");
    expect(text).toContain("Active Contracts");
  });
});
