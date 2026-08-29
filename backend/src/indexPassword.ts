import { createApp, type Bindings } from "./app";
import passwordAuth from "./routes/passwordAuth";

/**
 * The entry point for the local MongoDB run (`wrangler.mongo.jsonc`), and the
 * only build that carries username/password sign-in.
 *
 * It is a second `main` rather than a binding on the first, because absence is
 * the requirement: a credential store, a password hasher and public
 * register/login endpoints must not be in the Worker that Cloudflare deploys.
 * A runtime flag cannot deliver that — bindings are runtime values, so esbuild
 * cannot prove the branch dead and would bundle the handlers regardless. Here
 * the password module is imported and there it is not, which is a difference
 * you can read off two files and which
 * `tests/routes/openapi.spec.ts` asserts (docs/architecture/auth-modes.md).
 *
 * No `ContractSettlementWorkflow` export and no `scheduled` handler: this
 * config binds neither the Workflow nor a cron trigger, the daily settlement
 * being something that only fires on a deployment. Binding a Workflow here
 * means exporting the class here too.
 */
const app = createApp();

app.route("/auth", passwordAuth);

export { app };

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Bindings>;
