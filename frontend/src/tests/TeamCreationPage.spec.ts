import { describe, it, expect } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import router from "@/router/index";
import TeamCreationPage from "@/views/TeamCreationPage.vue";

describe("TeamCreationPage.vue", () => {
  it("should mount without any console errors or warnings", async () => {
    await router.push("/");
    await router.isReady();
    const wrapper = mount(TeamCreationPage, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it("loads the Global League from /api/leagues/global and shows it", async () => {
    await router.push("/");
    await router.isReady();

    const wrapper = mount(TeamCreationPage, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Global League");
    expect(wrapper.text()).toContain("🌍");
  });

  it("shows an error message and re-enables the form when team creation fails", async () => {
    server.use(
      http.post("*/api/leagues/:leagueId/team", () =>
        HttpResponse.json(
          { error: "This team name is already taken in this league." },
          { status: 400 }
        )
      )
    );

    await router.push("/");
    await router.isReady();

    const wrapper = mount(TeamCreationPage, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    const input = wrapper.find("ion-input");
    (input.element as unknown as { value: string }).value = "The Wiki Wizards";
    await input.trigger("ionInput");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain(
      "This team name is already taken in this league."
    );
  });
});
