import { http, HttpResponse, passthrough } from "msw";
import { Temporal } from "@js-temporal/polyfill";
import type { ArticleDTO } from "../../../dto/articleDTO";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import type { TeamDTO } from "../../../dto/teamDTO";
import type { PlayerDTO } from "../../../dto/playerDTO";
import { ContractDTO } from "../../../dto/contractDTO";
import type { NotificationDTO } from "../../../dto/notificationDTO";
import Instant = Temporal.Instant;

const currentPlayerId = "player-1";

function instantDaysFromNow(days: number) {
  return Temporal.Now.instant()
    .toZonedDateTimeISO("UTC")
    .add({ days })
    .toInstant();
}

// =============================================================================
// MOCK DATA
// =============================================================================

const articles: ArticleDTO[] = [
  { id: "art-1", title: "Bitcoin", domain: "itwiki" },
  { id: "art-2", title: "Ethereum", domain: "itwiki" },
  { id: "art-3", title: "Intelligenza Artificiale", domain: "itwiki" },
  { id: "art-4", title: "Machine Learning", domain: "itwiki" },
  { id: "art-5", title: "Cloud Computing", domain: "itwiki" },
  { id: "art-6", title: "Blockchain", domain: "itwiki" },
  { id: "art-7", title: "Python", domain: "itwiki" },
  { id: "art-8", title: "JavaScript", domain: "itwiki" },
  { id: "art-9", title: "React", domain: "itwiki" },
  { id: "art-10", title: "TypeScript", domain: "itwiki" },
  { id: "art-11", title: "Albert Einstein", domain: "enwiki" },
  { id: "art-12", title: "Artificial Intelligence", domain: "enwiki" },
];

const players: PlayerDTO[] = [
  { id: "player-1", name: "Mario_Rossi" },
  { id: "player-2", name: "WikiMaster" },
  { id: "player-3", name: "DataKing" },
  { id: "player-4", name: "AlexChen" },
  { id: "player-5", name: "SarahKim" },
  { id: "player-6", name: "JamieLee" },
];

const teams: TeamDTO[] = [
  {
    id: "team-1",
    name: "I Cesarini",
    player: players[0],
    credits: 550,
    points: 7250,
  },
  {
    id: "team-2",
    name: "Global Warriors",
    player: players[0],
    credits: 800,
    points: 12750,
  },
  {
    id: "team-3",
    name: "Euro Champions",
    player: players[0],
    credits: 320,
    points: 8950,
  },
  {
    id: "team-4",
    name: "Wiki Masters",
    player: players[1],
    credits: 200,
    points: 8950,
  },
  {
    id: "team-5",
    name: "Data Lords",
    player: players[2],
    credits: 450,
    points: 8420,
  },
  {
    id: "team-6",
    name: "Wiki Warriors",
    player: players[3],
    credits: 600,
    points: 11200,
  },
  {
    id: "team-7",
    name: "Data Dynamos",
    player: players[4],
    credits: 380,
    points: 7800,
  },
  {
    id: "team-8",
    name: "Page Pioneers",
    player: players[5],
    credits: 290,
    points: 6500,
  },
];

const leagues: LeagueDTO[] = [
  {
    id: "global",
    title: "Global League",
    icon: "🌍",
    description:
      "Compete with players from around the world in the ultimate Wikipedia trading experience!",
    domain: "en",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    endDate: Instant.from("2024-12-31T23:59:59Z"),
    teams: [teams[1], teams[5]],
  },
  {
    id: "italy",
    title: "Italia League",
    icon: "🍕",
    description: "La lega italiana",
    domain: "it",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    endDate: Instant.from("2024-02-28T23:59:59Z"),
    teams: [teams[0], teams[3], teams[4]],
  },
  {
    id: "europe",
    title: "Europe League",
    icon: "🇪🇺",
    description: "Compete across Europe",
    domain: "en",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    endDate: Instant.from("2024-03-15T23:59:59Z"),
    teams: [teams[2], teams[6]],
  },
  {
    id: "americas",
    title: "Americas League",
    icon: "🌎",
    description: "The Americas league",
    domain: "en",
    startDate: Instant.from("2024-01-01T00:00:00Z"),
    endDate: Instant.from("2024-03-20T23:59:59Z"),
    teams: [teams[7]],
  },
];

const contracts: ContractDTO[] = [
  new ContractDTO(
    "ctr-1",
    teams[0],
    articles[0],
    instantDaysFromNow(-8),
    Temporal.Duration.from({ days: 10 }),
    150
  ),
  new ContractDTO(
    "ctr-2",
    teams[0],
    articles[1],
    instantDaysFromNow(-20),
    Temporal.Duration.from({ days: 15 }),
    120
  ),
  new ContractDTO(
    "ctr-3",
    teams[0],
    articles[2],
    instantDaysFromNow(-15),
    Temporal.Duration.from({ days: 30 }),
    200
  ),
  new ContractDTO(
    "ctr-4",
    teams[0],
    articles[3],
    instantDaysFromNow(-4),
    Temporal.Duration.from({ days: 7 }),
    80
  ),
  new ContractDTO(
    "ctr-5",
    teams[1],
    articles[4],
    instantDaysFromNow(-20),
    Temporal.Duration.from({ days: 30 }),
    180
  ),
  new ContractDTO(
    "ctr-6",
    teams[1],
    articles[5],
    instantDaysFromNow(-13),
    Temporal.Duration.from({ days: 14 }),
    140
  ),
];

const notifications: NotificationDTO[] = [
  {
    id: "notif-1",
    leagueId: "italy",
    contract: contracts[0],
    message: "Contratto in scadenza: Bitcoin",
    date: Temporal.PlainDate.from("2024-02-09"),
    isRead: false,
  },
  {
    id: "notif-2",
    leagueId: "global",
    contract: contracts[5],
    message: "Contract expiring soon: Cloud Computing",
    date: Temporal.PlainDate.from("2024-02-09"),
    isRead: false,
  },
  {
    id: "notif-3",
    leagueId: "italy",
    contract: contracts[1],
    message: "Attenzione: il contratto per Ethereum scade a breve",
    date: Temporal.PlainDate.from("2024-02-12"),
    isRead: false,
  },
  {
    id: "notif-4",
    leagueId: "italy",
    contract: contracts[3],
    message: "Contratto terminato per Machine Learning",
    date: Temporal.PlainDate.from("2024-02-15"),
    isRead: true,
  },
  {
    id: "notif-5",
    leagueId: "global",
    contract: contracts[4],
    message: "Contract update: Artificial Intelligence usage increased",
    date: Temporal.PlainDate.from("2024-02-18"),
    isRead: false,
  },
];

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

    const article = articles.find((a) => a.id === data.articleID);
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
    const article = articles.find((a) => a.id === params.articleId);
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
