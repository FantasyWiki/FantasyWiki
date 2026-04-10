// frontend/src/services/api.ts
import { DashboardData, TeamPointsData } from "@/types/models";
import { PlayerDTO } from "../../../dto/playerDTO";
import { LeagueDTO } from "../../../dto/leagueDTO";
import { NotificationDTO } from "../../../dto/notificationDTO";
import { TeamDTO } from "../../../dto/teamDTO";
import { ContractDTO } from "../../../dto/contractDTO";
import { ArticleDTO } from "../../../dto/articleDTO";
import { PerformanceDTO } from "../../../dto/performanceDTO";
import { Temporal } from "@js-temporal/polyfill";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

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

// ── Player ────────────────────────────────────────────────────────────────────

export const playerApi = {
  getCurrent: () => apiRequest<PlayerDTO>("/player"),
  getTeams: () => apiRequest<TeamDTO[]>("/player/teams"),
  getNotifications: () =>
    apiRequest<NotificationDTO[]>("/player/notifications"),
};

// ── Leagues ───────────────────────────────────────────────────────────────────

export const leaguesApi = {
  /** The current player's leagues available for selection (resolved from JWT on backend) */
  getAll: () => apiRequest<LeagueDTO[]>("/leagues"),
  getById: (id: string) => apiRequest<LeagueDTO>(`/leagues/${id}`),
  /** The current player's team inside this league (resolved from JWT on backend) */
  getMyTeam: (id: string) => apiRequest<TeamDTO>(`/leagues/${id}/team`),
  /** All contracts of the current player's team in this league */
  getMyContracts: (id: string) =>
    apiRequest<ContractDTO[]>(`/leagues/${id}/contracts`),
  /** All notifications for the current player in this league */
  getMyNotifications: (id: string) =>
    apiRequest<NotificationDTO[]>(`/leagues/${id}/notifications`),

  // ── Performance ────────────────────────────────────────────────────────────

  getPerformances: (id: string, limit = 2) =>
    apiRequest<PerformanceDTO[]>(`/leagues/${id}/performances?limit=${limit}`),

  async getRecentPoints(id: string): Promise<TeamPointsData> {
    const [yesterday, twoDaysAgo] = await apiRequest<PerformanceDTO[]>(
      `/leagues/${id}/performances?limit=2`
    );
    return {
      yesterdayPoints: yesterday?.points ?? 0,
      pointsChange: (yesterday?.points ?? 0) - (twoDaysAgo?.points ?? 0),
    };
  },
};

// ── Teams ─────────────────────────────────────────────────────────────────────

export const teamsApi = {
  getById: (id: string) => apiRequest<TeamDTO>(`/teams/${id}`),
  getContracts: (id: string) =>
    apiRequest<ContractDTO[]>(`/teams/${id}/contracts`),
  getNotifications: (id: string) =>
    apiRequest<NotificationDTO[]>(`/teams/${id}/notifications`),
  createContract: (
    teamId: string,
    data: {
      teamID: string;
      articleID: string;
      startDate: Temporal.Instant;
      duration: Temporal.Duration;
      purchasePrice: number;
    }
  ) =>
    apiRequest<ContractDTO>(`/teams/${teamId}/contracts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Contracts ─────────────────────────────────────────────────────────────────

export const contractsApi = {
  getById: (id: string) => apiRequest<ContractDTO>(`/contracts/${id}`),
  delete: (id: string) =>
    apiRequest<{ message: string; refundedCredits: number }>(
      `/contracts/${id}`,
      { method: "DELETE" }
    ),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationsApi = {
  getAll: () => apiRequest<NotificationDTO[]>("/notifications"),
  markAsRead: (id: string) =>
    apiRequest<NotificationDTO>(`/notifications/${id}/read`, {
      method: "PATCH",
    }),
};

// ── Articles ──────────────────────────────────────────────────────────────────

export const articlesApi = {
  getAll: () => apiRequest<ArticleDTO[]>("/articles"),
  getById: (id: string) => apiRequest<ArticleDTO>(`/articles/${id}`),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  async getDashboardData(league: LeagueDTO): Promise<DashboardData> {
    const [team, contracts, notifications, recentPoints] = await Promise.all([
      leaguesApi.getMyTeam(league.id),
      leaguesApi.getMyContracts(league.id),
      leaguesApi.getMyNotifications(league.id),
      leaguesApi.getRecentPoints(league.id),
    ]);

    // Shape the resolved values into DashboardData
    return new DashboardData(
      team,
      league,
      contracts,
      notifications,
      recentPoints
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
