import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import BuyTierPicker from "@/components/articleDetail/BuyTierPicker.vue";
import type { TierPriceOption } from "@/types/articleDetail";

const options: TierPriceOption[] = [
  { tier: "SHORT", price: 100 },
  { tier: "MEDIUM", price: 200 },
  { tier: "LONG", price: 350 },
];

describe("BuyTierPicker.vue", () => {
  it("shows the price for the selected tier", () => {
    const wrapper = mount(BuyTierPicker, {
      props: {
        options,
        selectedTier: "MEDIUM",
        viewerCredits: 1000,
      },
    });

    expect(wrapper.text()).toContain("200 credits");
    expect(wrapper.text()).not.toContain("Not enough credits");
  });

  it("flags when the selected tier's price exceeds viewer credits", () => {
    const wrapper = mount(BuyTierPicker, {
      props: {
        options,
        selectedTier: "LONG",
        viewerCredits: 100,
      },
    });

    expect(wrapper.text()).toContain("350 credits");
    expect(wrapper.text()).toContain("Not enough credits");
  });
});
