import { Contract, Team } from "../../../model";
import {
  Domain,
  CHEMISTRY_LINKS,
  FORMATIONS,
  isSchema,
  Schema,
  ChemistryLevel,
  ChemistryLink,
} from "../../../model/enums";
import { RawContract } from "../../../dto/contractDTO";
import { LineupRepository } from "../repositories/lineupRepository";
import { TEAM_ERRORS } from "../repositories/teamRepository";
import { ContractRepository } from "../repositories/contractRepository";
import { LeagueRepository } from "../repositories/leagueRepository";
import { PlayerRepository } from "../repositories/playerRepository";
import { Result, success, failure } from "../repositories/result";
import { toRawContract } from "./rawContract";
import { TeamService } from "./team";

export const LINEUP_ERRORS = {
  NO_TEAM: TEAM_ERRORS.NO_TEAM_IN_LEAGUE,
  INVALID_PAYLOAD: "Invalid lineup payload",
  UNKNOWN_SCHEMA: "Unknown formation schema",
} as const;

export type RawTeamLineUp = {
  formation: {
    date: string;
    schema: string;
    formation: Record<string, RawContract | null>;
    chemistry?: ChemistryLink[];
  };
  bench: RawContract[];
};

/**
 * Validates an untrusted request body into a {@link RawTeamLineUp}.
 *
 * Guards the invariants persistence relies on: the schema must be a known
 * FORMATIONS key (getLineup indexes CHEMISTRY_LINKS with it, so an unknown
 * value would make every subsequent read fail) and each occupied position
 * must belong to that schema and reference a contract by id.
 */
export function parseLineupPayload(body: unknown): Result<RawTeamLineUp> {
  if (typeof body !== "object" || body === null) {
    return failure(LINEUP_ERRORS.INVALID_PAYLOAD);
  }
  const { formation, bench } = body as Record<string, unknown>;
  if (
    typeof formation !== "object" ||
    formation === null ||
    !Array.isArray(bench)
  ) {
    return failure(LINEUP_ERRORS.INVALID_PAYLOAD);
  }

  const {
    date,
    schema,
    formation: positions,
  } = formation as Record<string, unknown>;
  if (!isSchema(schema)) {
    return failure(LINEUP_ERRORS.UNKNOWN_SCHEMA);
  }
  if (
    typeof date !== "string" ||
    typeof positions !== "object" ||
    positions === null
  ) {
    return failure(LINEUP_ERRORS.INVALID_PAYLOAD);
  }

  const schemaPositions = FORMATIONS[schema] as readonly string[];
  for (const [position, contract] of Object.entries(positions)) {
    if (!schemaPositions.includes(position)) {
      return failure(LINEUP_ERRORS.INVALID_PAYLOAD);
    }
    if (contract === null) {
      continue;
    }
    if (
      typeof contract !== "object" ||
      typeof (contract as { id?: unknown }).id !== "string"
    ) {
      return failure(LINEUP_ERRORS.INVALID_PAYLOAD);
    }
  }

  return success(body as RawTeamLineUp);
}

export class LineupService {
  private lineupRepository: LineupRepository;
  private teamService: TeamService;
  private contractRepository: ContractRepository;
  private leagueRepository: LeagueRepository;
  private playerRepository: PlayerRepository;

  constructor(deps: {
    lineups: LineupRepository;
    /**
     * The one door to teams, self-scoped and rival alike. TeamService rather
     * than TeamRepository because whatever it comes to decide about teams —
     * dressing, derived fields, what counts as absent — should reach the
     * line-up views without this service learning about it
     * (docs/architecture/backend-architecture.md).
     */
    teamService: TeamService;
    contracts: ContractRepository;
    leagues: LeagueRepository;
    players: PlayerRepository;
  }) {
    this.lineupRepository = deps.lineups;
    this.teamService = deps.teamService;
    this.contractRepository = deps.contracts;
    this.leagueRepository = deps.leagues;
    this.playerRepository = deps.players;
  }

  async getLineup(
    playerId: string,
    leagueId: string,
  ): Promise<Result<RawTeamLineUp>> {
    return this.lineupOfTeam(
      this.teamService.getPlayerTeamInLeague(playerId, leagueId),
      leagueId,
    );
  }

  /**
   * A rival team's line-up, read-only, addressed by team id rather than by the
   * caller's session. Unlike {@link getLineup} this is not self-scoped: the
   * viewer does not own the team, so the team is named in the path.
   *
   * The team comes from TeamService, which owns what a team is to someone who
   * does not own it. The league is half the key it is looked up by, so a team
   * id from another league is absent rather than readable, and a wrong id is
   * reported as not-found instead of as a failed request.
   */
  async getRivalLineup(
    leagueId: string,
    teamId: string,
  ): Promise<Result<RawTeamLineUp>> {
    return this.lineupOfTeam(
      this.teamService.getTeamInLeague(teamId, leagueId),
      leagueId,
    );
  }

  /**
   * The one line-up read, over whichever team the caller resolved. Both entry
   * points differ only in how they address the team — everything downstream,
   * including whose name dresses the contracts, comes from the team row itself.
   */
  private async lineupOfTeam(
    pendingTeam: Promise<Result<Team | null>>,
    leagueId: string,
  ): Promise<Result<RawTeamLineUp>> {
    const teamResult = await pendingTeam;
    if (!teamResult.ok) {
      return teamResult;
    }
    if (teamResult.value === null) {
      return failure(LINEUP_ERRORS.NO_TEAM);
    }
    const team = teamResult.value;

    const [playerResult, leagueResult] = await Promise.all([
      this.playerRepository.getById(team.playerId),
      this.leagueRepository.getById(leagueId),
    ]);
    if (!playerResult.ok) return playerResult;
    if (!leagueResult.ok) return leagueResult;
    const playerName = playerResult.value.username;
    const domain = leagueResult.value.domain;

    const lineupResult = await this.lineupRepository.getByTeamId(team.id);
    if (!lineupResult.ok) {
      return lineupResult;
    }
    if (lineupResult.value === null) {
      return failure("No lineup found for this team");
    }
    const lineup = lineupResult.value;
    const schema = lineup.schema;
    if (!isSchema(schema)) {
      return failure(`Invalid formation data for team ${team.id}`);
    }

    const contractsResult = await this.contractRepository.getByTeamId(team.id);
    if (!contractsResult.ok) {
      return contractsResult;
    }
    // Settled contracts (e.g. sold early) are no longer owned inventory: the
    // article has returned to Free Agent, so it must drop out of both the
    // formation and the bench even though the row is retained for its FK.
    const activeContracts = contractsResult.value.filter(
      (contract) => !contract.settled,
    );
    const contractsById = new Map(
      activeContracts.map((contract) => [contract.id, contract]),
    );

    let storedFormation: Record<string, string>;
    try {
      storedFormation = JSON.parse(lineup.formation) as Record<string, string>;
    } catch {
      return failure(`Invalid formation data for team ${team.id}`);
    }

    const formation: Record<string, RawContract> = {};
    const usedContractIds = new Set<string>();
    for (const [position, contractId] of Object.entries(storedFormation)) {
      const contract = contractsById.get(contractId);
      if (!contract) {
        continue;
      }
      formation[position] = this.buildRawContract(
        contract,
        team,
        playerName,
        domain,
      );
      usedContractIds.add(contractId);
    }

    const bench = activeContracts
      .filter((contract) => !usedContractIds.has(contract.id))
      .map((contract) =>
        this.buildRawContract(contract, team, playerName, domain),
      );

    return success({
      formation: {
        date: lineup.updatedAt,
        schema,
        formation,
        chemistry: this.emptyChemistryLinks(schema),
      },
      bench,
    });
  }

  async saveLineup(
    playerId: string,
    leagueId: string,
    payload: RawTeamLineUp,
  ): Promise<Result<void>> {
    const teamResult = await this.teamService.getPlayerTeamInLeague(
      playerId,
      leagueId,
    );
    if (!teamResult.ok) {
      return teamResult;
    }
    if (teamResult.value === null) {
      return failure(LINEUP_ERRORS.NO_TEAM);
    }
    const team = teamResult.value;

    const contractsResult = await this.contractRepository.getByTeamId(team.id);
    if (!contractsResult.ok) {
      return contractsResult;
    }
    const ownedContractIds = new Set(
      contractsResult.value.map((contract) => contract.id),
    );

    const slimFormation: Record<string, string> = {};
    for (const [position, rawContract] of Object.entries(
      payload.formation.formation,
    )) {
      if (rawContract === null) {
        continue;
      }
      if (!ownedContractIds.has(rawContract.id)) {
        return failure(`Contract ${rawContract.id} is not owned by this team`);
      }
      slimFormation[position] = rawContract.id;
    }

    return this.lineupRepository.upsert({
      teamId: team.id,
      schema: payload.formation.schema,
      formation: JSON.stringify(slimFormation),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Builds the schema's chemistry-link topology with neutral (empty) levels.
   * Real levels are computed client-side from live Wikimedia article links;
   * the backend only supplies the link structure so the pitch can render lines
   * immediately. Mirrors the frontend `createChemistryLinks` fallback.
   */
  private emptyChemistryLinks(schema: Schema): ChemistryLink[] {
    return CHEMISTRY_LINKS[schema].map(([from, to]) => ({
      from,
      to,
      level: ChemistryLevel.EMPTY,
    }));
  }

  private buildRawContract(
    contract: Contract,
    team: Team,
    playerName: string,
    domain: Domain,
  ): RawContract {
    return toRawContract(
      contract,
      { id: team.id, name: team.name, credits: team.credits },
      { id: team.playerId, name: playerName },
      domain,
    );
  }
}
