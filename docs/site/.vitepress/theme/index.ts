import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";

import Mermaid from "./components/Mermaid.vue";
import DocNeighbourhood from "./components/DocNeighbourhood.vue";
import DocsAtlas from "./components/DocsAtlas.vue";
import CoverageBoard from "./components/CoverageBoard.vue";
import ApiBoard from "./components/ApiBoard.vue";
import Glossary from "./components/Glossary.vue";
import Planned from "./components/Planned.vue";
import Figure from "./components/Figure.vue";
import SwaggerUi from "./components/SwaggerUi.vue";

import "./style.css";

/**
 * A publish replaces every hashed chunk on the site at once, and a tab opened
 * before it — or served stale HTML by a cache that has not caught up — goes on
 * asking for chunks that are no longer there. Nothing on the page says so: the
 * prose is already in the HTML, so only what is fetched on demand fails, and
 * every figure turns into "this diagram failed to render" while the article
 * around it looks perfectly healthy.
 *
 * Vite announces that as `vite:preloadError`. Reloading gets the current HTML,
 * which names chunks that exist. Once per tab, because a reload that does not
 * fix it must not become a loop — after that the figures report the failure
 * themselves, with their source and a way to ask again.
 */
const RELOADED = "fw-reloaded-for-a-stale-deployment";

function healStaleDeployments() {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", () => {
    try {
      if (sessionStorage.getItem(RELOADED)) return;
      sessionStorage.setItem(RELOADED, "1");
    } catch {
      // A window that refuses the write is a window that cannot remember
      // having reloaded, and a reload it cannot remember is a reload it will
      // do again on the next failure. The figures report the failure instead.
      return;
    }
    window.location.reload();
  });
}

healStaleDeployments();

export default {
  extends: DefaultTheme,

  // Every document ends with its own neighbourhood. It is a slot rather than a
  // per-page component so that the mirrored docs stay untouched markdown — the
  // moment a canonical doc has to carry a site component, the mirror has
  // stopped being a mirror.
  Layout: () => h(DefaultTheme.Layout, null, { "doc-after": () => h(DocNeighbourhood) }),

  enhanceApp({ app }) {
    app.component("Mermaid", Mermaid);
    app.component("DocsAtlas", DocsAtlas);
    app.component("CoverageBoard", CoverageBoard);
    app.component("ApiBoard", ApiBoard);
    app.component("Glossary", Glossary);
    app.component("Planned", Planned);
    app.component("Figure", Figure);
    app.component("SwaggerUi", SwaggerUi);
  },
} satisfies Theme;
