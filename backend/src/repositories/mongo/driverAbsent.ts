/**
 * The MongoDB driver, for a build that must not contain it.
 *
 * Cloudflare deployments run on D1 and only D1, but `composition.ts` names both
 * targets — choosing is its whole job — so `repositories/mongo` is reachable
 * from the Worker's entry point. The driver behind it is reached only through a
 * dynamic `import("mongodb")`, and esbuild follows those: without this, ~1.5MB
 * of driver ships with every D1 deploy that can never use it, and the Worker
 * needs the `nodejs_compat` flag to build at all, because the driver imports
 * `net`, `tls` and `child_process`.
 *
 * So the Cloudflare environments alias `mongodb` to this file (the `alias` key
 * in wrangler.jsonc). Only the one import that opens a connection touches the
 * driver's runtime, and on those deployments nothing reaches it — `PERSISTENCE`
 * is unset, so `repositoriesFor` never takes the Mongo branch. Should something
 * bind it anyway, this says so plainly instead of failing somewhere deeper.
 */
export class MongoClient {
  constructor() {
    throw new Error(
      "This build has no MongoDB driver: it is a Cloudflare deployment, which runs on D1.",
    );
  }
}
