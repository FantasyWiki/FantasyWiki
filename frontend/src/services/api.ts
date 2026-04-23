import { DashboardData, Session, TeamPointsData } from "@/types/models";
import { PlayerDTO } from "../../../dto/playerDTO";
import { LeagueDTO } from "../../../dto/leagueDTO";
import { NotificationDTO } from "../../../dto/notificationDTO";
import { TeamDTO } from "../../../dto/teamDTO";
import { ContractDTO } from "../../../dto/contractDTO";
import { ArticleDTO } from "../../../dto/articleDTO";
import { PerformanceDTO } from "../../../dto/performanceDTO";
import { Temporal } from "@js-temporal/polyfill";
import { resolveBackendUrl } from "@/services/resolveBackendUrl";

const API_BASE_URL = resolveBackendUrl() + "/api";

async function apiRequest<T = unknown>(
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

  if (response.status === 204) {
    return undefined as T;
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

function deserializeContract(c: ContractDTO): ContractDTO {
  return new ContractDTO(
    c.id,
    c.team,
    c.article,
    Temporal.Instant.from(c.startDate as unknown as string),
    Temporal.Duration.from(c.duration as unknown as string),
    c.purchasePrice
  );
}

// ── Me (current authenticated player) ────────────────────────────────────────

export const meApi = {
  getCurrent: () => apiRequest<PlayerDTO>("/me"),
  getTeams: () => apiRequest<TeamDTO[]>("/me/teams"),
  getNotifications: () => apiRequest<NotificationDTO[]>("/me/notifications"),
  updateCurrent: (data: Partial<PlayerDTO>) =>
    apiRequest<PlayerDTO>("/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ── Players ───────────────────────────────────────────────────────────────────

export const playersApi = {
  create: (data: Partial<PlayerDTO>) =>
    apiRequest<PlayerDTO>("/players", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getById: (id: string) => apiRequest<PlayerDTO>(`/players/${id}`),
};

// ── Leagues ───────────────────────────────────────────────────────────────────

export const leaguesApi = {
  /** The current player's leagues available for selection (resolved from JWT on backend) */
  getAll: () =>
    apiRequest<LeagueDTO[]>("/leagues").then((ls) => ls.map(deserializeLeague)),
  getById: (id: string) =>
    apiRequest<LeagueDTO>(`/leagues/${id}`).then(deserializeLeague),
  /** The current player's team inside this league (resolved from JWT on backend) */
  getMyTeam: (id: string) => apiRequest<TeamDTO>(`/leagues/${id}/my-team`),
  /** All contracts of the current player's team in this league */
  getMyContracts: (id: string) =>
    apiRequest<ContractDTO[]>(`/leagues/${id}/my-contracts`).then((cs) =>
      cs.map(deserializeContract)
    ),
  /** All notifications for the current player in this league */
  getMyNotifications: (id: string) =>
    apiRequest<NotificationDTO[]>(`/leagues/${id}/my-notifications`),

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
    apiRequest<ContractDTO[]>(`/teams/${id}/contracts`).then((cs) =>
      cs.map(deserializeContract)
    ),
  getNotifications: (id: string) =>
    apiRequest<NotificationDTO[]>(`/teams/${id}/notifications`),
  createContract: (
    teamId: string,
    data: {
      articleId?: string;
      articleID?: string;
      startDate: Temporal.Instant;
      duration: Temporal.Duration;
      purchasePrice: number;
      teamID?: string;
    }
  ) => {
    const normalizedPayload = {
      articleId: data.articleId ?? data.articleID,
      startDate: data.startDate,
      duration: data.duration,
      purchasePrice: data.purchasePrice,
    };

    return apiRequest<ContractDTO>(`/teams/${teamId}/contracts`, {
      method: "POST",
      body: JSON.stringify(normalizedPayload),
    }).then(deserializeContract);
  },
};

// ── Contracts ─────────────────────────────────────────────────────────────────

export const contractsApi = {
  getById: (id: string) =>
    apiRequest<ContractDTO>(`/contracts/${id}`).then(deserializeContract),
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
  me: meApi,
  player: meApi,
  players: playersApi,
  leagues: leaguesApi,
  teams: teamsApi,
  contracts: contractsApi,
  notifications: notificationsApi,
  articles: articlesApi,
  dashboard: dashboardApi,
  session: sessionApi,
};

export default api;
