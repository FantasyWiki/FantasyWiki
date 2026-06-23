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
import type { TeamLineUp } from "@/types/team";
import { mockTeamResponse } from "@/mocks/formationMocks";
import Instant = Temporal.Instant;

// =============================================================================
// HELPER
// =============================================================================

function getMyTeam(leagueId: string): TeamDTO | undefined {
  const league = leagues.find((l) => l.id === leagueId);
  return league?.teams.find((t) => t.player.id === currentPlayerId);
}

function teamResponseKey(leagueId: string): string {
  return `${leagueId}`;
}

const mockTeamResponses: Record<string, TeamLineUp> = {
  [teamResponseKey("italy")]: mockTeamResponse,
  [teamResponseKey("global")]: mockTeamResponse,
  [teamResponseKey("europe")]: mockTeamResponse,
  [teamResponseKey("americas")]: mockTeamResponse,
};

// =============================================================================
// WIKIMEDIA MOCK DATA
// =============================================================================

const mockWikimediaTopRead = {
  items: [
    {
      project: "en.wikipedia",
      access: "all-access",
      year: "2026",
      month: "06",
      day: "25",
      articles: [
        { article: "Bitcoin", views: 48000, rank: 1 },
        { article: "Artificial_Intelligence", views: 45000, rank: 2 },
        { article: "Ethereum", views: 42000, rank: 3 },
        { article: "Machine_learning", views: 38000, rank: 4 },
        { article: "Blockchain", views: 35000, rank: 5 },
        { article: "Cryptocurrency", views: 32000, rank: 6 },
        { article: "Quantum_computing", views: 29000, rank: 7 },
        { article: "Large_language_model", views: 26000, rank: 8 },
        { article: "GPT-4", views: 23000, rank: 9 },
        { article: "Neural_network", views: 20000, rank: 10 },
        { article: "Deep_learning", views: 17000, rank: 11 },
        { article: "Robotics", views: 14000, rank: 12 },
      ],
    },
  ],
};

const mockWikimediaPerArticle = {
  items: Array.from({ length: 365 }, () => ({ views: 100 })),
};

const mockWikimediaSearch = {
  pages: [
    {
      key: "Photosynthesis",
      title: "Photosynthesis",
      description: "Process that converts light to energy",
    },
    {
      key: "Chlorophyll",
      title: "Chlorophyll",
      description: "Green pigment in plants",
    },
  ],
};

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

  http.get("*/api/leagues/global", () => {
    const league = leagues.find((l) => l.id === "global");
    if (!league)
      return HttpResponse.json({ error: "League not found" }, { status: 404 });
    return HttpResponse.json(league);
  }),

  http.get("*/api/leagues/:leagueId", ({ params }) => {
    const league = leagues.find((l) => l.id === params.leagueId);
    if (!league)
      return HttpResponse.json({ error: "League not found" }, { status: 404 });
    return HttpResponse.json(league);
  }),

  http.post("*/api/leagues/:leagueId/my-team", async ({ request }) => {
    const body = (await request.json()) as { name?: string };
    if (!body.name || typeof body.name !== "string") {
      return HttpResponse.json({ error: "name is required" }, { status: 400 });
    }

    const player = players.find((p) => p.id === currentPlayerId);
    const team: TeamDTO = {
      id: `team-${teams.length + 1}`,
      name: body.name.trim(),
      player: player!,
      credits: 1000,
      points: 0,
    };
    return HttpResponse.json(team, { status: 201 });
  }),

  http.get("*/api/leagues/:leagueId/my-team", ({ params }) => {
    const team = getMyTeam(params.leagueId as string);
    if (!team)
      return HttpResponse.json(
        { error: "No team found for this league" },
        { status: 404 }
      );
    return HttpResponse.json(team);
  }),

  http.get("*/api/leagues/:leagueId/lineup", ({ params }) => {
    const leagueId = String(params.leagueId);
    const key = teamResponseKey(leagueId);

    const response = mockTeamResponses[key];
    if (!response) {
      return HttpResponse.json(
        { error: "Team layout not found" },
        { status: 404 }
      );
    }

    return HttpResponse.json(response);
  }),

  http.put("*/api/leagues/:leagueId/lineup", async ({ params, request }) => {
    const leagueId = String(params.leagueId);
    const key = teamResponseKey(leagueId);

    if (!mockTeamResponses[key]) {
      return HttpResponse.json(
        { error: "Team layout not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as TeamLineUp;
    mockTeamResponses[key] = body;

    return HttpResponse.json(mockTeamResponses[key]);
  }),

  // Wikimedia pageviews API — top read list and per-article views
  http.get("https://wikimedia.org/api/rest_v1/metrics/pageviews/top/*", () =>
    HttpResponse.json(mockWikimediaTopRead)
  ),
  http.get(
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/*",
    () => HttpResponse.json(mockWikimediaPerArticle)
  ),

  // Wikimedia REST search API
  http.get("https://api.wikimedia.org/core/v1/wikipedia/*/search/page*", () =>
    HttpResponse.json(mockWikimediaSearch)
  ),

  http.get("*/api/leagues/:leagueId/contracts", ({ params }) => {
    const team = getMyTeam(params.leagueId as string);
    if (!team) return HttpResponse.json([]);
    return HttpResponse.json(contracts.filter((c) => c.team.id === team.id));
  }),

  http.get("*/api/leagues/:leagueId/my-notifications", ({ params }) => {
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
