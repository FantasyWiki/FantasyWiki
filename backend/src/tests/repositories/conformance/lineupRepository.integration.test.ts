import { describe, it, expect } from "vitest";
import { unwrap } from "../../../repositories/result";
import { GLOBAL_LEAGUE_ID } from "../../../services/league";
import { repositories } from "../../support/target";
import { aTeamIn } from "./subjects";

/**
 * What any LineupRepository owes its callers. A team has at most one lineup, and
 * it is stored whole: `formation` is an opaque string here, and `schema` is not
 * validated — the domain rejects an unknown one on the way in, which is what
 * lets a corrupt-data test establish one underneath the service.
 */
describe("LineupRepository conformance", () => {
  it("answers null until a lineup has been saved", async () => {
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);

    expect(
      unwrap(await repositories().lineups.getByTeamId(team.id), "lineup"),
    ).toBeNull();
  });

  it("round-trips what it was given", async () => {
    const lineups = repositories().lineups;
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);
    const stored = {
      teamId: team.id,
      schema: "4-3-3",
      formation: JSON.stringify({ GK: "contract-1" }),
      updatedAt: "2026-01-01T00:00:00Z",
    };

    unwrap(await lineups.upsert(stored), "lineup");

    expect(unwrap(await lineups.getByTeamId(team.id), "lineup")).toEqual(
      stored,
    );
  });

  it("replaces the stored lineup rather than accumulating another", async () => {
    const lineups = repositories().lineups;
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);
    unwrap(
      await lineups.upsert({
        teamId: team.id,
        schema: "4-3-3",
        formation: JSON.stringify({ GK: "contract-1" }),
        updatedAt: "2026-01-01T00:00:00Z",
      }),
      "first lineup",
    );

    unwrap(
      await lineups.upsert({
        teamId: team.id,
        schema: "5-3-2",
        formation: JSON.stringify({ ST: "contract-2" }),
        updatedAt: "2026-01-02T00:00:00Z",
      }),
      "replacement",
    );

    expect(unwrap(await lineups.getByTeamId(team.id), "lineup")).toEqual({
      teamId: team.id,
      schema: "5-3-2",
      formation: JSON.stringify({ ST: "contract-2" }),
      updatedAt: "2026-01-02T00:00:00Z",
    });
  });

  it("keeps each team's lineup to itself", async () => {
    const lineups = repositories().lineups;
    const team = await aTeamIn(GLOBAL_LEAGUE_ID);
    const other = await aTeamIn(GLOBAL_LEAGUE_ID);
    unwrap(
      await lineups.upsert({
        teamId: team.id,
        schema: "4-3-3",
        formation: "{}",
        updatedAt: "2026-01-01T00:00:00Z",
      }),
      "lineup",
    );

    expect(
      unwrap(await lineups.getByTeamId(other.id), "other team's lineup"),
    ).toBeNull();
  });
});
