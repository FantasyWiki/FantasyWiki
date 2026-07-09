import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import InfoFooter from "@/layout/InfoFooter.vue";

describe("InfoFooter.vue", () => {
  it("shows repository, issues and legal links", async () => {
    await router.push("/");
    await router.isReady();

    const wrapper = mount(InfoFooter, {
      global: { plugins: [router] },
    });

    const hrefs = wrapper.findAll("a").map((a) => a.attributes("href"));
    expect(hrefs).toContain("https://github.com/FantasyWiki/FantasyWiki");
    expect(hrefs).toContain(
      "https://github.com/FantasyWiki/FantasyWiki/issues"
    );
    expect(wrapper.find("a[href='/legal']").exists()).toBe(true);
  });

  it("credits both authors", async () => {
    await router.push("/");
    await router.isReady();

    const wrapper = mount(InfoFooter, {
      global: { plugins: [router] },
    });

    expect(wrapper.text()).toContain("Marco Galeri");
    expect(wrapper.text()).toContain("Luca Patrignani");
  });
});
