import { Hono } from "hono";
import { JWTPayload } from "hono/utils/jwt/types";
import { LeagueService, toLeagueDTO } from "../services/league";
import { LeaderboardService } from "../services/leaderboard";
import { PerformanceService } from "../services/performance";
import { TeamService } from "../services/team";
import { PlayerService } from "../services/player";
import { ArticleMarketService } from "../services/articleMarket";
import { ContractService } from "../services/contract";
import {
  LineupService,
  RawTeamLineUp,
  LINEUP_ERRORS,
} from "../services/lineup";
import { NotificationService } from "../services/notification";
import { TeamDTO } from "../../../dto/teamDTO";
import { resolveCurrentPlayer } from "./helpers";

type Bindings = {
  db: D1Database;
};

const leagues = new Hono<{ Bindings: Bindings }>();

/**
 * Missing team/league failures map to 404; every other ContractService
 * failure (validation, slot/ownership conflicts, insufficient credits) is a
 * 400 per docs/api-naming-rules.md's route error-mapping convention.
 */
function contractErrorStatus(error: string): 404 | 400 {
  return error === "No team found for this league" || /not found/i.test(error)
    ? 404
    : 400;
}

leagues.get("/", async (c) => {
  const payload = c.get("jwtPayload") as JWTPayload;
  const playerService = new PlayerService(c.env.db);
  const playerResult = await playerService.getPlayerByGoogleAccountId(
    payload.sub as string,
  );
  if (!playerResult.ok) {
    return c.json({ error: playerResult.error }, 404);
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
    return c.json({ error: playerResult.error }, 404);
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
    return c.json({ error: "No team found for this league" }, 404);
  }
  return c.json(teamResult.value);
});

leagues.get("/:id/my-performances", async (c) => {
  const leagueId = c.req.param("id");
  const rawLimit = parseInt(c.req.query("limit") ?? "2", 10);
  const limit = Math.max(1, Number.isNaN(rawLimit) ? 2 : rawLimit);
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json({ error: playerResult.error }, 404);
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
    return c.json({ error: "No team found for this league" }, 404);
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
    return c.json({ error: playerResult.error }, 404);
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
    return c.json({ error: playerResult.error }, 404);
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
    return c.json({ error: playerResult.error }, 404);
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
    return c.json({ error: playerResult.error }, 404);
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
    return c.json({ error: playerResult.error }, 404);
  }

  const body = await c.req.json<RawTeamLineUp>().catch(() => null);
  if (body === null) {
    return c.json({ error: "Invalid lineup payload" }, 400);
  }

  const lineupService = new LineupService(c.env.db);
  const result = await lineupService.saveLineup(
    playerResult.value.id,
    leagueId,
    body,
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
    return c.json({ error: playerResult.error }, 404);
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
