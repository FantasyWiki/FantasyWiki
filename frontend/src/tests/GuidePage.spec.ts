import { describe, it, expect, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import router from "@/router/index";
import GuidePage from "@/views/GuidePage.vue";
import { useAppStore } from "@/stores/app";
import { basePoints } from "../../../model/scoring";
import { TIER_DAYS } from "../../../model/pricing";

let pinia: Pinia;

async function mountGuide() {
  await router.push("/guide");
  await router.isReady();
  const wrapper = mount(GuidePage, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return wrapper;
}

describe("GuidePage.vue", () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("mounts without a session, since the route is public", async () => {
    const wrapper = await mountGuide();

    expect(wrapper.text()).toContain("How FantasyWiki works");
  });

  it("gets the direction of scoring right: points from today, price from the month", async () => {
    const wrapper = await mountGuide();
    const text = wrapper.text();

    expect(text).toContain("Points follow today, prices follow the month");
    expect(text).toContain("You score on yesterday's readers");
    expect(text).toContain("Priced on");
  });

  it("draws its numbers from the game model rather than from copy", async () => {
    const wrapper = await mountGuide();
    const text = wrapper.text();

    // The contract tiers a player can actually buy.
    for (const days of Object.values(TIER_DAYS)) {
      expect(text).toContain(String(days));
    }
    // 32,000 readers is worth 4 points on the real curve, and the day-loop
    // figure says so.
    expect(Math.round(basePoints(32_000))).toBe(4);
    expect(text).toContain("4 points");
  });

  it("teaches the rules without leaking why they were designed that way", async () => {
    const wrapper = await mountGuide();
    const text = wrapper.text().toLowerCase();

    for (const tell of [
      "deliberate",
      "we chose",
      "the reason",
      "designed",
      "formula",
      "exponent",
    ]) {
      expect(text).not.toContain(tell);
    }
  });

  it("offers the tour to a signed-in player and a sign-in to everyone else", async () => {
    const anonymous = await mountGuide();
    expect(anonymous.text()).toContain("Sign in to play");

    useAppStore().setUserFromData({
      sub: "player-1",
      email: "player@example.com",
      name: "Player One",
      picture: "",
      features: { articleGenie: false },
    });
    const player = await mountGuide();

    // Ionic renders the routerLink prop onto the custom element as a plain
    // lowercase attribute.
    expect(player.get(".guide-foot ion-button").attributes("routerlink")).toBe(
      "/dashboard?tour=1"
    );
  });
});
