import { Hono } from "hono";
import { JWTPayload } from "hono/utils/jwt/types";
import { LeagueService, toLeagueDTO } from "../services/league";
import { LeaderboardService } from "../services/leaderboard";
import { PerformanceService } from "../services/performance";
import { TeamService } from "../services/team";
import { PlayerService } from "../services/player";
import { ArticleMarketService } from "../services/articleMarket";
import {
  ContractService,
  CONTRACT_ERRORS,
  type ContractError,
} from "../services/contract";
import {
  LineupService,
  parseLineupPayload,
  LINEUP_ERRORS,
} from "../services/lineup";
import { NotificationService } from "../services/notification";
import { LEAGUE_ERRORS } from "../repositories/leagueRepository";
import { PLAYER_ERRORS } from "../repositories/playerRepository";
import { TEAM_ERRORS } from "../repositories/teamRepository";
import { TeamDTO } from "../../../dto/teamDTO";
import { playerErrorStatus, resolveCurrentPlayer } from "./helpers";

type Bindings = {
  db: D1Database;
};

const leagues = new Hono<{ Bindings: Bindings }>();

/**
 * The status every contract business failure maps to, per
 * docs/api-naming-rules.md: a missing resource is a 404, a broken purchase or
 * sale rule is a 400. Declaring it as a total Record over ContractError means
 * a new constant without a status fails to compile.
 */
const CONTRACT_ERROR_STATUS: Record<ContractError, 404 | 400> = {
  [CONTRACT_ERRORS.NO_TEAM]: 404,
  [CONTRACT_ERRORS.CONTRACT_NOT_FOUND]: 404,
  [CONTRACT_ERRORS.INVALID_TIER]: 400,
  [CONTRACT_ERRORS.ARTICLE_TAKEN]: 400,
  [CONTRACT_ERRORS.ALREADY_OWNED]: 400,
  [CONTRACT_ERRORS.TEAM_FULL]: 400,
  [CONTRACT_ERRORS.NOT_ENOUGH_CREDITS]: 400,
  [CONTRACT_ERRORS.NOT_CONTRACT_OWNER]: 400,
  [CONTRACT_ERRORS.ALREADY_SOLD]: 400,
  [CONTRACT_ERRORS.ALREADY_SETTLED]: 400,
  [CONTRACT_ERRORS.EXPIRED]: 400,
  [CONTRACT_ERRORS.RENEWAL_WINDOW_CLOSED]: 400,
  [CONTRACT_ERRORS.RENEWAL_NOT_ELECTED]: 400,
};

/** Repository misses the service passes straight through to the route. */
const NOT_FOUND_ERRORS: readonly string[] = [
  LEAGUE_ERRORS.NOT_FOUND,
  PLAYER_ERRORS.NOT_FOUND,
];

/**
 * Anything the service did not name — a D1 outage, a Wikimedia failure — is
 * ours, not the client's, and must surface as a 500 rather than be guessed at
 * from its wording.
 */
export function contractErrorStatus(error: string): 404 | 400 | 500 {
  if (error in CONTRACT_ERROR_STATUS) {
    return CONTRACT_ERROR_STATUS[error as ContractError];
  }
  return NOT_FOUND_ERRORS.includes(error) ? 404 : 500;
}

leagues.get("/", async (c) => {
  const payload = c.get("jwtPayload") as JWTPayload;
  const playerService = new PlayerService(c.env.db);
  const playerResult = await playerService.getPlayerByGoogleAccountId(
    payload.sub as string,
  );
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }
  const leaguesResult = await playerService.getLeaguesByPlayerId(
    playerResult.value.id,
  );
  if (!leaguesResult.ok) {
    return c.json({ error: leaguesResult.error }, 500);
  }
  return c.json(leaguesResult.value.map((league) => toLeagueDTO(league)));
});

leagues.get("/global", async (c) => {
  const leagueService = new LeagueService(c.env.db);
  const result = await leagueService.getGlobalLeague();
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }
  return c.json(result.value);
});

leagues.get("/:id/leaderboard", async (c) => {
  const leagueId = c.req.param("id");
  const leaderboardService = new LeaderboardService(c.env.db);
  const result = await leaderboardService.getLeaderboard(leagueId);
  if (!result.ok) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.value);
});

leagues.get("/:id/my-team", async (c) => {
  const leagueId = c.req.param("id");
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const teamService = new TeamService(c.env.db);
  const teamResult = await teamService.getMyTeam(
    playerResult.value.id,
    leagueId,
    playerResult.value.username,
  );
  if (!teamResult.ok) {
    return c.json({ error: teamResult.error }, 500);
  }
  if (teamResult.value === null) {
    return c.json({ error: TEAM_ERRORS.NO_TEAM_IN_LEAGUE }, 404);
  }
  return c.json(teamResult.value);
});

leagues.get("/:id/my-performances", async (c) => {
  const leagueId = c.req.param("id");
  const rawLimit = parseInt(c.req.query("limit") ?? "2", 10);
  const limit = Math.max(1, Number.isNaN(rawLimit) ? 2 : rawLimit);
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const teamService = new TeamService(c.env.db);
  const teamResult = await teamService.getMyTeam(
    playerResult.value.id,
    leagueId,
    playerResult.value.username,
  );
  if (!teamResult.ok) {
    return c.json({ error: teamResult.error }, 500);
  }
  if (teamResult.value === null) {
    return c.json({ error: TEAM_ERRORS.NO_TEAM_IN_LEAGUE }, 404);
  }

  const performanceService = new PerformanceService(c.env.db);
  const perfResult = await performanceService.getRecentForTeam(
    teamResult.value.id,
    limit,
  );
  if (!perfResult.ok) {
    return c.json({ error: perfResult.error }, 500);
  }
  return c.json(perfResult.value);
});

leagues.post("/:id/my-team", async (c) => {
  const leagueId = c.req.param("id");
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const body = await c.req
    .json<{ name?: string }>()
    .catch(() => ({ name: undefined }));
  if (!body.name || typeof body.name !== "string") {
    return c.json({ error: "name is required" }, 400);
  }

  const teamService = new TeamService(c.env.db);
  const teamResult = await teamService.createTeam(
    playerResult.value.id,
    leagueId,
    body.name,
  );
  if (!teamResult.ok) {
    return c.json({ error: teamResult.error }, 400);
  }

  const team = teamResult.value;
  const teamDTO: TeamDTO = {
    id: team.id,
    name: team.name,
    credits: team.credits,
    player: {
      id: playerResult.value.id,
      name: playerResult.value.username,
    },
  };
  return c.json(teamDTO, 201);
});

leagues.get("/:id/market", async (c) => {
  const leagueId = c.req.param("id");
  const service = new ArticleMarketService(c.env.db);
  const result = await service.getMarket(leagueId);
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }
  return c.json(result.value);
});

leagues.get("/:id/my-contracts", async (c) => {
  const leagueId = c.req.param("id");
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const service = new ContractService(c.env.db);
  const result = await service.getMyContracts(playerResult.value.id, leagueId);
  if (!result.ok) {
    return c.json({ error: result.error }, contractErrorStatus(result.error));
  }
  return c.json(result.value);
});

leagues.post("/:id/my-contracts", async (c) => {
  const leagueId = c.req.param("id");
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const body = await c.req
    .json<{ articleId?: string; tier?: string }>()
    .catch(() => ({ articleId: undefined, tier: undefined }));
  if (!body.articleId || typeof body.articleId !== "string") {
    return c.json({ error: "articleId is required" }, 400);
  }
  if (!body.tier || typeof body.tier !== "string") {
    return c.json({ error: "tier is required" }, 400);
  }

  const service = new ContractService(c.env.db);
  const result = await service.buyContract(
    playerResult.value.id,
    leagueId,
    body.articleId,
    body.tier,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, contractErrorStatus(result.error));
  }
  return c.json(result.value, 201);
});

leagues.post("/:id/my-contracts/:contractId/sell", async (c) => {
  const leagueId = c.req.param("id");
  const contractId = c.req.param("contractId");
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const service = new ContractService(c.env.db);
  const result = await service.sellContract(
    playerResult.value.id,
    leagueId,
    contractId,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, contractErrorStatus(result.error));
  }
  return c.json(result.value);
});

leagues.post("/:id/my-contracts/:contractId/renew", async (c) => {
  const leagueId = c.req.param("id");
  const contractId = c.req.param("contractId");
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const service = new ContractService(c.env.db);
  const result = await service.electRenewal(
    playerResult.value.id,
    leagueId,
    contractId,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, contractErrorStatus(result.error));
  }
  return c.json(result.value);
});

// The election is the resource being removed, so DELETE on the same path — the
// intent can be withdrawn any time before the settlement sweep acts on it.
leagues.delete("/:id/my-contracts/:contractId/renew", async (c) => {
  const leagueId = c.req.param("id");
  const contractId = c.req.param("contractId");
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const service = new ContractService(c.env.db);
  const result = await service.cancelRenewal(
    playerResult.value.id,
    leagueId,
    contractId,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, contractErrorStatus(result.error));
  }
  return c.json(result.value);
});

leagues.get("/:id/contracts", async (c) => {
  const leagueId = c.req.param("id");
  const service = new ContractService(c.env.db);
  const result = await service.getLeagueContracts(leagueId);
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }
  return c.json(result.value);
});

leagues.get("/:id/contracts", async (c) => {
  const leagueId = c.req.param("id");
  const service = new ContractService(c.env.db);
  const result = await service.getLeagueContracts(leagueId);
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }
  return c.json(result.value);
});

leagues.get("/:id/lineup", async (c) => {
  const leagueId = c.req.param("id");
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const lineupService = new LineupService(c.env.db);
  const result = await lineupService.getLineup(playerResult.value.id, leagueId);
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.error === LINEUP_ERRORS.NO_TEAM ? 404 : 500,
    );
  }
  return c.json(result.value);
});

leagues.put("/:id/lineup", async (c) => {
  const leagueId = c.req.param("id");
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const body: unknown = await c.req.json().catch(() => null);
  const payloadResult = parseLineupPayload(body);
  if (!payloadResult.ok) {
    return c.json({ error: payloadResult.error }, 400);
  }

  const lineupService = new LineupService(c.env.db);
  const result = await lineupService.saveLineup(
    playerResult.value.id,
    leagueId,
    payloadResult.value,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }
  return c.json({ success: true });
});

leagues.get("/:id/my-notifications", async (c) => {
  const leagueId = c.req.param("id");
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const notificationService = new NotificationService(c.env.db);
  const result = await notificationService.getMyNotifications(
    playerResult.value.id,
    leagueId,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.value);
});

export default leagues;
