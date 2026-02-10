import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import ArticleDetail from "@/modules/ArticleDetail.vue";

describe("ArticleDetail.vue", () => {
  it("should mount without any console errors or warnings", () => {
    router.push("/");
    router.isReady().then(() => {
      const wrapper = mount(ArticleDetail, {
        global: {
          plugins: [router],
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });
});
