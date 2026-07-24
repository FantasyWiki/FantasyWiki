import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import PageReveal from "@/components/PageReveal.vue";

// Six slotted children by default; a couple of tests override the count.
function slotOf(n: number): string {
  return Array.from({ length: n }, () => "<div class='child' />").join("");
}

function mountReveal(opts: { when?: boolean; children?: number } = {}) {
  return mount(PageReveal, {
    props: opts.when === undefined ? {} : { when: opts.when },
    slots: { default: slotOf(opts.children ?? 4) },
  });
}

/** Inline --reveal-index the component wrote on the nth direct child. */
function indexOf(wrapper: ReturnType<typeof mountReveal>, n: number): string {
  const child = wrapper.element.children[n] as HTMLElement;
  return child.style.getPropertyValue("--reveal-index");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PageReveal.vue", () => {
  it("arms (hides) its children on mount", () => {
    const wrapper = mountReveal({ when: false });

    // Armed is the JS-applied hidden state; the reveal is still pending.
    expect(wrapper.classes()).toContain("page-reveal--armed");
    expect(wrapper.classes()).not.toContain("page-reveal--revealed");
  });

  it("releases once `when` turns true", async () => {
    const wrapper = mountReveal({ when: false });
    expect(wrapper.classes()).not.toContain("page-reveal--revealed");

    await wrapper.setProps({ when: true });
    await nextTick();

    expect(wrapper.classes()).toContain("page-reveal--revealed");
  });

  it("reveals on mount when `when` is omitted", () => {
    const wrapper = mountReveal();

    // No signal to wait for: the mount default fires straight away.
    expect(wrapper.classes()).toContain("page-reveal--armed");
    expect(wrapper.classes()).toContain("page-reveal--revealed");
  });

  it("assigns a DOM-order index to each child", () => {
    const wrapper = mountReveal({ when: false, children: 4 });

    expect(indexOf(wrapper, 0)).toBe("0");
    expect(indexOf(wrapper, 1)).toBe("1");
    expect(indexOf(wrapper, 2)).toBe("2");
    expect(indexOf(wrapper, 3)).toBe("3");
  });

  it("clamps the index so late children share the last step", () => {
    const wrapper = mountReveal({ when: false, children: 10 });

    // Seven distinct steps (0–6); everything past the seventh child sits on 6.
    expect(indexOf(wrapper, 6)).toBe("6");
    expect(indexOf(wrapper, 7)).toBe("6");
    expect(indexOf(wrapper, 9)).toBe("6");
  });

  it("does nothing under reduced motion", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      const wrapper = mountReveal({ when: false });

      // No hiding, so the worst case is a plainly visible page.
      expect(wrapper.classes()).not.toContain("page-reveal--armed");
      expect(wrapper.classes()).not.toContain("page-reveal--revealed");
      expect(indexOf(wrapper, 0)).toBe("");
    } finally {
      window.matchMedia = original;
    }
  });

  it("reveals anyway after the safety window when `when` never resolves", async () => {
    vi.useFakeTimers();
    const wrapper = mountReveal({ when: false });
    expect(wrapper.classes()).not.toContain("page-reveal--revealed");

    // A `when` that never turns true must not hold the page hidden forever.
    await vi.advanceTimersByTimeAsync(2000);

    expect(wrapper.classes()).toContain("page-reveal--revealed");
  });
});
