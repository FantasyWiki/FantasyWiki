import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import TeamCreationForm from "@/components/TeamCreationForm.vue";
import { leagues } from "@/mocks/data/leagues";
import { TeamDTO } from "../../../dto/teamDTO";

// The real toast needs Ionic's overlay lifecycle to settle, which jsdom's
// microtask queue alone will not do; stubbed so the success path resolves.
vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ showSuccess: vi.fn().mockResolvedValue(undefined) }),
}));

const italy = leagues.find((l) => l.id === "italy")!;

function mountForm() {
  return mount(TeamCreationForm, { props: { league: italy } });
}

async function submitName(wrapper: VueWrapper, name: string) {
  const input = wrapper.find("ion-input");
  (input.element as unknown as { value: string }).value = name;
  await input.trigger("ionInput");
  await wrapper.find("form").trigger("submit");
  await flushPromises();
}

/**
 * The form is the piece reused for every league a player enters, so its
 * contract is asserted here rather than only through whichever page hosts it:
 * the league comes in as a prop, the created team goes out as an event, and
 * nothing in between navigates or decides which league this is.
 */
describe("TeamCreationForm.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("names the league it was handed, without looking one up", async () => {
    let globalWasFetched = false;
    server.use(
      http.get("*/api/leagues/global", () => {
        globalWasFetched = true;
        return HttpResponse.json(leagues[0]);
      })
    );

    const wrapper = mountForm();
    await flushPromises();

    expect(wrapper.text()).toContain("Italia League");
    expect(wrapper.text()).toContain("🍕");
    expect(globalWasFetched).toBe(false);
  });

  // jsdom neither scrolls on focus nor runs Ionic's real input, so the visible
  // outcome (the welcome intro staying on screen on a phone) is not observable
  // here — the attribute that causes it is.
  it("does not steal focus on load", async () => {
    const wrapper = mountForm();
    await flushPromises();

    expect(wrapper.find("ion-input").attributes("autofocus")).toBeUndefined();
  });

  it("posts to the league it was handed and emits the created team", async () => {
    let postedTo = "";
    server.use(
      http.post("*/api/leagues/:leagueId/my-team", ({ params }) => {
        postedTo = params.leagueId as string;
        return HttpResponse.json(
          { id: "team-9", name: "I Maghi", player: null, credits: 1000 },
          { status: 201 }
        );
      })
    );

    const wrapper = mountForm();
    await submitName(wrapper, "I Maghi");

    expect(postedTo).toBe("italy");

    // The team object, not the name: the host needs the created team, and a
    // string here would type-check at the emit site but break every consumer.
    const emitted = wrapper.emitted("created");
    expect(emitted).toHaveLength(1);
    expect((emitted![0][0] as TeamDTO).id).toBe("team-9");
  });

  it("rejects a name that is too short without calling the API", async () => {
    let posted = false;
    server.use(
      http.post("*/api/leagues/:leagueId/my-team", () => {
        posted = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );

    const wrapper = mountForm();
    await submitName(wrapper, "ab");

    expect(wrapper.text()).toContain("at least 3 characters");
    expect(posted).toBe(false);
    expect(wrapper.emitted("created")).toBeUndefined();
  });

  it("surfaces the API error and stays on the form", async () => {
    server.use(
      http.post("*/api/leagues/:leagueId/my-team", () =>
        HttpResponse.json(
          { error: "This team name is already taken in this league." },
          { status: 400 }
        )
      )
    );

    const wrapper = mountForm();
    await submitName(wrapper, "I Maghi");

    expect(wrapper.text()).toContain(
      "This team name is already taken in this league."
    );
    expect(wrapper.emitted("created")).toBeUndefined();
  });
});
