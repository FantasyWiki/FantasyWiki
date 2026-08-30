import { Hono } from "hono";
import type { LeaveLeagueResultDTO } from "../../../dto/leagueDTO";
import {
  LeagueService,
  LEAGUE_CREATION_ERRORS,
  LEAGUE_CLOSURE_ERRORS,
  parseCreateLeaguePayload,
  type LeagueCreationError,
  type LeagueClosureError,
} from "../services/league";
import {
  CALIBRATION_ERRORS,
  LanguageScaleCalibrationService,
} from "../services/languageScaleCalibration";
import { LeaderboardService } from "../services/leaderboard";
import { PerformanceService } from "../services/performance";
import { TeamService } from "../services/team";
import { PlayerService } from "../services/player";
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
import { TEAM_ERRORS, type TeamError } from "../repositories/teamRepository";
import { TeamDTO } from "../../../dto/teamDTO";
import { AppVariables } from "../appEnv";
import { currentPlayer } from "./currentPlayer";

/**
 * Cloudflare's rate limiting binding, declared structurally rather than pulled
 * from `cf-typegen` — the same shape `routes/reports.ts` declares, for the same
 * reason: the routes that use one should not have to be regenerated into
 * existence.
 */
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

type Bindings = {
  /**
   * Guards the two paths that accept an invitation code. ADR 0008 accepted a
   * 24.5-bit code as guessable-in-principle and named rate limiting as the
   * mitigation; this is it.
   *
   * One binding for both `GET /by-code/:code` and the code-bearing
   * `POST /:id/my-team`, so the two share a single bucket per player: separate
   * limiters would let a grinder alternate between them and spend twice the
   * budget. Resolve is the cheaper oracle of the two and would otherwise be the
   * one to grind.
   */
  JOIN_RATE_LIMITER: RateLimiter;
};

/**
 * The answer to a caller who has spent their code attempts. A bare code rather
 * than one of the `LEAGUE_ERRORS`/`TEAM_ERRORS` constants, matching
 * `REPORT_RATE_LIMITED`: it is not a way *joining* can fail — it is the
 * request never having been considered — so it has no place in a status map
 * over the join errors.
 */
export const JOIN_RATE_LIMITED = "JOIN_RATE_LIMITED";

const leagues = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

/**
 * The status every contract business failure maps to, per
 * docs/development/api-naming-rules.md: a missing resource is a 404, a broken purchase or
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

/**
 * The status every join failure maps to. A permission refusal is a 403 and a
 * missing league a 404, which the old blanket 400 could not express — and per
 * docs/architecture/backend-error-constants.md a status may never be derived
 * from message content. Total over `TeamError`, so a new constant without a
 * status fails to compile.
 *
 * JOIN_CONFLICT should never reach here — `TeamService` re-reads and translates
 * it into one of the others. It is mapped rather than omitted only because the
 * Record is total; 400 is the harmless answer if the classifier ever misses one.
 */
const TEAM_ERROR_STATUS: Record<TeamError, 404 | 409 | 403 | 400> = {
  [TEAM_ERRORS.NO_TEAM_IN_LEAGUE]: 404,
  [TEAM_ERRORS.NAME_LENGTH]: 400,
  [TEAM_ERRORS.NAME_TAKEN]: 400,
  [TEAM_ERRORS.ALREADY_HAS_TEAM]: 400,
  [TEAM_ERRORS.LEAGUE_IS_PRIVATE]: 403,
  // 409, not 403: the refusal is about the state of the league, not about who
  // is asking. Nobody can join an ended league — a valid code and the admin
  // themselves are turned away too — and 403 would invite the client to read it
  // as "get permission and retry".
  [TEAM_ERRORS.LEAGUE_INACTIVE]: 409,
  [TEAM_ERRORS.JOIN_CONFLICT]: 400,
  // The lifecycle refusals. 403 where the answer would be the same however many
  // times it is asked — this caller may not do this, ever — and 409 where the
  // request lost to the state of the world: a season that has stopped (that is
  // LEAGUE_INACTIVE above, which serves leaving as well as joining), or a
  // departure already on the record.
  [TEAM_ERRORS.ALREADY_LEFT]: 409,
  [TEAM_ERRORS.CANNOT_LEAVE_GLOBAL]: 403,
  // As with JOIN_CONFLICT: the classifier should have replaced it, and 409 is
  // the harmless answer if it ever misses one.
  [TEAM_ERRORS.LEAVE_CONFLICT]: 409,
};

export function teamErrorStatus(error: string): 404 | 409 | 403 | 400 | 500 {
  if (error in TEAM_ERROR_STATUS) {
    return TEAM_ERROR_STATUS[error as TeamError];
  }
  if (error === LEAGUE_ERRORS.NOT_FOUND) return 404;
  // Anything the service did not name — a D1 outage — is ours.
  return 500;
}

/**
 * Every way founding a league can be refused. All 400: each one names a field
 * the client sent and can fix. Total over `LeagueCreationError`, so a new
 * rejection without a status fails to compile.
 */
const LEAGUE_CREATION_ERROR_STATUS: Record<LeagueCreationError, 400> = {
  [LEAGUE_CREATION_ERRORS.INVALID_PAYLOAD]: 400,
  [LEAGUE_CREATION_ERRORS.NAME_LENGTH]: 400,
  [LEAGUE_CREATION_ERRORS.UNKNOWN_ICON]: 400,
  [LEAGUE_CREATION_ERRORS.UNKNOWN_DOMAIN]: 400,
  [LEAGUE_CREATION_ERRORS.UNKNOWN_DURATION]: 400,
  [LEAGUE_CREATION_ERRORS.UNKNOWN_VISIBILITY]: 400,
  [LEAGUE_CREATION_ERRORS.UNKNOWN_INVITE_POLICY]: 400,
  [LEAGUE_CREATION_ERRORS.TEAM_NAME_LENGTH]: 400,
  [LEAGUE_CREATION_ERRORS.UNCALIBRATED_DOMAIN]: 400,
};

/**
 * Running out of invitation codes is deliberately *not* in the map above: with
 * 24.3 million of them, exhausting five draws means a stuck RNG or a broken
 * index, which is ours to fix and not something the client can restate.
 *
 * Calibration adds the one refusal on this path that is neither the client's
 * fault nor a bug: Wikimedia being unreachable. It answers 503, because the
 * request was well-formed and *will* work later — the same payload retried in a
 * minute may found the league. `BELOW_FLOOR` is a 400 beside it: that edition
 * will never be big enough, and the fix is to choose another one.
 */
export function leagueCreationErrorStatus(error: string): 400 | 503 | 500 {
  if (error in LEAGUE_CREATION_ERROR_STATUS) return 400;
  if (error === CALIBRATION_ERRORS.BELOW_FLOOR) return 400;
  if (error === CALIBRATION_ERRORS.UNAVAILABLE) return 503;
  return 500;
}

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

leagues.get("/", currentPlayer, async (c) => {
  const leaguesResult = await new PlayerService(
    c.var.repositories,
  ).getLeaguesByPlayerId(c.var.player.id);
  if (!leaguesResult.ok) {
    return c.json({ error: leaguesResult.error }, 500);
  }
  const leagueService = new LeagueService(c.var.repositories);
  const dtos = await leagueService.toLeagueDTOs(leaguesResult.value);
  if (!dtos.ok) {
    return c.json({ error: dtos.error }, 500);
  }
  return c.json(dtos.value);
});

/**
 * Found a league. The founder is the caller — resolved from the session, never
 * taken from the body — and is written into the league as both its admin and
 * its first team, in one transaction.
 *
 * The response is an ordinary `LeagueDTO`, invitation code included nowhere in
 * it: a private league's founder reads theirs from `/:id/invite-code`, which
 * they now pass by being a member.
 */
leagues.post("/", currentPlayer, async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const payloadResult = parseCreateLeaguePayload(body);
  if (!payloadResult.ok) {
    // Through the map rather than a literal 400, so the total Record is what
    // actually decides the status here — a new rejection with no entry then
    // fails to compile instead of quietly inheriting someone else's answer.
    return c.json(
      { error: payloadResult.error },
      leagueCreationErrorStatus(payloadResult.error),
    );
  }

  // The only path that needs a calibrator: founding is where an edition's factor
  // is measured and frozen (ADR 0002), and a service without one refuses rather
  // than default the factor to the `en` reference.
  const leagueService = new LeagueService({
    ...c.var.repositories,
    calibration: new LanguageScaleCalibrationService({
      ...c.var.repositories,
      wikimedia: c.var.wikimedia,
    }),
  });
  const result = await leagueService.createLeague(
    c.var.player.id,
    payloadResult.value,
  );
  if (!result.ok) {
    return c.json(
      { error: result.error },
      leagueCreationErrorStatus(result.error),
    );
  }
  return c.json(result.value, 201);
});

leagues.get("/global", async (c) => {
  const leagueService = new LeagueService(c.var.repositories);
  const result = await leagueService.getGlobalLeague();
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }
  return c.json(result.value);
});

/**
 * Every public league, newest first — the shelf the league section offers a
 * player who wants somewhere else to play.
 *
 * Not caller-scoped: the leagues they already play are dropped client-side,
 * where the list of those already lives.
 */
leagues.get("/public", async (c) => {
  const leagueService = new LeagueService(c.var.repositories);
  const result = await leagueService.getPublicLeagues();
  if (!result.ok) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.value);
});

/**
 * The league an invitation code opens — the preview that lets a player see what
 * they have been invited to before naming a team in it, which
 * docs/domain/league-visibility.md says they should be able to do.
 *
 * Rate limited, and this is the endpoint that most needs it: it is the cheapest
 * possible probe of the code space — one GET, no body, no write — so it, not
 * the join, is what a guesser would grind. It shares its bucket with the
 * redeem path so the two cannot be alternated for double the budget.
 *
 * The code is in the path rather than a query string because it *is* the
 * resource being addressed here (api-naming-rules.md §2). It never reaches a
 * log we keep, and it is already travelling in the invitation link that led the
 * player here.
 *
 * A caller who has run out of attempts is told so (429). That is not a leak:
 * they learn about their own quota, never about the code they sent.
 */
leagues.get("/by-code/:code", currentPlayer, async (c) => {
  // Keyed on the player, not the IP: every caller here is authenticated, and an
  // account is the more expensive thing to mint.
  const { success } = await c.env.JOIN_RATE_LIMITER.limit({
    key: c.var.player.id,
  });
  if (!success) {
    return c.json({ error: JOIN_RATE_LIMITED }, 429);
  }

  const leagueService = new LeagueService(c.var.repositories);
  const result = await leagueService.getLeagueByInvitationCode(
    c.req.param("code"),
  );
  if (!result.ok) {
    // One answer for a malformed code, an unused code and a missing league —
    // see `getLeagueByInvitationCode`. Anything else is a D1 failure and ours.
    return c.json(
      { error: result.error },
      result.error === LEAGUE_ERRORS.NOT_FOUND ? 404 : 500,
    );
  }
  return c.json(result.value);
});

// Registered after `/global`, `/public` and `/by-code/:code` on purpose: Hono
// matches in registration order, so a literal path has to be declared first or
// it would be swallowed by `:id`.
leagues.get("/:id", async (c) => {
  const leagueService = new LeagueService(c.var.repositories);
  const result = await leagueService.getLeagueById(c.req.param("id"));
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.error === LEAGUE_ERRORS.NOT_FOUND ? 404 : 500,
    );
  }
  return c.json(result.value);
});

leagues.get("/:id/leaderboard", async (c) => {
  const leagueId = c.req.param("id");
  const leaderboardService = new LeaderboardService(c.var.repositories);
  const result = await leaderboardService.getLeaderboard(leagueId);
  if (!result.ok) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.value);
});

leagues.get("/:id/my-team", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const teamService = new TeamService(c.var.repositories);
  const teamResult = await teamService.getMyTeam(
    c.var.player.id,
    leagueId,
    c.var.player.username,
  );
  if (!teamResult.ok) {
    return c.json({ error: teamResult.error }, 500);
  }
  if (teamResult.value === null) {
    return c.json({ error: TEAM_ERRORS.NO_TEAM_IN_LEAGUE }, 404);
  }
  return c.json(teamResult.value);
});

/**
 * The league's invitation code, for a caller its invite policy lets hand it
 * out. Not `my-`: the code is the league's datum, not the caller's — the
 * caller only decides whether they may see it.
 */
leagues.get("/:id/invite-code", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const teamService = new TeamService(c.var.repositories);
  const teamResult = await teamService.getMyTeam(
    c.var.player.id,
    leagueId,
    c.var.player.username,
  );
  if (!teamResult.ok) {
    return c.json({ error: teamResult.error }, 500);
  }

  const leagueService = new LeagueService(c.var.repositories);
  const result = await leagueService.getInvitationCode(
    c.var.player.id,
    leagueId,
    teamResult.value !== null,
  );
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.error === LEAGUE_ERRORS.NOT_FOUND ||
        result.error === LEAGUE_ERRORS.NO_INVITATION_CODE
        ? 404
        : 500,
    );
  }
  return c.json(result.value);
});

leagues.get("/:id/my-performances", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const rawLimit = parseInt(c.req.query("limit") ?? "2", 10);
  const limit = Math.max(1, Number.isNaN(rawLimit) ? 2 : rawLimit);

  const teamService = new TeamService(c.var.repositories);
  const teamResult = await teamService.getMyTeam(
    c.var.player.id,
    leagueId,
    c.var.player.username,
  );
  if (!teamResult.ok) {
    return c.json({ error: teamResult.error }, 500);
  }
  if (teamResult.value === null) {
    return c.json({ error: TEAM_ERRORS.NO_TEAM_IN_LEAGUE }, 404);
  }

  const performanceService = new PerformanceService(c.var.repositories);
  const perfResult = await performanceService.getRecentForTeam(
    teamResult.value.id,
    limit,
  );
  if (!perfResult.ok) {
    return c.json({ error: perfResult.error }, 500);
  }
  return c.json(perfResult.value);
});

leagues.post("/:id/my-team", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const body = await c.req
    .json<{ name?: string; invitationCode?: string }>()
    .catch(() => ({ name: undefined, invitationCode: undefined }));
  if (!body.name || typeof body.name !== "string") {
    return c.json({ error: "name is required" }, 400);
  }

  const presentedCode =
    typeof body.invitationCode === "string" ? body.invitationCode : undefined;

  // Only a request that presents a code spends from the bucket, which is what
  // keeps the limiter off signup and off the public-league shelf — neither
  // carries one, and neither is a guessing surface. Nothing escapes through the
  // gap: a request *without* a code learns only "this league is private",
  // which is the same sentence for every private league in the database, so
  // there is nothing there to grind. Shared with `GET /by-code/:code`, so
  // alternating between the two buys no extra attempts.
  if (presentedCode !== undefined) {
    const { success } = await c.env.JOIN_RATE_LIMITER.limit({
      key: c.var.player.id,
    });
    if (!success) {
      return c.json({ error: JOIN_RATE_LIMITED }, 429);
    }
  }

  const teamService = new TeamService(c.var.repositories);
  const teamResult = await teamService.createTeam(
    c.var.player.id,
    leagueId,
    body.name,
    // Only consulted for a private league; a public one ignores it.
    presentedCode,
  );
  if (!teamResult.ok) {
    return c.json(
      { error: teamResult.error },
      teamErrorStatus(teamResult.error),
    );
  }

  const team = teamResult.value;
  const teamDTO: TeamDTO = {
    id: team.id,
    name: team.name,
    credits: team.credits,
    player: {
      id: c.var.player.id,
      name: c.var.player.username,
    },
  };
  return c.json(teamDTO, 201);
});

leagues.get("/:id/my-contracts", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const service = new ContractService({
    ...c.var.repositories,
    wikimedia: c.var.wikimedia,
  });
  const result = await service.getMyContracts(c.var.player.id, leagueId);
  if (!result.ok) {
    return c.json({ error: result.error }, contractErrorStatus(result.error));
  }
  return c.json(result.value);
});

leagues.post("/:id/my-contracts", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const body = await c.req
    .json<{ articleId?: string; tier?: string }>()
    .catch(() => ({ articleId: undefined, tier: undefined }));
  if (!body.articleId || typeof body.articleId !== "string") {
    return c.json({ error: "articleId is required" }, 400);
  }
  if (!body.tier || typeof body.tier !== "string") {
    return c.json({ error: "tier is required" }, 400);
  }

  const service = new ContractService({
    ...c.var.repositories,
    wikimedia: c.var.wikimedia,
  });
  const result = await service.buyContract(
    c.var.player.id,
    leagueId,
    body.articleId,
    body.tier,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, contractErrorStatus(result.error));
  }
  return c.json(result.value, 201);
});

leagues.post("/:id/my-contracts/:contractId/sell", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const contractId = c.req.param("contractId");
  const service = new ContractService({
    ...c.var.repositories,
    wikimedia: c.var.wikimedia,
  });
  const result = await service.sellContract(
    c.var.player.id,
    leagueId,
    contractId,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, contractErrorStatus(result.error));
  }
  return c.json(result.value);
});

leagues.post(
  "/:id/my-contracts/:contractId/renew",
  currentPlayer,
  async (c) => {
    const leagueId = c.req.param("id");
    const contractId = c.req.param("contractId");
    const service = new ContractService({
      ...c.var.repositories,
      wikimedia: c.var.wikimedia,
    });
    const result = await service.electRenewal(
      c.var.player.id,
      leagueId,
      contractId,
    );
    if (!result.ok) {
      return c.json({ error: result.error }, contractErrorStatus(result.error));
    }
    return c.json(result.value);
  },
);

// The election is the resource being removed, so DELETE on the same path — the
// intent can be withdrawn any time before the settlement sweep acts on it.
leagues.delete(
  "/:id/my-contracts/:contractId/renew",
  currentPlayer,
  async (c) => {
    const leagueId = c.req.param("id");
    const contractId = c.req.param("contractId");
    const service = new ContractService({
      ...c.var.repositories,
      wikimedia: c.var.wikimedia,
    });
    const result = await service.cancelRenewal(
      c.var.player.id,
      leagueId,
      contractId,
    );
    if (!result.ok) {
      return c.json({ error: result.error }, contractErrorStatus(result.error));
    }
    return c.json(result.value);
  },
);

leagues.get("/:id/contracts", async (c) => {
  const leagueId = c.req.param("id");
  const service = new ContractService({
    ...c.var.repositories,
    wikimedia: c.var.wikimedia,
  });
  const result = await service.getLeagueContracts(leagueId);
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }
  return c.json(result.value);
});

leagues.get("/:id/lineup", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const lineupService = new LineupService({
    ...c.var.repositories,
    teamService: new TeamService(c.var.repositories),
  });
  const result = await lineupService.getLineup(c.var.player.id, leagueId);
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.error === LINEUP_ERRORS.NO_TEAM ? 404 : 500,
    );
  }
  return c.json(result.value);
});

// Another team's line-up, read-only. The team is named in the path because the
// viewer does not own it — unlike `/:id/lineup`, which is self-scoped from the
// JWT. Teams on a league's standings are shareably visible (api-naming-rules.md),
// so the id in the URL is not a security control: the standings already name
// every team in the league to every member. A team id outside the league
// resolves to NO_TEAM → 404, so a wrong link is reported as not-found.
leagues.get("/:id/teams/:teamId/lineup", async (c) => {
  const leagueId = c.req.param("id");
  const teamId = c.req.param("teamId");

  const lineupService = new LineupService({
    ...c.var.repositories,
    teamService: new TeamService(c.var.repositories),
  });
  const result = await lineupService.getRivalLineup(leagueId, teamId);
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.error === LINEUP_ERRORS.NO_TEAM ? 404 : 500,
    );
  }
  return c.json(result.value);
});

leagues.put("/:id/lineup", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const body: unknown = await c.req.json().catch(() => null);
  const payloadResult = parseLineupPayload(body);
  if (!payloadResult.ok) {
    return c.json({ error: payloadResult.error }, 400);
  }

  const lineupService = new LineupService({
    ...c.var.repositories,
    teamService: new TeamService(c.var.repositories),
  });
  const result = await lineupService.saveLineup(
    c.var.player.id,
    leagueId,
    payloadResult.value,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }
  return c.json({ success: true });
});

leagues.get("/:id/my-notifications", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const notificationService = new NotificationService(c.var.repositories);
  const result = await notificationService.getMyNotifications(
    c.var.player.id,
    leagueId,
  );
  if (!result.ok) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.value);
});

/**
 * The status every close refusal maps to. Total over `LeagueClosureError`, so a
 * new rejection without a status fails to compile.
 *
 * `NOT_ADMIN` is a 403 rather than the 404 the invite-code endpoint answers a
 * caller it does not trust: there is nothing to conceal here. A league's page,
 * dates and standings are readable by anyone holding its id
 * (docs/domain/league-visibility.md), so "this league exists and you are not
 * its admin" tells a caller nothing they could not already see, and telling
 * them plainly is worth more than a refusal they would have to interpret.
 */
const LEAGUE_CLOSURE_ERROR_STATUS: Record<LeagueClosureError, 403 | 409> = {
  [LEAGUE_CLOSURE_ERRORS.NOT_ADMIN]: 403,
  [LEAGUE_CLOSURE_ERRORS.ALREADY_CLOSED]: 409,
};

export function leagueClosureErrorStatus(error: string): 404 | 403 | 409 | 500 {
  if (error in LEAGUE_CLOSURE_ERROR_STATUS) {
    return LEAGUE_CLOSURE_ERROR_STATUS[error as LeagueClosureError];
  }
  if (error === LEAGUE_ERRORS.NOT_FOUND) return 404;
  // Should never arrive — the service re-reads and names the cause — but the
  // sentinel is a conflict if the classifier ever fails to place it.
  if (error === LEAGUE_ERRORS.CLOSE_CONFLICT) return 409;
  // Anything nobody named is ours.
  return 500;
}

/**
 * What the caller is in this league. `my-` because it is entirely about them
 * (api-naming-rules.md §3) — the league itself is served, unscoped, by
 * `GET /leagues/:id`, and this is the caller-specific half kept off that shape.
 *
 * It exists so the page can offer the right two actions, not to authorize
 * either: both are settled again inside their own write.
 */
leagues.get("/:id/my-role", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const teamService = new TeamService(c.var.repositories);
  const teamResult = await teamService.getMyTeam(
    c.var.player.id,
    leagueId,
    c.var.player.username,
  );
  if (!teamResult.ok) {
    return c.json({ error: teamResult.error }, 500);
  }

  const leagueService = new LeagueService(c.var.repositories);
  const result = await leagueService.getMyRole(
    c.var.player.id,
    leagueId,
    teamResult.value !== null,
  );
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.error === LEAGUE_ERRORS.NOT_FOUND ? 404 : 500,
    );
  }
  return c.json(result.value);
});

/**
 * Close a league early. The admin is the caller, resolved from the session, and
 * the rule that only they may is enforced inside the write.
 *
 * A noun, and `POST` rather than `DELETE /leagues/:id`, because nothing is
 * removed: this creates the league's closure and leaves the league itself —
 * teams, contracts, standings — entirely readable. There is no endpoint that
 * deletes a league, and there should not be one
 * (docs/domain/league-lifecycle.md).
 */
leagues.post("/:id/closure", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const leagueService = new LeagueService(c.var.repositories);
  const result = await leagueService.closeLeague(c.var.player.id, leagueId);
  if (!result.ok) {
    return c.json(
      { error: result.error },
      leagueClosureErrorStatus(result.error),
    );
  }
  return c.json(result.value);
});

/**
 * Leave a league. `my-` because it is the caller's own participation being
 * ended and no `playerId` is taken from the client (api-naming-rules.md §3),
 * and a departure rather than a deletion because the team stays: it keeps its
 * contracts and its place in the final table.
 */
leagues.post("/:id/my-departure", currentPlayer, async (c) => {
  const leagueId = c.req.param("id");
  const teamService = new TeamService(c.var.repositories);
  const result = await teamService.leaveLeague(c.var.player.id, leagueId);
  if (!result.ok) {
    return c.json({ error: result.error }, teamErrorStatus(result.error));
  }
  return c.json(result.value satisfies LeaveLeagueResultDTO);
});

export default leagues;
