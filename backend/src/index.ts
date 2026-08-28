import { createApp, scheduled, type Bindings } from "./app";

/**
 * What Cloudflare deploys: production, preview, and the D1 local run
 * (`wrangler.jsonc`, every environment in it).
 *
 * **This module's graph must never reach password authentication.** That is the
 * whole of how the deployed Worker is kept free of a credential store, a
 * password hasher and public register/login endpoints — not a binding that
 * turns them off, but their absence from the bundle. A runtime flag could not
 * do it: bindings are runtime values, so esbuild cannot prove the branch dead
 * and would ship the handlers anyway. `indexPassword.ts` is the entry that has
 * them, and `wrangler.mongo.jsonc` is the only config that names it
 * (docs/architecture/auth-modes.md).
 *
 * `tests/routes/openapi.spec.ts` holds that line: it compares this entry's
 * route table against the other's and fails if a password route appears here.
 */
const app = createApp();

// Cloudflare requires the WorkflowEntrypoint class to be exported from the
// Worker's main module (referenced by class_name in wrangler.jsonc).
export { ContractSettlementWorkflow } from "./workflows/contractSettlement";

// The Worker's default export is the runtime handler ({ fetch, scheduled }), so
// the Hono instance is also exported by name for integration tests that drive
// the fully wired app via app.request(...).
export { app };

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Bindings>;
