import {
  PASSWORD_ERRORS,
  type CredentialRepository,
  type Credentials,
  type RegisteredAccount,
} from "../../auth/password/credentialRepository";
import { Result, success, failure } from "../result";
import { errorMessage, isDuplicateKey } from "./connection";
import type { MongoStore } from "./store";

/**
 * The only implementation of {@link CredentialRepository}, and deliberately not
 * re-exported from `./index.ts`: `mongoRepositories` is reachable from the
 * deployed Worker's entry point, and this must not be
 * (docs/architecture/auth-modes.md).
 */
export class CredentialRepositoryMongo implements CredentialRepository {
  constructor(private readonly store: MongoStore) {}

  async register(
    username: string,
    passwordHash: string,
  ): Promise<Result<RegisteredAccount>> {
    // Google subjects are numeric strings, so a prefixed UUID can never be
    // mistaken for one — the same argument `routes/devAuth.ts` makes for its
    // fixed account id. This is what a session's `sub` claim carries, and what
    // `currentPlayer` resolves the player by, which is why nothing downstream
    // has to know an account was not Google's.
    const accountId = `pwd_${crypto.randomUUID()}`;
    const id = crypto.randomUUID();

    try {
      await this.store.transaction(
        async (session, { passwordCredentials, players }) => {
          await passwordCredentials.insertOne(
            { _id: username, accountId, passwordHash },
            { session },
          );
          await players.insertOne(
            { _id: id, username, accountId },
            { session },
          );
        },
      );

      return success({ player: { id, username }, accountId });
    } catch (error) {
      // Either write can be the one that loses: the credential's primary key is
      // the username, and `players.username` is unique too — so a name taken by
      // a Google player is refused here just as one taken by another credential
      // is. Both mean the same thing to the caller.
      if (isDuplicateKey(error)) {
        return failure(PASSWORD_ERRORS.USERNAME_TAKEN);
      }
      return failure(`Error registering account: ${errorMessage(error)}`);
    }
  }

  async findCredentials(username: string): Promise<Result<Credentials>> {
    try {
      const { passwordCredentials } = await this.store.collections();
      const doc = await passwordCredentials.findOne({ _id: username });
      // The same failure a wrong password gets. A caller that could tell them
      // apart would be a way to find out who has an account.
      if (!doc) return failure(PASSWORD_ERRORS.INVALID_CREDENTIALS);
      return success({
        accountId: doc.accountId,
        passwordHash: doc.passwordHash,
      });
    } catch (error) {
      return failure(`Error retrieving credentials: ${errorMessage(error)}`);
    }
  }
}
