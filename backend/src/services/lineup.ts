import { Temporal } from "@js-temporal/polyfill";
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
import { LineupRepositoryD1 } from "../repositories/d1/lineupRepositoryD1";
import { TEAM_ERRORS, TeamRepository } from "../repositories/teamRepository";
import { TeamRepositoryD1 } from "../repositories/d1/teamRepositoryD1";
import { ContractRepository } from "../repositories/contractRepository";
import { ContractRepositoryD1 } from "../repositories/d1/contractRepositoryD1";
import { LeagueRepository } from "../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../repositories/d1/leagueRepositoryD1";
import { PlayerRepository } from "../repositories/playerRepository";
import { PlayerRepositoryD1 } from "../repositories/d1/playerRepositoryD1";
import { Result, success, failure } from "../repositories/result";
import { toRawContract } from "./rawContract";

export const LINEUP_ERRORS = {
  NO_TEAM: TEAM_ERRORS.NO_TEAM_IN_LEAGUE,
  INVALID_PAYLOAD: "Invalid lineup payload",
  UNKNOWN_SCHEMA: "Unknown formation schema",
} as const;

export type LineupServiceDeps = {
  lineupRepository: LineupRepository;
  teamRepository: TeamRepository;
  contractRepository: ContractRepository;
  leagueRepository: LeagueRepository;
  playerRepository: PlayerRepository;
};

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
  private teamRepository: TeamRepository;
  private contractRepository: ContractRepository;
  private leagueRepository: LeagueRepository;
  private playerRepository: PlayerRepository;

  constructor(depsOrDb: LineupServiceDeps | D1Database) {
    const deps =
      "lineupRepository" in depsOrDb
        ? depsOrDb
        : LineupService.d1Deps(depsOrDb as D1Database);
    this.lineupRepository = deps.lineupRepository;
    this.teamRepository = deps.teamRepository;
    this.contractRepository = deps.contractRepository;
    this.leagueRepository = deps.leagueRepository;
    this.playerRepository = deps.playerRepository;
  }

  private static d1Deps(db: D1Database): LineupServiceDeps {
    return {
      lineupRepository: new LineupRepositoryD1(db),
      teamRepository: new TeamRepositoryD1(db),
      contractRepository: new ContractRepositoryD1(db),
      leagueRepository: new LeagueRepositoryD1(db),
      playerRepository: new PlayerRepositoryD1(db),
    };
  }

  async getLineup(
    playerId: string,
    leagueId: string,
  ): Promise<Result<RawTeamLineUp>> {
    const teamResult = await this.teamRepository.getByPlayerAndLeague(
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

    const [playerResult, leagueResult] = await Promise.all([
      this.playerRepository.getById(playerId),
      this.leagueRepository.getById(leagueId),
    ]);
    if (!playerResult.ok) return playerResult;
    if (!leagueResult.ok) return leagueResult;
    const playerName = playerResult.value.username;
    const domain = leagueResult.value.domain as Domain;

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
    // A contract is only live inventory while its term is still running. It
    // drops out of both the formation and the bench when it is either settled
    // (e.g. sold early, or resolved at expiry by the settlement sweep — the row
    // is retained for its FK) or past its expireDate. Expiry is derived from
    // the date here, using the same boundary as the settlement sweep
    // (`expireDate <= today` is due, so active means `expireDate > today`),
    // rather than waiting for the daily sweep to flip `settled`. That way a
    // contract whose term has ended — including one already renewed and now
    // past its new expireDate — never lingers in the lineup between expiry and
    // the next sweep.
    const today = Temporal.Now.plainDateISO();
    const activeContracts = contractsResult.value.filter(
      (contract) =>
        !contract.settled &&
        Temporal.PlainDate.compare(contract.expireDate, today) > 0,
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
    const teamResult = await this.teamRepository.getByPlayerAndLeague(
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
