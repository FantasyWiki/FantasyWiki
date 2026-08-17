import { describe, expect, it } from "vitest";
import {
  contractErrorStatus,
  leagueCreationErrorStatus,
  teamErrorStatus,
} from "../routes/leagues";
import { playerErrorStatus } from "../routes/helpers";
import { CONTRACT_ERRORS } from "../services/contract";
import { LEAGUE_CREATION_ERRORS } from "../services/league";
import { LEAGUE_ERRORS } from "../repositories/leagueRepository";
import { PLAYER_ERRORS } from "../repositories/playerRepository";
import { TEAM_ERRORS } from "../repositories/teamRepository";

describe("teamErrorStatus", () => {
  it("maps every team business error to a client status", () => {
    for (const error of Object.values(TEAM_ERRORS)) {
      expect(teamErrorStatus(error)).not.toBe(500);
    }
  });

  it("answers 403 for a league the player may not enter", () => {
    // The refusal is a permission one. It was a 400 until the join gate
    // existed, because every other failure really was the client's input.
    expect(teamErrorStatus(TEAM_ERRORS.LEAGUE_IS_PRIVATE)).toBe(403);
  });

  it("answers 404 for a league that is not there", () => {
    expect(teamErrorStatus(LEAGUE_ERRORS.NOT_FOUND)).toBe(404);
    expect(teamErrorStatus(TEAM_ERRORS.NO_TEAM_IN_LEAGUE)).toBe(404);
  });

  it("still answers 400 for the name rules", () => {
    // Regression guard for the status-map change: these used to be free text
    // mapped to a blanket 400, and turning them into 500s would leave the
    // team-creation form with nothing to say.
    expect(teamErrorStatus(TEAM_ERRORS.NAME_LENGTH)).toBe(400);
    expect(teamErrorStatus(TEAM_ERRORS.NAME_TAKEN)).toBe(400);
    expect(teamErrorStatus(TEAM_ERRORS.ALREADY_HAS_TEAM)).toBe(400);
  });

  it("answers 500 for a failure no service named", () => {
    expect(teamErrorStatus("Error creating team: D1_ERROR")).toBe(500);
  });
});

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

describe("leagueCreationErrorStatus", () => {
  it("maps every way a payload can be refused to 400", () => {
    for (const error of Object.values(LEAGUE_CREATION_ERRORS)) {
      expect(leagueCreationErrorStatus(error)).toBe(400);
    }
  });

  it("does not blame the client for running out of invitation codes", () => {
    // 24.3 million codes: five collisions means a stuck RNG or a broken index,
    // and there is nothing the caller could restate to get a different answer.
    expect(
      leagueCreationErrorStatus(LEAGUE_ERRORS.INVITATION_CODE_UNAVAILABLE),
    ).toBe(500);
  });

  it("answers 500 for a failure no service named", () => {
    expect(leagueCreationErrorStatus("Error creating league: D1_ERROR")).toBe(
      500,
    );
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
