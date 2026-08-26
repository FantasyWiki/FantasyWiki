<script setup lang="ts">
/**
 * Swagger UI, over `backend/openapi.yaml`.
 *
 * The spec is fetched at runtime rather than bundled: `prepare.mjs` copies it
 * into the mirror's `public/`, so the file the page renders is byte-for-byte
 * the one in the repository, and nothing in this build can quietly transform
 * it on the way through.
 *
 * Two things about the mount are load-bearing.
 *
 * The library is imported inside `onMounted`. It reaches for `window` and
 * `document` while its module body runs, and VitePress builds every page
 * through SSR, so a top-level import fails the build with `document is not
 * defined` — on a machine where the dev server was perfectly happy.
 *
 * "Try it out" is off. The site is served from github.io and the API
 * authenticates with an HTTP-only `SameSite=Lax` cookie, which a cross-site
 * request from here would not carry: every protected operation would answer
 * 401, and a reader would reasonably read that as the API being broken rather
 * than as the browser doing exactly what the cookie asked for.
 */
import { onMounted, ref } from "vue";
import { withBase } from "vitepress";

/**
 * The stylesheet as a URL, not as an import.
 *
 * VitePress builds one stylesheet for the whole site, so an ordinary
 * `import "…/swagger-ui.css"` would put 150 kB of it in front of every page
 * here to serve the one page that needs it. `?url` emits it as an asset
 * instead, and the link below is added when this component mounts.
 */
import swaggerStylesheet from "swagger-ui-dist/swagger-ui.css?url";

type Status = "loading" | "ready" | "failed";

const container = ref<HTMLElement | null>(null);
const status = ref<Status>("loading");

/** Where `prepare.mjs` puts the spec, resolved against the site's base path. */
const specUrl = withBase("/openapi.yaml");

/**
 * Adds the stylesheet and resolves once the browser has it, so the reference
 * is never painted unstyled. Idempotent: navigating away and back reuses the
 * link that is already in the document.
 */
function loadStylesheet(): Promise<void> {
  const existing = document.querySelector<HTMLLinkElement>(
    `link[href="${swaggerStylesheet}"]`,
  );
  if (existing) return Promise.resolve();

  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = swaggerStylesheet;
    // Resolve either way: an unstyled reference is worth more than none.
    link.addEventListener("load", () => resolve());
    link.addEventListener("error", () => resolve());
    document.head.appendChild(link);
  });
}

onMounted(async () => {
  try {
    const [{ default: SwaggerUIBundle }] = await Promise.all([
      import("swagger-ui-dist/swagger-ui-es-bundle.js"),
      loadStylesheet(),
    ]);

    SwaggerUIBundle({
      url: specUrl,
      domNode: container.value,
      // Anchored operations, so a link to one endpoint lands on that endpoint.
      deepLinking: true,
      // Tags open, operations closed: the whole surface at a glance, and one
      // click to any of it.
      docExpansion: "list",
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 2,
      // The schema names are the vocabulary — `Contract`, `Top Read` — and are
      // worth more than the shapes they expand into.
      defaultModelRendering: "model",
      tryItOutEnabled: false,
      supportedSubmitMethods: [],
      syntaxHighlight: { activate: true, theme: "agate" },
    });

    status.value = "ready";
  } catch {
    status.value = "failed";
  }
});
</script>

<template>
  <div class="api-reference">
    <p v-if="status === 'loading'" class="api-reference__note">
      Loading the specification…
    </p>
    <p v-else-if="status === 'failed'" class="api-reference__note">
      The specification could not be rendered here.
      <a :href="specUrl">Read <code>openapi.yaml</code> directly</a>.
    </p>
    <div ref="container" />
  </div>
</template>

<style>
/**
 * Swagger UI ships one theme, and it is a light one. What follows is not a
 * restyle — it is the smallest set of surfaces that would otherwise stay white
 * on a dark page, plus the type, so the reference reads as part of the site
 * rather than as an embedded application.
 */
.api-reference {
  margin: 2rem 0 0;
}

.api-reference__note {
  color: var(--vp-c-text-3);
  font-size: 0.9rem;
}

.api-reference .swagger-ui {
  font-family: var(--vp-font-family-base);
  color: var(--vp-c-text-1);
}

.api-reference .swagger-ui .info .title,
.api-reference .swagger-ui .opblock-tag {
  font-family: "Libre Baskerville", Georgia, serif;
}

.api-reference .swagger-ui .info {
  margin: 0 0 2rem;
}

/* The spec's own title duplicates the page heading above it. */
.api-reference .swagger-ui .info hgroup.main {
  display: none;
}

.api-reference .swagger-ui .scheme-container {
  background: var(--vp-c-bg-soft);
  box-shadow: none;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--fw-radius-md);
  margin: 0 0 1.5rem;
  padding: 1rem;
}

.api-reference .swagger-ui .btn {
  border-radius: var(--fw-radius-sm);
}

/* ── Dark ──────────────────────────────────────────────────────────────── */

.dark .api-reference .swagger-ui,
.dark .api-reference .swagger-ui .info li,
.dark .api-reference .swagger-ui .info p,
.dark .api-reference .swagger-ui .info table,
.dark .api-reference .swagger-ui .info .title,
.dark .api-reference .swagger-ui .opblock-tag,
.dark .api-reference .swagger-ui .opblock .opblock-summary-path,
.dark .api-reference .swagger-ui .opblock .opblock-summary-description,
.dark .api-reference .swagger-ui .opblock-description-wrapper p,
.dark .api-reference .swagger-ui .opblock-external-docs-wrapper p,
.dark .api-reference .swagger-ui .opblock-title_normal p,
.dark .api-reference .swagger-ui .parameter__name,
.dark .api-reference .swagger-ui .parameter__type,
.dark .api-reference .swagger-ui .response-col_status,
.dark .api-reference .swagger-ui .response-col_links,
.dark .api-reference .swagger-ui .responses-inner h4,
.dark .api-reference .swagger-ui .responses-inner h5,
.dark .api-reference .swagger-ui .model-title,
.dark .api-reference .swagger-ui .model,
.dark .api-reference .swagger-ui .models h4,
.dark .api-reference .swagger-ui .tab li,
.dark .api-reference .swagger-ui label,
.dark .api-reference .swagger-ui table thead tr td,
.dark .api-reference .swagger-ui table thead tr th,
.dark .api-reference .swagger-ui .dialog-ux .modal-ux-content h4,
.dark .api-reference .swagger-ui .dialog-ux .modal-ux-header h3 {
  color: var(--vp-c-text-1);
}

.dark .api-reference .swagger-ui .opblock-summary-description,
.dark .api-reference .swagger-ui .parameter__type,
.dark .api-reference .swagger-ui .prop-format,
.dark .api-reference .swagger-ui .renderedMarkdown p {
  color: var(--vp-c-text-2);
}

.dark .api-reference .swagger-ui .opblock .opblock-section-header,
.dark .api-reference .swagger-ui .scheme-container,
.dark .api-reference .swagger-ui section.models,
.dark .api-reference .swagger-ui .dialog-ux .modal-ux {
  background: var(--vp-c-bg-soft);
}

.dark .api-reference .swagger-ui section.models .model-container,
.dark .api-reference .swagger-ui .model-box {
  background: var(--vp-c-bg-alt);
}

.dark .api-reference .swagger-ui .opblock .opblock-section-header,
.dark .api-reference .swagger-ui section.models,
.dark .api-reference .swagger-ui .dialog-ux .modal-ux,
.dark .api-reference .swagger-ui .opblock-tag {
  border-color: var(--vp-c-divider);
}

.dark .api-reference .swagger-ui input[type="text"],
.dark .api-reference .swagger-ui select,
.dark .api-reference .swagger-ui textarea {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-border);
}

.dark .api-reference .swagger-ui .markdown code,
.dark .api-reference .swagger-ui .renderedMarkdown code {
  background: var(--vp-code-block-bg);
  color: var(--vp-c-brand-1);
}

/* The chevrons and the padlock are black SVG paths, invisible on a dark page. */
.dark .api-reference .swagger-ui .expand-methods svg,
.dark .api-reference .swagger-ui .expand-operation svg,
.dark .api-reference .swagger-ui .opblock-summary-control svg,
.dark .api-reference .swagger-ui .models-control svg,
.dark .api-reference .swagger-ui .model-box-control svg,
.dark .api-reference .swagger-ui .authorization__btn svg {
  fill: var(--vp-c-text-2);
}

.dark .api-reference .swagger-ui .opblock.opblock-get {
  background: rgba(97, 175, 254, 0.08);
}

.dark .api-reference .swagger-ui .opblock.opblock-post {
  background: rgba(73, 204, 144, 0.08);
}

.dark .api-reference .swagger-ui .opblock.opblock-put {
  background: rgba(252, 161, 48, 0.08);
}

.dark .api-reference .swagger-ui .opblock.opblock-patch {
  background: rgba(80, 227, 194, 0.08);
}

.dark .api-reference .swagger-ui .opblock.opblock-delete {
  background: rgba(249, 62, 62, 0.08);
}
</style>
