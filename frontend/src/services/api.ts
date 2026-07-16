// frontend/src/services/api.ts
import { DashboardData, Session, TeamPointsData } from "@/types/models";
import { PlayerDTO } from "../../../dto/playerDTO";
import { LeagueDTO } from "../../../dto/leagueDTO";
import {
  RawNotification,
  deserializeNotification,
} from "../../../dto/notificationDTO";
import { TeamDTO } from "../../../dto/teamDTO";
import { ContractDTO, type RawContract } from "../../../dto/contractDTO";
import { ArticleDTO } from "../../../dto/articleDTO";
import { PerformanceDTO } from "../../../dto/performanceDTO";
import { LeaderboardEntryDTO } from "../../../dto/leaderboardDTO";
import { Temporal } from "@js-temporal/polyfill";
import {
  TIER_DAYS,
  computeCurrentPrice,
  type ContractTier,
} from "../../../model/pricing";
import { createWikimediaClient } from "@/services/wikimediaClient";

const API_BASE_URL = "/api";

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Network error" }));
    throw new Error(
      error.error || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}

export function deserializeLeague(l: LeagueDTO): LeagueDTO {
  return {
    ...l,
    startDate: Temporal.Instant.from(l.startDate as unknown as string),
    endDate: Temporal.Instant.from(l.endDate as unknown as string),
  };
}

// ── Player ────────────────────────────────────────────────────────────────────

export const playerApi = {
  getCurrent: () => apiRequest<PlayerDTO>("/player"),
  getTeams: () => apiRequest<TeamDTO[]>("/player/teams"),
  getNotifications: () =>
    apiRequest<RawNotification[]>("/player/notifications").then((ns) =>
      ns.map(deserializeNotification)
    ),
};

// ── Leagues ───────────────────────────────────────────────────────────────────

export const leaguesApi = {
  /** The current player's leagues available for selection (resolved from JWT on backend) */
  getAll: () =>
    apiRequest<LeagueDTO[]>("/leagues").then((ls) => ls.map(deserializeLeague)),
  getById: (id: string) =>
    apiRequest<LeagueDTO>(`/leagues/${id}`).then(deserializeLeague),
  /** The Global League, joinable by any player regardless of locale */
  getGlobal: () =>
    apiRequest<LeagueDTO>("/leagues/global").then(deserializeLeague),
  /** The current player's team inside this league (resolved from JWT on backend) */
  getMyTeam: (id: string) => apiRequest<TeamDTO>(`/leagues/${id}/my-team`),
  /** Create the current player's team inside this league (resolved from JWT on backend) */
  createMyTeam: (id: string, name: string) =>
    apiRequest<TeamDTO>(`/leagues/${id}/my-team`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  /** All contracts of the current player's team in this league */
  getMyContracts: (id: string) =>
    apiRequest<RawContract[]>(`/leagues/${id}/my-contracts`).then((cs) =>
      cs.map((c) => ContractDTO.fromRaw(c))
    ),
  /** All contracts held by any team in this league (used by the Market view) */
  getContracts: (id: string) =>
    apiRequest<RawContract[]>(`/leagues/${id}/contracts`).then((cs) =>
      cs.map((c) => ContractDTO.fromRaw(c))
    ),
  /** All notifications for the current player in this league */
  getMyNotifications: (id: string) =>
    apiRequest<RawNotification[]>(`/leagues/${id}/my-notifications`).then(
      (ns) => ns.map(deserializeNotification)
    ),

  // ── Leaderboard ────────────────────────────────────────────────────────────

  getLeaderboard: (id: string) =>
    apiRequest<LeaderboardEntryDTO[]>(`/leagues/${id}/leaderboard`),

  // ── Performance ────────────────────────────────────────────────────────────

  async getRecentPoints(id: string): Promise<TeamPointsData> {
    const [latest, previous] = await apiRequest<PerformanceDTO[]>(
      `/leagues/${id}/my-performances?limit=2`
    );
    const latestPts = latest?.points ?? 0;
    const previousPts = previous?.points ?? 0;
    return {
      // Round to one decimal for display; the raw value carries full float
      // precision from the scoring engine.
      yesterdayPoints: Math.round(latestPts * 10) / 10,
      pointsChange:
        previousPts > 0
          ? Math.round(((latestPts - previousPts) / previousPts) * 100)
          : 0,
    };
  },

  /** Buy a contract for the current player's team in this league */
  buyMyContract: (leagueId: string, articleId: string, tier: ContractTier) =>
    apiRequest<RawContract>(`/leagues/${leagueId}/my-contracts`, {
      method: "POST",
      body: JSON.stringify({ articleId, tier }),
    }).then((c) => ContractDTO.fromRaw(c)),

  /** Sell one of the current player's contracts early for a prorated payout */
  sellMyContract: (leagueId: string, contractId: string) =>
    apiRequest<RawContract>(
      `/leagues/${leagueId}/my-contracts/${contractId}/sell`,
      { method: "POST" }
    ).then((c) => ContractDTO.fromRaw(c)),
};

// ── Teams ─────────────────────────────────────────────────────────────────────

export const teamsApi = {
  getById: (id: string) => apiRequest<TeamDTO>(`/teams/${id}`),
  getContracts: (id: string) =>
    apiRequest<RawContract[]>(`/teams/${id}/contracts`).then((cs) =>
      cs.map((c) => ContractDTO.fromRaw(c))
    ),
};

// ── Contracts ─────────────────────────────────────────────────────────────────

export const contractsApi = {
  getById: (id: string) =>
    apiRequest<RawContract>(`/contracts/${id}`).then((c) =>
      ContractDTO.fromRaw(c)
    ),
  delete: (id: string) =>
    apiRequest<{ message: string; refundedCredits: number }>(
      `/contracts/${id}`,
      { method: "DELETE" }
    ),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationsApi = {
  getAll: () =>
    apiRequest<RawNotification[]>("/notifications").then((ns) =>
      ns.map(deserializeNotification)
    ),
  markAsRead: (id: string) =>
    apiRequest<{ success: boolean }>(`/notifications/${id}/read`, {
      method: "PATCH",
    }),
};

// ── Articles ──────────────────────────────────────────────────────────────────

export const articlesApi = {
  getAll: () => apiRequest<ArticleDTO[]>("/articles"),
  getById: (id: string) => apiRequest<ArticleDTO>(`/articles/${id}`),
};

const wikimediaClient = createWikimediaClient();

/**
 * ContractPrice (ADR 0005) at the contract's own held tier — neither
 * ContractDTO nor ArticleDTO carry pageview data, so it's fetched live per
 * article (same source as ArticleDetail's stats block). If Wikimedia has no
 * usable view history (a failed/empty fetch — `getArticleViews` swallows
 * errors into `undefined` fields rather than throwing), fall back to
 * purchasePrice: a stale-but-plausible figure beats silently pricing the
 * contract at 0, which would understate the portfolio total for reasons
 * invisible to the viewer.
 */
export async function getContractCurrentPrice(
  contract: ContractDTO
): Promise<number> {
  const views = await wikimediaClient.pageviews.getArticleViews(
    contract.article.domain,
    contract.article.title
  );
  if (views.averageViews30d === undefined) {
    return contract.purchasePrice;
  }
  return computeCurrentPrice(
    views.averageViews30d,
    contract.article.domain,
    TIER_DAYS[contract.tier as ContractTier]
  );
}

export const dashboardApi = {
  async getDashboardData(league: LeagueDTO): Promise<DashboardData> {
    const [team, contracts, notifications, recentPoints, leaderboard] =
      await Promise.all([
        leaguesApi.getMyTeam(league.id),
        leaguesApi.getMyContracts(league.id),
        leaguesApi.getMyNotifications(league.id),
        leaguesApi.getRecentPoints(league.id),
        leaguesApi.getLeaderboard(league.id),
      ]);

    const rank = leaderboard.find((e) => e.team.id === team.id)?.rank ?? 0;
    const totalPlayers = leaderboard.length;
    const currentPrices = await Promise.all(
      contracts.map(getContractCurrentPrice)
    );
    const portfolioValue = currentPrices.reduce((sum, p) => sum + p, 0);

    return new DashboardData(
      team,
      league,
      contracts,
      notifications,
      recentPoints,
      rank,
      totalPlayers,
      portfolioValue
    );
  },
};

// ── Session ───────────────────────────────────────────────────────────────────

export const sessionApi = {
  get: () => apiRequest<Session>("/session"),
  delete: () =>
    apiRequest<{ success: boolean }>("/session", { method: "DELETE" }),
};

// ── Unified export ────────────────────────────────────────────────────────────

export const api = {
  player: playerApi,
  leagues: leaguesApi,
  teams: teamsApi,
  contracts: contractsApi,
  notifications: notificationsApi,
  articles: articlesApi,
  dashboard: dashboardApi,
  session: sessionApi,
};

export default api;
