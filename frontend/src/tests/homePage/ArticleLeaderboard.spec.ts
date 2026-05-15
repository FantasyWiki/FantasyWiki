import { describe, it, expect, beforeEach, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import router from "@/router/index";
import ArticleLeaderboard from "@/components/homePage/ArticleLeaderboard.vue";

const { mockGetTopReadList } = vi.hoisted(() => ({
  mockGetTopReadList: vi.fn(),
}));
const { mockGetViewsByDomain } = vi.hoisted(() => ({
    mockGetViewsByDomain: vi.fn(),
}));


vi.mock("@/services/wikimediaClient", () => ({
  createWikimediaClient: () => ({
    pageviews: {
      getTopReadList: mockGetTopReadList,
        getViewsByDomain: mockGetViewsByDomain

    },
  }),
}));

describe("ArticleLeaderboard.vue", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGetTopReadList.mockReset();
  });

  it("shows loading placeholder before the first Wikimedia response", async () => {
    mockGetTopReadList.mockResolvedValue({
      projectDomain: "en.wikipedia",
      snapshotDate: "2026-04-27",
      filteredSnapshotVolume: 6000,
      entries: [],
    });

    router.push("/");
    await router.isReady();

    const wrapper = mount(ArticleLeaderboard, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.find(".loading-message").exists()).toBe(true);
    expect(wrapper.text()).not.toContain(
      "Top article data unavailable right now."
    );

    await flushPromises();
  });

  it("renders Wikimedia top-read entries with daily and 30d average views", async () => {
    mockGetTopReadList.mockResolvedValue({
      projectDomain: "en.wikipedia",
      snapshotDate: "2026-04-27",
      filteredSnapshotVolume: 6000,
      entries: [
        {
          canonicalTitle: "ChatGPT",
          displayTitle: "ChatGPT",
          sourceRank: 3,
          filteredRank: 1,
          dailyViews: 3000,
          articleUrl: "https://en.wikipedia.org/wiki/ChatGPT",
          averageViews30d: 1500,
        },
      ],
    });

    router.push("/");
    await router.isReady();

    const wrapper = mount(ArticleLeaderboard, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    expect(wrapper.text()).not.toContain("Article Title 1");
    expect(wrapper.text()).toContain("ChatGPT");
    expect(wrapper.text()).toContain("Avg: 1.5K/day");
    expect(wrapper.text()).toContain("3.0K");
  });

  it("shows non-blocking unavailable message when Wikimedia data fails", async () => {
    mockGetTopReadList.mockRejectedValue(new Error("upstream down"));

    router.push("/");
    await router.isReady();
    const wrapper = mount(ArticleLeaderboard, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();
    expect(wrapper.text()).toContain("Top article data unavailable right now.");
  });

    it("updates the floating badge with filtered snapshot volume", async () => {
        mockGetViewsByDomain.mockResolvedValue({
            domain: "en",
            snapshotDate: "2026-04-27",
            views: 1_200_000,
        });

        window.localStorage.clear();
        router.push("/");
        await router.isReady();
        const wrapper = mount(ArticleLeaderboard, {
            global: {
                plugins: [router],
            },
        });

        await flushPromises();

        expect(wrapper.exists()).toBe(true);
        expect(wrapper.text()).toContain("Over 1.2M views today");
    });
});
