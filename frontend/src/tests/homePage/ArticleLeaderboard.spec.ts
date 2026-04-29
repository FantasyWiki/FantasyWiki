import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import ArticleLeaderboard from "@/components/homePage/ArticleLeaderboard.vue";
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";

describe("ArticleLeaderboard.vue", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders Wikimedia top-read entries with daily and 30d average views", async () => {
    router.push("/");
    await router.isReady();

    const wrapper = mount(ArticleLeaderboard, {
      global: {
        plugins: [router],
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).not.toContain("Article Title 1");
    expect(wrapper.text()).toContain("ChatGPT");
    expect(wrapper.text()).toContain("Avg: 1.5K/day");
    expect(wrapper.text()).toContain("3.0K");
  });

  it("shows non-blocking unavailable message when Wikimedia data fails", async () => {
    server.use(
      http.get(
        "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/:project/all-access/:year/:month/:day",
        () => HttpResponse.json({ error: "upstream down" }, { status: 503 })
      )
    );

    router.push("/");
    await router.isReady();
    const wrapper = mount(ArticleLeaderboard, {
      global: {
        plugins: [router],
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.text()).toContain("Top article data unavailable right now.");
  });
});
