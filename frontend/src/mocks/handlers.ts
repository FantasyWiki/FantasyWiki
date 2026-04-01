import { http, HttpResponse } from "msw";
import { Temporal } from "@js-temporal/polyfill";
import type {
  DashboardData,
} from "@/types/models";
import type { ArticleDTO } from "../../../dto/articleDTO";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import type { TeamDTO } from "../../../dto/teamDTO";
import type { PlayerDTO } from "../../../dto/playerDTO";
import type { ContractDTO } from "../../../dto/contractDTO";
import type { NotificationDTO } from "../../../dto/notificationDTO";

// =============================================================================
// MOCK DATA
// =============================================================================

// ── Articles ──────────────────────────────────────────────────────────────────

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

// ── Leagues ───────────────────────────────────────────────────────────────────

const leagues: LeagueDTO[] = [
  {
    id: "global",
    title: "Global League",
    icon: "🌍",


  },
  {
    id: "italy",
    name: "Italia League",
    icon: "🍕",
    season: "2024",
    language: "Italiano",
    totalPlayers: 523,
    endDate: "Feb 28, 2024",
  },
  {
    id: "europe",
    name: "Europe League",
    icon: "🇪🇺",
    season: "2024",
    language: "Multiple",
    totalPlayers: 2456,
    endDate: "Mar 15, 2024",
  },
  {
    id: "americas",
    name: "Americas League",
    icon: "🌎",
    season: "2024",
    language: "English/Spanish",
    totalPlayers: 1842,
    endDate: "Mar 20, 2024",
  },
];

// ── Players ───────────────────────────────────────────────────────────────────

const players: Player[] = [
  {
    id: "player-1",
    username: "Mario_Rossi",
    email: "mario@example.com",
    createdAt: "2024-01-01",
  },
  {
    id: "player-2",
    username: "WikiMaster",
    email: "wiki@example.com",
    createdAt: "2024-01-05",
  },
  {
    id: "player-3",
    username: "DataKing",
    email: "data@example.com",
    createdAt: "2024-01-10",
  },
  {
    id: "player-4",
    username: "AlexChen",
    email: "alex@example.com",
    createdAt: "2024-01-12",
  },
  {
    id: "player-5",
    username: "SarahKim",
    email: "sarah@example.com",
    createdAt: "2024-01-15",
  },
  {
    id: "player-6",
    username: "JamieLee",
    email: "jamie@example.com",
    createdAt: "2024-01-18",
  },
];

const currentPlayerId = "player-1";

// -----------------------------------------------------------------------------
// Helpers to convert internal mock data into DTOs expected by frontend DTO types
// -----------------------------------------------------------------------------

function findPlayer(id: string) {
  return players.find((p) => p.id === id);
}

function toPlayerDTO(p: Player): PlayerDTO {
  return {
    id: p.id,
    name: p.username,
  };
}

function toTeamDTO(t: Team): TeamDTO {
  const player = findPlayer(t.playerId)!;
  return {
    id: t.id,
    name: t.name,
    credits: t.credits,
    player: toPlayerDTO(player),
    points: t.points,
  };
}

function findArticle(articleId: string): ArticleDTO | undefined {
  return articles.find((a) => a.id === articleId);
}

function toContractDTO(c: Contract & { articleId: string }): ContractDTO {
  const team = teams.find((t) => t.id === c.teamId)!;
  const article = findArticle(c.articleId)!;
  const start = Temporal.Instant.from(new Date().toISOString());
  const duration = Temporal.Duration.from({ days: c.expiresIn ?? 0 });
  return {
    id: c.id,
    team: toTeamDTO(team),
    article,
    startDate: start,
    duration,
    purchasePrice: c.purchasePrice,
  };
}

function toNotificationDTO(n: Notification): NotificationDTO {
  const contract = contracts.find((c) => c.id === n.extra) as
    | (Contract & { articleId: string })
    | undefined;
  const contractDTO = contract ? toContractDTO(contract) : (null as any);
  const plainDate = n.createdAt
    ? Temporal.PlainDate.from(n.createdAt.split("T")[0])
    : Temporal.PlainDate.from(Temporal.Now.plainDateISO());
  return {
    id: n.id,
    contract: contractDTO,
    message: n.message,
    date: plainDate,
    isRead: !!n.read,
    read: !!n.read,
  };
}

function toLeagueDTO(l: any): LeagueDTO {
  const startDate = l.startDate
    ? Temporal.Instant.from(new Date(l.startDate).toISOString())
    : Temporal.Instant.from(new Date().toISOString());
  const endDate = l.endDate
    ? Temporal.Instant.from(new Date(l.endDate).toISOString())
    : Temporal.Instant.from(new Date().toISOString());
  const domainMap: Record<string, "it" | "en"> = {
    Italia: "it",
    Italian: "it",
    Italiano: "it",
    itwiki: "it",
    enwiki: "en",
    English: "en",
    Multiple: "en",
  };
  const domain = (domainMap[l.language] || domainMap[l.domain] || "en") as
    | "it"
    | "en";
  const dtoTeams = teams.filter((t) => t.leagueId === l.id).map(toTeamDTO);
  return {
    id: l.id,
    title: l.title ?? l.name,
    description: l.description ?? "",
    domain,
    icon: l.icon ?? "",
    startDate,
    endDate,
    teams: dtoTeams,
  };
}

// ── Teams ─────────────────────────────────────────────────────────────────────

const teams: Team[] = [
  {
    id: "team-1",
    name: "I Cesarini",
    playerId: "player-1",
    leagueId: "italy",
    credits: 550,
    totalValue: 1000,
    rank: 4,
    points: 7250,
    yesterdayPoints: 127,
    pointsChange: 12.5,
  },
  {
    id: "team-2",
    name: "Global Warriors",
    playerId: "player-1",
    leagueId: "global",
    credits: 800,
    totalValue: 1500,
    rank: 15,
    points: 12750,
    yesterdayPoints: 185,
    pointsChange: 8.3,
  },
  {
    id: "team-3",
    name: "Euro Champions",
    playerId: "player-1",
    leagueId: "europe",
    credits: 320,
    totalValue: 900,
    rank: 8,
    points: 8950,
    yesterdayPoints: 142,
    pointsChange: -2.1,
  },
  // Other players' teams (for leaderboard entries)
  {
    id: "team-4",
    name: "Wiki Masters",
    playerId: "player-2",
    leagueId: "italy",
    credits: 200,
    totalValue: 1200,
    rank: 1,
    points: 8950,
    yesterdayPoints: 165,
    pointsChange: 18.3,
  },
  {
    id: "team-5",
    name: "Data Lords",
    playerId: "player-3",
    leagueId: "italy",
    credits: 450,
    totalValue: 1100,
    rank: 2,
    points: 8420,
    yesterdayPoints: 158,
    pointsChange: 14.1,
  },
  {
    id: "team-6",
    name: "Wiki Warriors",
    playerId: "player-4",
    leagueId: "global",
    credits: 600,
    totalValue: 1300,
    rank: 3,
    points: 11200,
    yesterdayPoints: 172,
    pointsChange: 6.4,
  },
  {
    id: "team-7",
    name: "Data Dynamos",
    playerId: "player-5",
    leagueId: "europe",
    credits: 380,
    totalValue: 950,
    rank: 5,
    points: 7800,
    yesterdayPoints: 130,
    pointsChange: 4.2,
  },
  {
    id: "team-8",
    name: "Page Pioneers",
    playerId: "player-6",
    leagueId: "americas",
    credits: 290,
    totalValue: 870,
    rank: 2,
    points: 6500,
    yesterdayPoints: 115,
    pointsChange: 9.1,
  },
];

// ── Contracts ─────────────────────────────────────────────────────────────────
// Mutable at runtime — POST and DELETE handlers update this array.

const contracts: (Contract & { articleId: string })[] = [
  {
    id: "ctr-1",
    teamId: "team-1",
    leagueId: "italy",
    articleId: "art-1",
    purchasePrice: 150,
    currentPrice: 165,
    yesterdayPoints: 45,
    expiresIn: 2,
    tier: "MEDIUM",
    article: articles[0],
  },
  {
    id: "ctr-2",
    teamId: "team-1",
    leagueId: "italy",
    articleId: "art-2",
    purchasePrice: 120,
    currentPrice: 115,
    yesterdayPoints: 38,
    expiresIn: 5,
    tier: "MEDIUM",
    article: articles[1],
  },
  {
    id: "ctr-3",
    teamId: "team-1",
    leagueId: "italy",
    articleId: "art-3",
    purchasePrice: 200,
    currentPrice: 220,
    yesterdayPoints: 42,
    expiresIn: 1,
    tier: "LONG",
    article: articles[2],
  },
  {
    id: "ctr-4",
    teamId: "team-1",
    leagueId: "italy",
    articleId: "art-4",
    purchasePrice: 80,
    currentPrice: 85,
    yesterdayPoints: 2,
    expiresIn: 7,
    tier: "SHORT",
    article: articles[3],
  },
  {
    id: "ctr-5",
    teamId: "team-2",
    leagueId: "global",
    articleId: "art-5",
    purchasePrice: 180,
    currentPrice: 195,
    yesterdayPoints: 52,
    expiresIn: 10,
    tier: "LONG",
    article: articles[4],
  },
  {
    id: "ctr-6",
    teamId: "team-2",
    leagueId: "global",
    articleId: "art-6",
    purchasePrice: 140,
    currentPrice: 155,
    yesterdayPoints: 48,
    expiresIn: 4,
    tier: "MEDIUM",
    article: articles[5],
  },
];

// ── Notifications ─────────────────────────────────────────────────────────────

const notifications: Notification[] = [
  // ── italy (team-1) — 3 unread, 1 read ─────────────────────────────────────
  // 1 trade offer per incoming proposal (1-to-1 relationship)
  {
    id: "notif-1",
    leagueId: "italy",
    teamId: "team-1",
    message: "Contratto in scadenza: Bitcoin",
    type: "contract_expiring",
    extra: "ctr-1",
    read: false,
    createdAt: "2024-02-09T10:00:00Z",
  },
  {
    id: "notif-2",
    leagueId: "italy",
    teamId: "team-1",
    message: "Nuovo trade da WikiMaster",
    type: "trade_offer",
    extra: "trd-1",
    read: false,
    createdAt: "2024-02-09T08:30:00Z",
  },
  {
    id: "notif-8",
    leagueId: "italy",
    teamId: "team-1",
    message: "Nuovo trade da DataKing",
    type: "trade_offer",
    extra: "trd-2",
    read: false,
    createdAt: "2024-02-09T07:45:00Z",
  },
  {
    id: "notif-3",
    leagueId: "italy",
    teamId: "team-1",
    message: "Benvenuto nella lega Italia!",
    type: "general",
    extra: "",
    read: true,
    createdAt: "2024-02-01T09:00:00Z",
  },
  // ── global (team-2) — 1 unread, 1 read ────────────────────────────────────
  {
    id: "notif-4",
    leagueId: "global",
    teamId: "team-2",
    message: "New trade offer from AlexChen",
    type: "trade_offer",
    extra: "trd-4",
    read: false,
    createdAt: "2024-02-08T14:00:00Z",
  },
  {
    id: "notif-5",
    leagueId: "global",
    teamId: "team-2",
    message: "Leaderboard updated",
    type: "league_update",
    extra: "",
    read: true,
    createdAt: "2024-02-08T15:00:00Z",
  },
  // ── europe (team-3) — 2 unread ────────────────────────────────────────────
  {
    id: "notif-6",
    leagueId: "europe",
    teamId: "team-3",
    message: "Contract expiring soon: Cloud Computing",
    type: "contract_expiring",
    extra: "ctr-6",
    read: false,
    createdAt: "2024-02-09T07:00:00Z",
  },
  {
    id: "notif-7",
    leagueId: "europe",
    teamId: "team-3",
    message: "New trade offer from SarahKim",
    type: "trade_offer",
    extra: "trd-5",
    read: false,
    createdAt: "2024-02-09T06:00:00Z",
  },
];

// ── Trade Proposals ───────────────────────────────────────────────────────────
// Each proposal belongs to a specific league. The current player (player-1)
// is involved either as sender (outgoing) or receiver (incoming).
// Mutable at runtime — PATCH handlers update status in place.

const tradeProposals: TradeProposal[] = [
  // ── italy ──
  {
    id: "trd-1",
    leagueId: "italy",
    type: "incoming",
    status: "pending",
    fromTeamId: "team-4",
    fromUsername: "WikiMaster",
    toTeamId: "team-1",
    toUsername: "Mario_Rossi",
    offeredArticle: { id: "art-11", name: "Albert Einstein", basePrice: 850 },
    requestedArticle: { id: "art-7", name: "Python", basePrice: 950 },
    contractTier: "2 Weeks",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "trd-2",
    leagueId: "italy",
    type: "incoming",
    status: "pending",
    fromTeamId: "team-5",
    fromUsername: "DataKing",
    toTeamId: "team-1",
    toUsername: "Mario_Rossi",
    offeredCredits: 1200,
    requestedArticle: { id: "art-8", name: "JavaScript", basePrice: 1100 },
    contractTier: "1 Month",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "trd-3",
    leagueId: "italy",
    type: "outgoing",
    status: "pending",
    fromTeamId: "team-1",
    fromUsername: "Mario_Rossi",
    toTeamId: "team-6",
    toUsername: "AlexChen",
    offeredCredits: 800,
    requestedArticle: { id: "art-9", name: "React", basePrice: 900 },
    contractTier: "1 Week",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  // ── global ──
  {
    id: "trd-4",
    leagueId: "global",
    type: "incoming",
    status: "pending",
    fromTeamId: "team-6",
    fromUsername: "AlexChen",
    toTeamId: "team-2",
    toUsername: "Mario_Rossi",
    offeredArticle: { id: "art-4", name: "Machine Learning", basePrice: 1050 },
    requestedArticle: {
      id: "art-12",
      name: "Artificial Intelligence",
      basePrice: 1200,
    },
    contractTier: "2 Weeks",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  // ── europe ──
  {
    id: "trd-5",
    leagueId: "europe",
    type: "incoming",
    status: "pending",
    fromTeamId: "team-7",
    fromUsername: "SarahKim",
    toTeamId: "team-3",
    toUsername: "Mario_Rossi",
    offeredCredits: 950,
    requestedArticle: { id: "art-5", name: "Cloud Computing", basePrice: 880 },
    contractTier: "1 Week",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
];

// =============================================================================
// HELPER
// =============================================================================

/** Find the current player's team for a given league, or 404. */
function getMyTeam(leagueId: string): Team | undefined {
  return teams.find(
    (t) => t.playerId === currentPlayerId && t.leagueId === leagueId
  );
}

// =============================================================================
// HANDLERS
// =============================================================================

export const handlers = [
  // ── Player ──────────────────────────────────────────────────────────────────

  http.get("*/api/player", () => {
    const player = players.find((p) => p.id === currentPlayerId);
    if (!player)
      return HttpResponse.json({ error: "Player not found" }, { status: 404 });
    return HttpResponse.json(player);
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
    return HttpResponse.json(contracts.filter((c) => c.teamId === team.id));
  }),

  http.get("*/api/leagues/:leagueId/leaderboard", ({ params }) => {
    return HttpResponse.json(leaderboards[params.leagueId as string] ?? []);
  }),

  http.get("*/api/leagues/:leagueId/notifications", ({ params }) => {
    return HttpResponse.json(
      notifications.filter((n) => n.leagueId === params.leagueId)
    );
  }),

  // ── Trade Proposals ─────────────────────────────────────────────────────────

  /**
   * GET /api/leagues/:leagueId/trades
   * Returns all trade proposals (incoming + outgoing) for the current player
   * in the given league. The client filters to incoming/pending for the inbox.
   */
  http.get("*/api/leagues/:leagueId/trades", ({ params }) => {
    const leagueId = params.leagueId as string;
    const team = getMyTeam(leagueId);
    if (!team) return HttpResponse.json([]);

    const leagueTrades = tradeProposals.filter(
      (p) =>
        p.leagueId === leagueId &&
        (p.fromTeamId === team.id || p.toTeamId === team.id)
    );

    return HttpResponse.json(leagueTrades);
  }),

  /**
   * PATCH /api/trades/:tradeId/accept
   * Marks the proposal as accepted and returns the updated proposal.
   */
  http.patch("*/api/trades/:tradeId/accept", ({ params }) => {
    const proposal = tradeProposals.find((p) => p.id === params.tradeId);
    if (!proposal)
      return HttpResponse.json({ error: "Trade not found" }, { status: 404 });
    if (proposal.status !== "pending")
      return HttpResponse.json(
        { error: "Trade is no longer pending" },
        { status: 409 }
      );

    proposal.status = "accepted";
    return HttpResponse.json(proposal);
  }),

  /**
   * PATCH /api/trades/:tradeId/reject
   * Marks the proposal as rejected and returns the updated proposal.
   */
  http.patch("*/api/trades/:tradeId/reject", ({ params }) => {
    const proposal = tradeProposals.find((p) => p.id === params.tradeId);
    if (!proposal)
      return HttpResponse.json({ error: "Trade not found" }, { status: 404 });
    if (proposal.status !== "pending")
      return HttpResponse.json(
        { error: "Trade is no longer pending" },
        { status: 409 }
      );

    proposal.status = "rejected";
    return HttpResponse.json(proposal);
  }),

  // ── Teams ────────────────────────────────────────────────────────────────────

  http.get("*/api/teams", () => {
    return HttpResponse.json(
      teams.filter((t) => t.playerId === currentPlayerId)
    );
  }),

  http.get("*/api/teams/:teamId", ({ params }) => {
    const team = teams.find((t) => t.id === params.teamId);
    if (!team)
      return HttpResponse.json({ error: "Team not found" }, { status: 404 });
    if (team.playerId !== currentPlayerId)
      return HttpResponse.json({ error: "Access denied" }, { status: 403 });
    return HttpResponse.json(team);
  }),

  http.get("*/api/teams/:teamId/contracts", ({ params }) => {
    return HttpResponse.json(
      contracts.filter((c) => c.teamId === params.teamId)
    );
  }),

  http.post("*/api/teams/:teamId/contracts", async ({ params, request }) => {
    const { articleId, tier, purchasePrice } = (await request.json()) as {
      articleId: string;
      tier: "SHORT" | "MEDIUM" | "LONG";
      purchasePrice: number;
    };
    const team = teams.find(
      (t) => t.id === params.teamId && t.playerId === currentPlayerId
    );
    if (!team)
      return HttpResponse.json({ error: "Team not found" }, { status: 404 });
    if (team.credits < purchasePrice)
      return HttpResponse.json(
        { error: "Insufficient credits" },
        { status: 400 }
      );

    const article = articles.find((a) => a.id === articleId);
    if (!article)
      return HttpResponse.json({ error: "Article not found" }, { status: 404 });

    const newContract = {
      id: `ctr-${Date.now()}`,
      teamId: params.teamId as string,
      leagueId: team.leagueId,
      articleId,
      purchasePrice,
      currentPrice: purchasePrice,
      yesterdayPoints: 0,
      expiresIn: tier === "SHORT" ? 7 : tier === "MEDIUM" ? 14 : 30,
      tier,
      article,
    };
    contracts.push(newContract);
    team.credits -= purchasePrice;
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
      (t) => t.id === contract.teamId && t.playerId === currentPlayerId
    );
    if (!team)
      return HttpResponse.json({ error: "Access denied" }, { status: 403 });

    team.credits += contract.currentPrice;
    contracts.splice(idx, 1);
    return HttpResponse.json({
      message: "Contract deleted successfully",
      refundedCredits: contract.currentPrice,
    });
  }),

  // ── Notifications ─────────────────────────────────────────────────────────────

  http.get("*/api/notifications", () => {
    const playerTeamIds = teams
      .filter((t) => t.playerId === currentPlayerId)
      .map((t) => t.id);
    return HttpResponse.json(
      notifications.filter((n) => playerTeamIds.includes(n.teamId))
    );
  }),

  http.patch("*/api/notifications/:notificationId/read", ({ params }) => {
    const notif = notifications.find((n) => n.id === params.notificationId);
    if (!notif)
      return HttpResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    notif.read = true;
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

  // ── Dashboard ─────────────────────────────────────────────────────────────────

  http.get("*/api/dashboard/:leagueId", ({ params }) => {
    const leagueId = params.leagueId as string;
    const team = getMyTeam(leagueId);
    if (!team)
      return HttpResponse.json(
        { error: "No team found for this league" },
        { status: 404 }
      );

    const league = leagues.find((l) => l.id === leagueId);
    const teamContracts = contracts.filter((c) => c.teamId === team.id);
    const portfolioValue = teamContracts.reduce(
      (sum, c) => sum + c.currentPrice,
      0
    );

    return HttpResponse.json<DashboardData>({
      team,
      league: league!,
      contracts: teamContracts,
      leaderboard: leaderboards[leagueId] ?? [],
      notifications: notifications.filter((n) => n.teamId === team.id),
      summary: {
        yesterdayPoints: team.yesterdayPoints,
        pointsChange: team.pointsChange,
        rank: team.rank,
        totalPlayers: league?.totalPlayers ?? 0,
        credits: team.credits,
        portfolioValue,
        activeContracts: teamContracts.length,
        maxContracts: 10,
      },
    });
  }),

  // ── Session ─────────────────────────────────────────────────────────────────

  http.get("*/api/session", () => {
    return HttpResponse.json({
      sub: "mock-user-id",
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/avatar.png",
    });
  }),

  http.delete("*/api/session", () => {
    return HttpResponse.json({ success: true });
  }),
];
