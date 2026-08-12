import { http, HttpResponse, passthrough } from "msw";
import { Temporal } from "@js-temporal/polyfill";
import {
  contracts,
  currentPlayerId,
  allLeagues,
  leagues,
  articles,
  notifications,
  performancesByLeague,
  players,
  rosterOf,
  teams,
} from "./data";
import { ContractDTO } from "../../../dto/contractDTO";
import type { CreateLeagueRequest, LeagueDTO } from "../../../dto/leagueDTO";
import { LeagueVisibility } from "../../../model/enums";
import { isLeagueName, leagueEndDate } from "../../../model/league";
import { isTeamName } from "../../../model/team";
import type { TeamDTO } from "../../../dto/teamDTO";
import type { LeaderboardEntryDTO } from "../../../dto/leaderboardDTO";
import type { TeamLineUp } from "@/types/team";
import { mockTeamResponse } from "@/mocks/formationMocks";
import Instant = Temporal.Instant;

// =============================================================================
// HELPER
// =============================================================================

function getMyTeam(leagueId: string): TeamDTO | undefined {
  return rosterOf(leagueId).find((t) => t.player.id === currentPlayerId);
}

function teamResponseKey(leagueId: string): string {
  return `${leagueId}`;
}

/**
 * Invitation codes by league id — the mock's stand-in for the column, kept out
 * of the league fixtures for the same reason the real one is kept off
 * `LeagueDTO`: only the endpoint that checks the caller may have it can serve
 * it. The Italia League is the private fixture, so it is the one with a code.
 */
const invitationCodes: Record<string, string> = {
  italy: "M4RSX",
};

/** Stands in for an anchor article's outbound link list. */
const mockOutboundLinks = [
  "Bitcoin",
  "Blockchain",
  "Cryptocurrency",
  "Artificial intelligence arms race",
];

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

  // Founding a league writes it into the mock's own list, so the league
  // section and the selector show it immediately afterwards — the same thing
  // the real `fetchLeagues` sees once the transaction commits.
  http.post("*/api/leagues", async ({ request }) => {
    const body = (await request.json()) as Partial<CreateLeagueRequest>;
    if (!isLeagueName(body.name) || !isTeamName(body.teamName)) {
      return HttpResponse.json(
        { error: "Invalid league payload" },
        { status: 400 }
      );
    }

    const startDate = Temporal.Now.instant();
    const league: LeagueDTO = {
      id: `league-${leagues.length + 1}`,
      title: body.name!.trim(),
      icon: body.icon ?? "🏆",
      domain: body.domain ?? "en",
      startDate,
      endDate: leagueEndDate(startDate, body.duration ?? "1m"),
      visibility: body.visibility ?? LeagueVisibility.PRIVATE,
      teamCount: 1,
      closedAt: null,
    };
    leagues.push(league);
    if (body.visibility === LeagueVisibility.PRIVATE) {
      invitationCodes[league.id] = "ZK7QW";
    }
    return HttpResponse.json(league, { status: 201 });
  }),

  // Mirrors the real endpoint's two 404s: a league nobody may invite to, and a
  // public league that simply has no code.
  http.get("*/api/leagues/:leagueId/invite-code", ({ params }) => {
    const code = invitationCodes[String(params.leagueId)];
    if (!code)
      return HttpResponse.json(
        { error: "This league has no invitation code" },
        { status: 404 }
      );
    return HttpResponse.json({ code });
  }),

  // Mirrors the real endpoint: every public league, the caller's own included.
  // Filtering those out is the league section's job, so returning them here is
  // what actually exercises it.
  http.get("*/api/leagues/public", () =>
    HttpResponse.json(
      allLeagues().filter((l) => l.visibility === LeagueVisibility.PUBLIC)
    )
  ),

  http.get("*/api/leagues/global", () => {
    const league = leagues.find((l) => l.id === "global");
    if (!league)
      return HttpResponse.json({ error: "League not found" }, { status: 404 });
    return HttpResponse.json(league);
  }),

  http.get("*/api/leagues/:leagueId", ({ params }) => {
    const league = allLeagues().find((l) => l.id === params.leagueId);
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

  http.get("*/api/leagues/:leagueId/my-contracts", ({ params }) => {
    const team = getMyTeam(params.leagueId as string);
    if (!team) return HttpResponse.json([]);
    return HttpResponse.json(contracts.filter((c) => c.team.id === team.id));
  }),

  http.post(
    "*/api/leagues/:leagueId/my-contracts",
    async ({ params, request }) => {
      const data = (await request.json()) as {
        articleId: string;
        tier: string;
      };
      const team = getMyTeam(params.leagueId as string);
      if (!team)
        return HttpResponse.json({ error: "Team not found" }, { status: 404 });

      const article = articles.find((a) => a.id === data.articleId);
      if (!article)
        return HttpResponse.json(
          { error: "Article not found" },
          { status: 404 }
        );

      const newContract = new ContractDTO(
        `ctr-${Date.now()}`,
        team,
        article,
        Instant.from(Temporal.Now.instant().toString()),
        Temporal.Duration.from({ days: 14 }),
        150
      );
      contracts.push(newContract);
      return HttpResponse.json(newContract, { status: 201 });
    }
  ),

  http.post(
    "*/api/leagues/:leagueId/my-contracts/:contractId/renew",
    ({ params }) => {
      const team = getMyTeam(params.leagueId as string);
      if (!team)
        return HttpResponse.json(
          { error: "No team found for this league" },
          { status: 404 }
        );
      const contract = contracts.find((c) => c.id === params.contractId);
      if (!contract)
        return HttpResponse.json(
          { error: "Contract not found" },
          { status: 404 }
        );
      if (contract.team.id !== team.id)
        return HttpResponse.json(
          { error: "You do not own this contract" },
          { status: 400 }
        );
      // Election only sets the flag; the sweep rolls the window at expiry.
      contract.renewalElected = true;
      return HttpResponse.json(contract);
    }
  ),

  http.delete(
    "*/api/leagues/:leagueId/my-contracts/:contractId/renew",
    ({ params }) => {
      const team = getMyTeam(params.leagueId as string);
      if (!team)
        return HttpResponse.json(
          { error: "No team found for this league" },
          { status: 404 }
        );
      const contract = contracts.find((c) => c.id === params.contractId);
      if (!contract)
        return HttpResponse.json(
          { error: "Contract not found" },
          { status: 404 }
        );
      if (contract.team.id !== team.id)
        return HttpResponse.json(
          { error: "You do not own this contract" },
          { status: 400 }
        );
      if (!contract.renewalElected)
        return HttpResponse.json(
          { error: "No renewal is elected for this contract" },
          { status: 400 }
        );
      // Withdrawing the intent: the contract goes back to settling at expiry.
      contract.renewalElected = false;
      return HttpResponse.json(contract);
    }
  ),

  http.get("*/api/leagues/:leagueId/contracts", ({ params }) => {
    const league = allLeagues().find((l) => l.id === params.leagueId);
    if (!league) return HttpResponse.json([]);
    const teamIds = rosterOf(league.id).map((t) => t.id);
    return HttpResponse.json(
      contracts.filter((c) => teamIds.includes(c.team.id))
    );
  }),

  http.get("*/api/leagues/:leagueId/my-notifications", ({ params }) => {
    const league = allLeagues().find((l) => l.id === params.leagueId);
    if (!league) return HttpResponse.json([]);
    const teamIdsInLeague = rosterOf(league.id).map((t) => t.id);
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

  // ── Leaderboard ────────────────────────────────────────────────────────────────
  http.get("*/api/leagues/:leagueId/leaderboard", ({ params }) => {
    const leagueId = params.leagueId as string;
    const league = allLeagues().find((l) => l.id === leagueId);
    if (!league) return HttpResponse.json([]);

    const perfs = performancesByLeague[leagueId] ?? [];

    // Cumulative points per team = SUM of that team's performance entries.
    const cumulativeByTeam = new Map<string, number>();
    // Today's daily contribution per team (latest snapshot) — used to derive
    // each team's standing "yesterday" for the rankDelta indicator.
    const todayByTeam = new Map<string, number>();
    for (const p of perfs) {
      cumulativeByTeam.set(
        p.teamId,
        (cumulativeByTeam.get(p.teamId) ?? 0) + p.points
      );
      if (!todayByTeam.has(p.teamId)) todayByTeam.set(p.teamId, p.points);
    }

    // Current standings: teams sorted by cumulative points desc.
    const ranked = [...rosterOf(league.id)]
      .map((team) => ({
        team,
        cumulativePoints: cumulativeByTeam.get(team.id) ?? 0,
      }))
      .sort((a, b) => b.cumulativePoints - a.cumulativePoints);

    // Yesterday's standings: cumulative minus today's daily contribution.
    const yesterdayRank = new Map(
      [...ranked]
        .map((e) => ({
          id: e.team.id,
          points: e.cumulativePoints - (todayByTeam.get(e.team.id) ?? 0),
        }))
        .sort((a, b) => b.points - a.points)
        .map((e, idx) => [e.id, idx + 1] as const)
    );

    const entries: LeaderboardEntryDTO[] = ranked.map((e, idx) => {
      const rank = idx + 1;
      const rankDelta = todayByTeam.has(e.team.id)
        ? yesterdayRank.get(e.team.id)! - rank
        : null;
      return {
        team: e.team,
        cumulativePoints: e.cumulativePoints,
        rank,
        rankDelta,
      };
    });

    return HttpResponse.json(entries);
  }),

  http.get("*/api/leagues/:leagueId/my-performances", ({ params }) => {
    const leagueId = params.leagueId as string;
    const myTeam = getMyTeam(leagueId);
    if (!myTeam) return HttpResponse.json([]);
    const all = performancesByLeague[leagueId] ?? [];
    return HttpResponse.json(all.filter((p) => p.teamId === myTeam.id));
  }),

  // MediaWiki Action API — the outbound links of an article, which the Article
  // Genie intersects across the anchors a query names.
  http.get("https://*.wikipedia.org/w/api.php", ({ request }) => {
    const title = new URL(request.url).searchParams.get("titles") ?? "";
    return HttpResponse.json({
      query: {
        pages: [
          {
            pageid: 1,
            ns: 0,
            title,
            links: mockOutboundLinks.map((t) => ({ ns: 0, title: t })),
          },
        ],
      },
    });
  }),

  // The Article Genie's two model calls. No model runs in mock mode: the seed
  // reads as a chemistry query and the turn narrows to a single survivor, which
  // is enough to drive the panel through to its results.
  http.post("*/api/me/genie-seeds", async ({ request }) => {
    const { query } = (await request.json()) as { query: string };
    return HttpResponse.json({ keywords: query, anchors: [] });
  }),

  http.post("*/api/me/genie-turns", async ({ request }) => {
    const { candidates, history } = (await request.json()) as {
      candidates: { id: number }[];
      history: unknown[];
    };
    // The opening turn keeps everything, exactly as the real service enforces:
    // nothing has been answered, so there is nothing to narrow on. Narrowing
    // here would drop the mock straight past the result threshold and show the
    // player their findings without a single question being asked.
    const keep = history.length === 0 ? candidates : candidates.slice(0, 3);
    return HttpResponse.json({
      utterance: "Mhh, curious — is it a person?",
      question: "Is it a person?",
      keep: keep.map((c) => c.id),
      options: ["Yes", "No"],
      kind: "filter",
      done: keep.length <= 3,
    });
  }),

  // Problem reports. Nothing is really filed on GitHub in mock mode — the mock
  // just hands back a plausible issue so the success card can be exercised.
  http.post("*/api/reports", () =>
    HttpResponse.json(
      {
        issueNumber: 1234,
        issueUrl: "https://github.com/FantasyWiki/FantasyWiki/issues/1234",
      },
      { status: 201 }
    )
  ),
];
