import { describe, it, expect, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import TeamFormation from "@/components/formation/TeamFormation.vue";
import { mockFullFormation433 } from "@/mocks/formationMocks";
import {
  createChemistryLinks,
  DraftFormationDTO,
  FormationDTO,
} from "../../../../dto/formationDTO";

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const stubs = {
  IonCard: { template: "<div><slot /></div>" },
  IonChip: { template: "<div><slot /></div>" },
  IonIcon: true,
  IonLabel: { template: "<span><slot /></span>" },
  IonButton: { template: "<button><slot /></button>" },
  ArticleNode: {
    template: "<div class='article-node-stub' v-bind=\"$attrs\"></div>",
  },
};

describe("TeamFormation.vue chemistry rendering", () => {
  it("renders the schema chemistry lines for a filled formation", async () => {
    const chemistry = createChemistryLinks("4-3-3").map((link) =>
      link.from === "LW" && link.to === "ST" ? { ...link, level: "good" } : link
    );
    const formation = { ...mockFullFormation433, chemistry };

    const wrapper = mount(TeamFormation, {
      props: { formation: formation as FormationDTO },
      global: { stubs },
    });

    await nextTick();

    expect(wrapper.findAll("line.chem-line")).toHaveLength(chemistry.length);
    expect(wrapper.findAll(".chem-line--good")).toHaveLength(1);
  });

  it("renders empty-level styling when a chemistry link has a missing slot", async () => {
    const chemistry = createChemistryLinks("4-3-3").map((link) =>
      link.from === "LW" && link.to === "ST" ? { ...link, level: "good" } : link
    );
    const formation: Partial<typeof mockFullFormation433.formation> = {
      ...mockFullFormation433.formation,
    };
    delete formation.ST;
    const draft = {
      date: mockFullFormation433.date,
      schema: "4-3-3" as const,
      formation,
      chemistry,
    } as DraftFormationDTO<"4-3-3">;

    const wrapper = mount(TeamFormation, {
      props: { formation: draft },
      global: { stubs },
    });

    await nextTick();

    expect(wrapper.findAll(".chem-line--good")).toHaveLength(0);
    expect(wrapper.findAll(".chem-line--empty")).toHaveLength(chemistry.length);
  });
});
