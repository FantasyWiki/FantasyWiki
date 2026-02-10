// frontend/src/services/api.ts
import type {
  Article,
  Contract,
  DashboardData,
  LeaderboardEntry,
  League,
  Notification,
  Player,
  Team,
} from "@/types/models";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// Helper function for API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
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

// ============= PLAYER API =============

export const playerApi = {
  getCurrent: () => apiRequest<Player>("/player"),
};

// ============= LEAGUES API =============

export const leaguesApi = {
  getAll: () => apiRequest<League[]>("/leagues"),

  getById: (leagueId: string) => apiRequest<League>(`/leagues/${leagueId}`),

  getLeaderboard: (leagueId: string) =>
    apiRequest<LeaderboardEntry[]>(`/leagues/${leagueId}/leaderboard`),

  getNotifications: (leagueId: string) =>
    apiRequest<Notification[]>(`/leagues/${leagueId}/notifications`),

  getTeam: (leagueId: string) => apiRequest<Team>(`/leagues/${leagueId}/team`),

  getContracts: (leagueId: string) =>
    apiRequest<Contract[]>(`/leagues/${leagueId}/contracts`),
};

// ============= TEAMS API =============

export const teamsApi = {
  getAll: () => apiRequest<Team[]>("/teams"),

  getById: (teamId: string) => apiRequest<Team>(`/teams/${teamId}`),

  getContracts: (teamId: string) =>
    apiRequest<Contract[]>(`/teams/${teamId}/contracts`),

  createContract: (
    teamId: string,
    data: {
      articleId: string;
      tier: "SHORT" | "MEDIUM" | "LONG";
      purchasePrice: number;
    }
  ) =>
    apiRequest<Contract>(`/teams/${teamId}/contracts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ============= CONTRACTS API =============

export const contractsApi = {
  getById: (contractId: string) =>
    apiRequest<Contract>(`/contracts/${contractId}`),

  delete: (contractId: string) =>
    apiRequest<{ message: string; refundedCredits: number }>(
      `/contracts/${contractId}`,
      {
        method: "DELETE",
      }
    ),
};

// ============= NOTIFICATIONS API =============

export const notificationsApi = {
  getAll: () => apiRequest<Notification[]>("/notifications"),

  markAsRead: (notificationId: string) =>
    apiRequest<Notification>(`/notifications/${notificationId}/read`, {
      method: "PATCH",
    }),
};

// ============= ARTICLES API =============

export const articlesApi = {
  getAll: () => apiRequest<Article[]>("/articles"),

  getById: (articleId: string) => apiRequest<Article>(`/articles/${articleId}`),
};

// ============= DASHBOARD API =============

export const dashboardApi = {
  getData: (leagueId: string) =>
    apiRequest<DashboardData>(`/dashboard/${leagueId}`),
};

// Export all APIs
export const api = {
  player: playerApi,
  leagues: leaguesApi,
  teams: teamsApi,
  contracts: contractsApi,
  notifications: notificationsApi,
  articles: articlesApi,
  dashboard: dashboardApi,
};

export default api;
