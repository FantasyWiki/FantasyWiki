import { Player } from "../../../model";
import { PlayerService } from "./player";
import { Result, failure } from "../repositories/result";

type LoginPlayerService = Pick<
  PlayerService,
  "createPlayer" | "getPlayerByGoogleAccountId"
>;

const buildPlayerByAccountNotFoundError = (googleAccountId: string) =>
  `Player with account id ${googleAccountId} not found`;

export class LoginService {
  private playerService: LoginPlayerService;

  constructor(db: D1Database, playerService?: LoginPlayerService) {
    this.playerService = playerService ?? new PlayerService(db);
  }

  /**
   * Login or create player with Google account.
   * If player exists for this Google account ID, return it.
   * Otherwise, create a new player with username derived from email local-part
   * (with numeric suffix if already taken) and return the new player.
   */
  async loginWithGoogleAccount(
    googleAccountId: string,
    email: string,
  ): Promise<Result<Player>> {
    // Try to find existing player by Google account ID
    const existingResult =
      await this.playerService.getPlayerByGoogleAccountId(googleAccountId);
    if (existingResult.ok) {
      return existingResult;
    }
    if (
      existingResult.error !==
      buildPlayerByAccountNotFoundError(googleAccountId)
    ) {
      return existingResult;
    }

    // Player not found, create a new one
    // Extract local-part from email (before @)
    const baseUsername = email.split("@")[0];
    const usernameResult = await this.createPlayer(
      baseUsername,
      email,
      googleAccountId,
    );
    return usernameResult;
  }

  /**
   * Try to find a unique username and create the player.
   * Attempts base name first, then appends numeric suffixes.
   */
  private async createPlayer(
    baseUsername: string,
    email: string,
    googleAccountId: string,
  ): Promise<Result<Player>> {
    // First try the base username as-is
    let candidate = baseUsername;
    let createResult = await this.playerService.createPlayer(
      candidate,
      email,
      googleAccountId,
    );

    if (createResult.ok) {
      return createResult;
    }

    const isUsernameConflict = (error: string) =>
      error.includes("UNIQUE constraint failed: players.username");
    if (!isUsernameConflict(createResult.error)) {
      return createResult;
    }

    // If username is already taken, try with numeric suffixes
    for (let suffix = 1; suffix < 1000; suffix++) {
      candidate = `${baseUsername}${suffix}`;
      createResult = await this.playerService.createPlayer(
        candidate,
        email,
        googleAccountId,
      );

      if (createResult.ok) {
        return createResult;
      }
      if (!isUsernameConflict(createResult.error)) {
        return createResult;
      }
    }

    // All attempts failed
    return failure(
      `Could not create player: unable to find available username after 1000 attempts`,
    );
  }
}
