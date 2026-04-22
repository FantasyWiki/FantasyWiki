import { http, HttpResponse, passthrough } from "msw";
import { Temporal } from "@js-temporal/polyfill";
import {
  contracts,
  currentPlayerId,
  leagues,
  articles,
  notifications,
  players,
  teams,
} from "./data";
import { ContractDTO } from "../../../dto/contractDTO";
import type { TeamDTO } from "../../../dto/teamDTO";
import Instant = Temporal.Instant;

// =============================================================================
// HELPER
// =============================================================================

function getMyTeam(leagueId: string): TeamDTO | undefined {
  const league = leagues.find((l) => l.id === leagueId);
  return league?.teams.find((t) => t.player.id === currentPlayerId);
}

// =============================================================================
// HANDLERS
// =============================================================================

export const handlers = [
  // ── Session & Auth → passthrough al backend reale ──────────────────────────
  // Il login Google è un redirect del browser (non fetch), MSW non lo vede.
  // /api/session è invece una fetch normale: la lasciamo passare al backend
  // reale così il JWT viene letto davvero dopo il login Google.
  http.get("*/auth/*", () => passthrough()),
  http.get("*/api/session", () => passthrough()),
  http.delete("*/api/session", () => passthrough()),

  // ── Player ──────────────────────────────────────────────────────────────────
  http.get("*/api/player", () => {
    const player = players.find((p) => p.id === currentPlayerId);
    if (!player)
      return HttpResponse.json({ error: "Player not found" }, { status: 404 });
    return HttpResponse.json(player);
  }),

  http.get("*/api/player/teams", () => {
    return HttpResponse.json(
      teams.filter((t) => t.player.id === currentPlayerId)
    );
  }),

  http.get("*/api/player/notifications", () => {
    const playerTeamIds = teams
      .filter((t) => t.player.id === currentPlayerId)
      .map((t) => t.id);
    return HttpResponse.json(
      notifications.filter((n) => playerTeamIds.includes(n.contract.team.id))
    );
  }),

  // ── Leagues ─────────────────────────────────────────────────────────────────
  http.get("*/api/leagues", () => HttpResponse.json(leagues)),

  http.get("*/api/leagues/:leagueId", ({ params }) => {
    const league = leagues.find((l) => l.id === params.leagueId);
    if (!league)
      return HttpResponse.json({ error: "League not found" }, { status: 404 });
    return HttpResponse.json(league);
  }),

  http.get("*/api/leagues/:leagueId/team", ({ params }) => {
    const team = getMyTeam(params.leagueId as string);
    if (!team)
      return HttpResponse.json(
        { error: "No team found for this league" },
        { status: 404 }
      );
    return HttpResponse.json(team);
  }),

  http.get("*/api/leagues/:leagueId/contracts", ({ params }) => {
    const team = getMyTeam(params.leagueId as string);
    if (!team) return HttpResponse.json([]);
    return HttpResponse.json(contracts.filter((c) => c.team.id === team.id));
  }),

  http.get("*/api/leagues/:leagueId/notifications", ({ params }) => {
    const league = leagues.find((l) => l.id === params.leagueId);
    if (!league) return HttpResponse.json([]);
    const teamIdsInLeague = league.teams.map((t) => t.id);
    return HttpResponse.json(
      notifications.filter((n) => teamIdsInLeague.includes(n.contract.team.id))
    );
  }),

  // ── Teams ────────────────────────────────────────────────────────────────────
  http.get("*/api/teams/:teamId", ({ params }) => {
    const team = teams.find((t) => t.id === params.teamId);
    if (!team)
      return HttpResponse.json({ error: "Team not found" }, { status: 404 });
    if (team.player.id !== currentPlayerId)
      return HttpResponse.json({ error: "Access denied" }, { status: 403 });
    return HttpResponse.json(team);
  }),

  http.get("*/api/teams/:teamId/contracts", ({ params }) => {
    return HttpResponse.json(
      contracts.filter((c) => c.team.id === params.teamId)
    );
  }),

  http.get("*/api/teams/:teamId/notifications", ({ params }) => {
    return HttpResponse.json(
      notifications.filter((n) => n.contract.team.id === params.teamId)
    );
  }),

  http.post("*/api/teams/:teamId/contracts", async ({ params, request }) => {
    const data = (await request.json()) as {
      teamID: string;
      articleID: string;
      startDate: Temporal.Instant;
      duration: Temporal.Duration;
      purchasePrice: number;
    };
    const team = teams.find(
      (t) => t.id === params.teamId && t.player.id === currentPlayerId
    );
    if (!team)
      return HttpResponse.json({ error: "Team not found" }, { status: 404 });
    if (team.credits < data.purchasePrice)
      return HttpResponse.json(
        { error: "Insufficient credits" },
        { status: 400 }
      );

    const article = articles.find(
      (a: { id: string }) => a.id === data.articleID
    );
    if (!article)
      return HttpResponse.json({ error: "Article not found" }, { status: 404 });

    const newContract = new ContractDTO(
      `ctr-${Date.now()}`,
      team,
      article,
      data.startDate || Instant.from(Temporal.Now.instant().toString()),
      data.duration || Temporal.Duration.from({ days: 14 }),
      data.purchasePrice
    );
    contracts.push(newContract);
    team.credits -= data.purchasePrice;
    return HttpResponse.json(newContract, { status: 201 });
  }),

  // ── Contracts ────────────────────────────────────────────────────────────────
  http.get("*/api/contracts/:contractId", ({ params }) => {
    const contract = contracts.find((c) => c.id === params.contractId);
    if (!contract)
      return HttpResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    return HttpResponse.json(contract);
  }),

  http.delete("*/api/contracts/:contractId", ({ params }) => {
    const idx = contracts.findIndex((c) => c.id === params.contractId);
    if (idx === -1)
      return HttpResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );

    const contract = contracts[idx];
    const team = teams.find(
      (t) => t.id === contract.team.id && t.player.id === currentPlayerId
    );
    if (!team)
      return HttpResponse.json({ error: "Access denied" }, { status: 403 });

    team.credits += contract.purchasePrice;
    contracts.splice(idx, 1);
    return HttpResponse.json({
      message: "Contract deleted successfully",
      refundedCredits: contract.purchasePrice,
    });
  }),

  // ── Notifications ─────────────────────────────────────────────────────────────
  http.get("*/api/notifications", () => {
    const playerTeamIds = teams
      .filter((t) => t.player.id === currentPlayerId)
      .map((t) => t.id);
    return HttpResponse.json(
      notifications.filter((n) => playerTeamIds.includes(n.contract.team.id))
    );
  }),

  http.patch("*/api/notifications/:notificationId/read", ({ params }) => {
    const notif = notifications.find((n) => n.id === params.notificationId);
    if (!notif)
      return HttpResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    notif.isRead = true;
    return HttpResponse.json(notif);
  }),

  // ── Articles ──────────────────────────────────────────────────────────────────
  http.get("*/api/articles", () => HttpResponse.json(articles)),

  http.get("*/api/articles/:articleId", ({ params }) => {
    const article = articles.find(
      (a: { id: string | readonly string[] | undefined }) =>
        a.id === params.articleId
    );
    if (!article)
      return HttpResponse.json({ error: "Article not found" }, { status: 404 });
    return HttpResponse.json(article);
  }),

  // ── Performances ──────────────────────────────────────────────────────────────
  http.get("*/api/leagues/:leagueId/performances", () => {
    const performances = [
      { id: "perf-1", date: Temporal.PlainDate.from("2024-02-01"), points: 12 },
      { id: "perf-2", date: Temporal.PlainDate.from("2024-02-02"), points: 15 },
    ];
    return HttpResponse.json(performances);
  }),
];
