import type { CredentialRepository } from "./auth/password/credentialRepository";
import {
  MONGO_PERSISTENCE,
  mongoTargetFor,
  type PersistenceEnv,
} from "./composition";
import { CredentialRepositoryMongo } from "./repositories/mongo/credentialRepositoryMongo";
import { MongoStore } from "./repositories/mongo/store";

/**
 * Where username/password accounts are kept — the auth counterpart of
 * `repositoriesFor`, and the only module that names a
 * {@link CredentialRepository} implementation.
 *
 * A function of its own, in a file of its own, rather than an entry in
 * `Repositories`: `composition.ts` is imported by the deployed Worker's entry
 * point and this must not be. That is also why there is no D1 branch to fall
 * back to — there is no D1 implementation, and there cannot be one while
 * `players.accountId` is a foreign key onto `google_accounts`
 * (docs/architecture/auth-modes.md).
 *
 * Synchronous for the same reason `repositoriesFor` is, and with the same
 * consequence: **call it inside the handler, never at module scope.** A Worker
 * owns its sockets per request, so a client cached across requests serves the
 * one that opened it and then hangs every request after — a promise that never
 * settles rather than an error, which the suite cannot catch because it runs
 * outside any request context
 * (docs/architecture/persistence-targets.md).
 *
 * The store it builds is a second one, not a second connection: `MongoStore`
 * connects lazily, and a request that signs in never touches
 * `c.var.repositories` — the registration write is done here, in one
 * transaction. Keep it that way, or it becomes two.
 */
export function credentialsFor(env: PersistenceEnv): CredentialRepository {
  if (env.PERSISTENCE !== MONGO_PERSISTENCE) {
    // Loudly, rather than quietly offering no way to sign in: reaching here
    // means this entry point was pointed at a target that cannot store a
    // password account.
    throw new Error(
      "Username/password sign-in needs PERSISTENCE=mongo: there is no other credential store.",
    );
  }
  return new CredentialRepositoryMongo(new MongoStore(mongoTargetFor(env)));
}
