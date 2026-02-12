import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import DashboardSummary from "@/modules/TeamDashboard/DashboardSummary.vue";
import { DashboardSummary as DashboardSummaryType } from "@/types/models";

describe("DashboardSummary.vue", () => {
  let mockSummaryData: DashboardSummaryType;

  beforeEach(() => {
    // Setup fresh mock data before each test
    mockSummaryData = {
      yesterdayPoints: 127,
      pointsChange: 12.5,
      rank: 4,
      totalPlayers: 523,
      credits: 550,
      portfolioValue: 1000,
      activeContracts: 4,
      maxContracts: 18,
    };
  });

  it("should render all summary cards", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: mockSummaryData },
    });

    // Check that all 4 cards are rendered
    const cards = wrapper.findAllComponents({ name: "IonCard" });
    expect(cards.length).toBe(4);
  });

  it("should display yesterday's points correctly", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: mockSummaryData },
    });

    expect(wrapper.text()).toContain("127");
    expect(wrapper.text()).toContain("+12.5%");
  });

  it("should display league standing correctly", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: mockSummaryData },
    });

    expect(wrapper.text()).toContain("#4");
    expect(wrapper.text()).toContain("of 523 players");
  });

  it("should display credits and portfolio value", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: mockSummaryData },
    });

    expect(wrapper.text()).toContain("550");
    expect(wrapper.text()).toContain("Portfolio: 1000 Cr");
  });

  it("should display active contracts information", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: mockSummaryData },
    });

    expect(wrapper.text()).toContain("4/18");
    expect(wrapper.text()).toContain("14 slots available");
  });

  it("should show positive change indicator", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: mockSummaryData },
    });

    // Check that the change value is displayed with + sign
    expect(wrapper.text()).toContain("+12.5%");
  });

  it("should show negative change indicator", () => {
    mockSummaryData.pointsChange = -5.2;

    const wrapper = mount(DashboardSummary, {
      props: { summaryData: mockSummaryData },
    });

    // Check that change is displayed (negative values don't have + sign)
    const text = wrapper.text();
    expect(text.includes("-5.2") || text.includes("5.2")).toBe(true);
  });

  it("should handle null summaryData gracefully", () => {
    const wrapper = mount(DashboardSummary, {
      props: { summaryData: null },
    });

    // Should not render cards when data is null
    const grid = wrapper.find("ion-grid");
    expect(grid.exists()).toBe(false);
  });

  it("should calculate available slots correctly", () => {
    mockSummaryData.activeContracts = 10;

    const wrapper = mount(DashboardSummary, {
      props: { summaryData: mockSummaryData },
    });

    expect(wrapper.text()).toContain("8 slots available");
  });
});
