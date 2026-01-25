import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import LeaderboardPreview from "@/views/home-page/LeaderboardPreview.vue";

describe("home-page/LeaderboardPreview.vue", () => {
  it("should mount without any console errors or warnings", () => {
    router.push("/");
    router.isReady().then(() => {
      const wrapper = mount(LeaderboardPreview, {
        global: {
          plugins: [router],
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });
});
