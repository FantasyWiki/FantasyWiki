import { describe, it, expect, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import router from "@/router/index";
import HeroSection from "@/components/homePage/HeroSection.vue";

const { mockGetTopReadList } = vi.hoisted(() => ({
  mockGetTopReadList: vi.fn(),
}));

vi.mock("@/services/wikimediaClient", () => ({
  createWikimediaClient: () => ({
    pageviews: {
      getTopReadList: mockGetTopReadList,
    },
  }),
}));

describe("home-page/HeroSection.vue", () => {
  it("updates the floating badge with filtered snapshot volume", async () => {
    mockGetTopReadList.mockResolvedValue({
      projectDomain: "en.wikipedia",
      snapshotDate: "2026-04-27",
      filteredSnapshotVolume: 1_200_000,
      entries: [],
    });

    window.localStorage.clear();
    router.push("/");
    await router.isReady();
    const wrapper = mount(HeroSection, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain("Over 1.2M views today");
  });
});
