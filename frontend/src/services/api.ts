// frontend/src/services/api.ts
import type {
  Article,
  Contract,
  DashboardData,
  LeaderboardEntry,
  League,
  Notification,
  Player,
  Session,
  Team,
  TradeProposal,
} from "@/types/models";

export function resolveBackendUrl(): string {
  const branch = import.meta.env.VITE_WORKERS_CI_BRANCH;
  const backend = import.meta.env.VITE_BACKEND_URL;
  let url = backend;
  if (branch) {
    url = branch + "-" + backend;
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url;
}

const API_BASE_URL = resolveBackendUrl() + "/api";

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
  getCurrent: () => apiRequest<Player>("/player"),
};

// ── Leagues ───────────────────────────────────────────────────────────────────

export const leaguesApi = {
  getAll: () => apiRequest<League[]>("/leagues"),
  getById: (id: string) => apiRequest<League>(`/leagues/${id}`),
  getLeaderboard: (id: string) =>
    apiRequest<LeaderboardEntry[]>(`/leagues/${id}/leaderboard`),
  getNotifications: (id: string) =>
    apiRequest<Notification[]>(`/leagues/${id}/notifications`),
  getTeam: (id: string) => apiRequest<Team>(`/leagues/${id}/team`),
  getContracts: (id: string) =>
    apiRequest<Contract[]>(`/leagues/${id}/contracts`),
  /** All proposals (incoming + outgoing) for the current player in this league */
  getTrades: (id: string) =>
    apiRequest<TradeProposal[]>(`/leagues/${id}/trades`),
};

// ── Teams ─────────────────────────────────────────────────────────────────────

export const teamsApi = {
  getAll: () => apiRequest<Team[]>("/teams"),
  getById: (id: string) => apiRequest<Team>(`/teams/${id}`),
  getContracts: (id: string) =>
    apiRequest<Contract[]>(`/teams/${id}/contracts`),
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

// ── Contracts ─────────────────────────────────────────────────────────────────

export const contractsApi = {
  getById: (id: string) => apiRequest<Contract>(`/contracts/${id}`),
  delete: (id: string) =>
    apiRequest<{ message: string; refundedCredits: number }>(
      `/contracts/${id}`,
      { method: "DELETE" }
    ),
};

// ── Trade Proposals ───────────────────────────────────────────────────────────

export const tradesApi = {
  /** Accept a pending trade proposal */
  accept: (tradeId: string) =>
    apiRequest<TradeProposal>(`/trades/${tradeId}/accept`, { method: "PATCH" }),

  /** Reject a pending trade proposal */
  reject: (tradeId: string) =>
    apiRequest<TradeProposal>(`/trades/${tradeId}/reject`, { method: "PATCH" }),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationsApi = {
  getAll: () => apiRequest<Notification[]>("/notifications"),
  markAsRead: (id: string) =>
    apiRequest<Notification>(`/notifications/${id}/read`, { method: "PATCH" }),
};

// ── Articles ──────────────────────────────────────────────────────────────────

export const articlesApi = {
  getAll: () => apiRequest<Article[]>("/articles"),
  getById: (id: string) => apiRequest<Article>(`/articles/${id}`),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getData: (leagueId: string) =>
    apiRequest<DashboardData>(`/dashboard/${leagueId}`),
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
  trades: tradesApi,
  notifications: notificationsApi,
  articles: articlesApi,
  dashboard: dashboardApi,
  session: sessionApi,
};

export default api;
