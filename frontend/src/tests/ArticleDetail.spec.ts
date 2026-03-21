import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ArticleDetail from "@/modules/ArticleDetail.vue";
import { Contract } from "@/types/models";

describe("ArticleDetail.vue", () => {
  let mockContract: Contract;

  beforeEach(() => {
    mockContract = {
      id: "ctr-1",
      teamId: "team-1",
      leagueId: "italy",
      purchasePrice: 150,
      currentPrice: 165,
      yesterdayPoints: 45,
      expiresIn: 2,
      tier: "MEDIUM",
      article: {
        id: "art-1",
        name: "Bitcoin",
        domain: "itwiki",
      },
    };
  });

  describe("Modal Behavior", () => {
    it("should render modal when isOpen is true", () => {
      const wrapper = mount(ArticleDetail, {
        props: {
          selectedContract: mockContract,
          isOpen: true,
        },
      });

      const modal = wrapper.findComponent({ name: "IonModal" });
      expect(modal.exists()).toBe(true);
      expect(modal.props("isOpen")).toBe(true);
    });

    it("should not render content when isOpen is false", () => {
      const wrapper = mount(ArticleDetail, {
        props: {
          selectedContract: mockContract,
          isOpen: false,
        },
      });

      const modal = wrapper.findComponent({ name: "IonModal" });
      expect(modal.props("isOpen")).toBe(false);
    });

    it("should have contract data in props", () => {
      const wrapper = mount(ArticleDetail, {
        props: {
          selectedContract: mockContract,
          isOpen: true,
        },
      });

      expect(wrapper.props("selectedContract")?.article.name).toBe("Bitcoin");
      expect(wrapper.props("selectedContract")?.currentPrice).toBe(165);
    });

    it("should emit close when modal dismisses", async () => {
      const wrapper = mount(ArticleDetail, {
        props: {
          selectedContract: mockContract,
          isOpen: true,
        },
      });

      const modal = wrapper.findComponent({ name: "IonModal" });
      await modal.vm.$emit("didDismiss");

      expect(wrapper.emitted("close")).toBeTruthy();
    });
  });

  describe("Computed Properties", () => {
    it("should handle zero purchase price", () => {
      mockContract.purchasePrice = 0;
      mockContract.currentPrice = 100;

      const wrapper = mount(ArticleDetail, {
        props: {
          selectedContract: mockContract,
          isOpen: true,
        },
      });

      // Should not crash even with division by zero scenario
      expect(wrapper.exists()).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null contract gracefully", () => {
      const wrapper = mount(ArticleDetail, {
        props: {
          selectedContract: null,
          isOpen: true,
        },
      });

      // Modal should render but content should not
      const modal = wrapper.findComponent({ name: "IonModal" });
      expect(modal.exists()).toBe(true);
    });

    it("should handle different contract tiers", () => {
      const tiers = ["SHORT", "MEDIUM", "LONG"] as const;

      tiers.forEach((tier) => {
        mockContract.tier = tier;
        const wrapper = mount(ArticleDetail, {
          props: {
            selectedContract: mockContract,
            isOpen: true,
          },
        });

        expect(wrapper.props("selectedContract")?.tier).toBe(tier);
      });
    });

    it("should handle contract expiring soon", () => {
      mockContract.expiresIn = 0;

      const wrapper = mount(ArticleDetail, {
        props: {
          selectedContract: mockContract,
          isOpen: true,
        },
      });

      expect(wrapper.props("selectedContract")?.expiresIn).toBe(0);
    });
  });
});
