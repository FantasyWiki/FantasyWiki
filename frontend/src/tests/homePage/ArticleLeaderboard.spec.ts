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
      getViewsByDomain: mockGetViewsByDomain,
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
});
