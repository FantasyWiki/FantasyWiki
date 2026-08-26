/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

/**
 * `swagger-ui-dist` ships no types. Only the bundle's entry point is needed —
 * one call, with an options bag it does not validate anyway — so the shape is
 * declared here rather than pulled in as a second dependency.
 */
declare module "swagger-ui-dist/swagger-ui-es-bundle.js" {
  const SwaggerUIBundle: (options: Record<string, unknown>) => unknown;
  export default SwaggerUIBundle;
}
