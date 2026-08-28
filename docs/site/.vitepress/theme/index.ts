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
