import { describe, expect, it } from "vitest";
import { contractErrorStatus } from "../routes/leagues";
import { playerErrorStatus } from "../routes/helpers";
import { CONTRACT_ERRORS } from "../services/contract";
import { LEAGUE_ERRORS } from "../repositories/leagueRepository";
import { PLAYER_ERRORS } from "../repositories/playerRepository";

describe("contractErrorStatus", () => {
  it("maps every contract business error to a client status", () => {
    for (const error of Object.values(CONTRACT_ERRORS)) {
      expect(contractErrorStatus(error)).not.toBe(500);
    }
  });

  it("answers 404 for the things that are genuinely missing", () => {
    expect(contractErrorStatus(CONTRACT_ERRORS.NO_TEAM)).toBe(404);
    expect(contractErrorStatus(CONTRACT_ERRORS.CONTRACT_NOT_FOUND)).toBe(404);
    expect(contractErrorStatus(LEAGUE_ERRORS.NOT_FOUND)).toBe(404);
    expect(contractErrorStatus(PLAYER_ERRORS.NOT_FOUND)).toBe(404);
  });

  it("answers 400 for a broken purchase or sale rule", () => {
    expect(contractErrorStatus(CONTRACT_ERRORS.NOT_ENOUGH_CREDITS)).toBe(400);
    expect(contractErrorStatus(CONTRACT_ERRORS.TEAM_FULL)).toBe(400);
    expect(contractErrorStatus(CONTRACT_ERRORS.ARTICLE_TAKEN)).toBe(400);
    expect(contractErrorStatus(CONTRACT_ERRORS.ALREADY_SOLD)).toBe(400);
  });

  it("answers 500 for a failure no service named — not 400", () => {
    expect(contractErrorStatus("Error fetching contracts: D1_ERROR")).toBe(500);
  });

  it("does not read 'not found' out of an infrastructure message", () => {
    // The old mapping ran /not found/i over free text, so a D1 outage whose
    // message happened to contain those words was served to the client as 404.
    expect(
      contractErrorStatus("Error retrieving league: no such table: leagues"),
    ).toBe(500);
    expect(
      contractErrorStatus("Error fetching contracts: index not found"),
    ).toBe(500);
  });
});

describe("playerErrorStatus", () => {
  it("answers 404 only when the player or their account genuinely does not exist", () => {
    expect(playerErrorStatus(PLAYER_ERRORS.NOT_FOUND)).toBe(404);
    expect(playerErrorStatus(PLAYER_ERRORS.ACCOUNT_NOT_FOUND)).toBe(404);
  });

  it("answers 500 when resolving the player failed for any other reason", () => {
    expect(playerErrorStatus("Error retrieving player: D1_ERROR")).toBe(500);
  });
});
