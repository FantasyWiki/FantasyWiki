import { Hono } from "hono";
import { JWTPayload } from "hono/utils/jwt/types";
import { toLeagueDTO } from "../services/leagues";
import { LeagueService } from "../services/league";
import { TeamService } from "../services/team";
import { PlayerService } from "../services/player";
import { ArticleMarketService } from "../services/articleMarket";
import { TeamDTO } from "../../../dto/teamDTO";

type Bindings = {
  db: D1Database;
};

const leagues = new Hono<{ Bindings: Bindings }>();

leagues.get("/", async (c) => {
  // The current player's leagues, resolved from the JWT (never from the client).
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

  return c.json(leaguesResult.value.map(toLeagueDTO));
});

leagues.get("/global", async (c) => {
  const leagueService = new LeagueService(c.env.db);
  const result = await leagueService.getGlobalLeague();
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }
  return c.json(result.value);
});

leagues.get("/:id/my-team", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

leagues.post("/:id/my-team", async (c) => {
  const leagueId = c.req.param("id");
  const payload = c.get("jwtPayload") as JWTPayload;

  const playerService = new PlayerService(c.env.db);
  const playerResult = await playerService.getPlayerByGoogleAccountId(
    payload.sub as string,
  );
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
    points: 0,
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
  return c.json({ error: "Not implemented" }, 501);
});

leagues.get("/:id/my-notifications", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

export default leagues;
