import { describe, it, expect } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import router from "@/router/index";
import AuthCallbackPage from "@/views/auth/AuthCallbackPage.vue";

function mockSession() {
  server.use(
    http.get("*/api/session", () =>
      HttpResponse.json({
        sub: "player-1",
        email: "player@example.com",
        name: "Player One",
        picture: "",
      })
    )
  );
}

/** A brand-new player is in no league yet — the default fixture hands out all
 * of them, which would make the team-creation guard bounce them. */
function mockNoLeagues() {
  server.use(http.get("*/api/leagues", () => HttpResponse.json([])));
}

describe("AuthCallbackPage.vue", () => {
  it("sends a brand-new player to team creation, which is where the game starts", async () => {
    mockSession();
    mockNoLeagues();
    await router.push({ path: "/auth/callback", query: { new: "1" } });
    await router.isReady();

    mount(AuthCallbackPage, { global: { plugins: [router] } });
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/team-creation");
  });

  it("sends a returning player straight home", async () => {
    mockSession();
    await router.push({ path: "/auth/callback" });
    await router.isReady();

    mount(AuthCallbackPage, { global: { plugins: [router] } });
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/home");
  });
});
