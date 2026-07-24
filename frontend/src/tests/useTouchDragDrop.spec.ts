import { describe, it, expect } from "vitest";
import { resolveDrop } from "@/composables/useTouchDragDrop";

/**
 * `resolveDrop` is the pure hit-test decision behind the touch long-press
 * drag: given the element under the finger at drop time, decide swap /
 * moveToEmpty / no-op. It is deliberately DOM-geometry-free (no
 * elementFromPoint/getBoundingClientRect), so it is tested here directly
 * against plain elements — the geometry and gesture timing themselves can
 * only be verified with real touch emulation in a browser.
 */
describe("resolveDrop", () => {
  it("resolves to a swap when dropped on another article", () => {
    const wrapper = document.createElement("button");
    wrapper.setAttribute("data-article-id", "contract-2");
    const target = document.createElement("span");
    wrapper.appendChild(target);

    const { decision, element, hoverClass } = resolveDrop(target, "contract-1");

    expect(decision).toEqual({ kind: "swap", targetId: "contract-2" });
    expect(element).toBe(wrapper);
    expect(hoverClass).toBe("article-node--dragover");
  });

  it("resolves to no-op when dropped on itself", () => {
    const target = document.createElement("button");
    target.setAttribute("data-article-id", "contract-1");

    const { decision, element } = resolveDrop(target, "contract-1");

    expect(decision).toEqual({ kind: "none" });
    expect(element).toBeNull();
  });

  it("resolves to moveToEmpty when dropped on an empty pitch slot", () => {
    const slot = document.createElement("div");
    slot.setAttribute("data-position", "ST");
    const label = document.createElement("span");
    slot.appendChild(label);

    const { decision, element, hoverClass } = resolveDrop(label, "contract-1");

    expect(decision).toEqual({ kind: "moveToEmpty", position: "ST" });
    expect(element).toBe(slot);
    expect(hoverClass).toBe("pitch-slot-empty--dragover");
  });

  it("prefers the article match over an ancestor position when the slot is filled", () => {
    const slot = document.createElement("div");
    slot.setAttribute("data-position", "ST");
    const articleButton = document.createElement("button");
    articleButton.setAttribute("data-article-id", "contract-2");
    slot.appendChild(articleButton);

    const { decision } = resolveDrop(articleButton, "contract-1");

    expect(decision).toEqual({ kind: "swap", targetId: "contract-2" });
  });

  it("resolves to no-op when dropped outside any known target", () => {
    const outside = document.createElement("div");

    const { decision, element } = resolveDrop(outside, "contract-1");

    expect(decision).toEqual({ kind: "none" });
    expect(element).toBeNull();
  });

  it("resolves to no-op when there is nothing under the finger", () => {
    const { decision } = resolveDrop(null, "contract-1");

    expect(decision).toEqual({ kind: "none" });
  });
});
