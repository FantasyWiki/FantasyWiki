// frontend/src/stores/dashboard.ts
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import api from "@/services/api";
import { useLeagueStore } from "./league";
import type {
  Contract,
  DashboardData,
  DashboardSummary,
  LeaderboardEntry,
} from "@/types/models";

/**
 * Store for managing dashboard data
 * Handles contracts, leaderboard, and summary statistics
 */
export const useDashboardStore = defineStore("dashboard", () => {
  // ========== STATE ==========
  const contracts = ref<Contract[]>([]);
  const leaderboard = ref<LeaderboardEntry[]>([]);
  const summary = ref<DashboardSummary | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // ========== GETTERS ==========

  /**
   * Get contracts that are expiring soon (≤3 days)
   */
  const urgentContracts = computed(() => {
    return contracts.value.filter((contract) => contract.expiresIn <= 3);
  });

  /**
   * Get contracts by tier
   */
  const contractsByTier = computed(() => {
    return {
      short: contracts.value.filter((c) => c.tier === "SHORT"),
      medium: contracts.value.filter((c) => c.tier === "MEDIUM"),
      long: contracts.value.filter((c) => c.tier === "LONG"),
    };
  });

  /**
   * Get total portfolio value
   */
  const totalPortfolioValue = computed(() => {
    return contracts.value.reduce((sum, c) => sum + c.currentPrice, 0);
  });

  /**
   * Get total purchase cost
   */
  const totalPurchaseCost = computed(() => {
    return contracts.value.reduce((sum, c) => sum + c.purchasePrice, 0);
  });

  /**
   * Get portfolio gain/loss
   */
  const portfolioChange = computed(() => {
    const total = totalPortfolioValue.value;
    const cost = totalPurchaseCost.value;
    return total - cost;
  });

  /**
   * Get portfolio change percentage
   */
  const portfolioChangePercent = computed(() => {
    const cost = totalPurchaseCost.value;
    if (cost === 0) return 0;
    return ((portfolioChange.value / cost) * 100).toFixed(1);
  });

  /**
   * Get current player's rank from leaderboard
   */
  const currentPlayerRank = computed(() => {
    const current = leaderboard.value.find((entry) => entry.isCurrentUser);
    return current?.rank || null;
  });

  /**
   * Get players around current user in leaderboard
   */
  const playersAroundUser = computed(() => {
    const currentIndex = leaderboard.value.findIndex(
      (entry) => entry.isCurrentUser
    );
    if (currentIndex === -1) return leaderboard.value.slice(0, 5);

    const start = Math.max(0, currentIndex - 2);
    const end = Math.min(leaderboard.value.length, currentIndex + 3);
    return leaderboard.value.slice(start, end);
  });

  // ========== ACTIONS ==========

  /**
   * Fetch complete dashboard data for current league
   */
  async function fetchDashboardData(leagueId?: string) {
    const leagueStore = useLeagueStore();
    const targetLeagueId = leagueId || leagueStore.currentLeagueId;

    if (!targetLeagueId) {
      error.value = "No league selected";
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const data: DashboardData = await api.dashboard.getData(targetLeagueId);

      // Update state
      contracts.value = data.contracts;
      leaderboard.value = data.leaderboard.map((entry) => ({
        ...entry,
        isCurrentUser: entry.teamId === data.team.id,
      }));
      summary.value = data.summary;

      // Update league store with team data
      leagueStore.currentTeam = data.team;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch dashboard data";
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Fetch contracts for current league
   */
  async function fetchContracts(leagueId?: string) {
    const leagueStore = useLeagueStore();
    const targetLeagueId = leagueId || leagueStore.currentLeagueId;

    if (!targetLeagueId) return;

    try {
      contracts.value = await api.leagues.getContracts(targetLeagueId);
    } catch (err) {
      console.error("Failed to fetch contracts:", err);
    }
  }

  /**
   * Fetch leaderboard for current league
   */
  async function fetchLeaderboard(leagueId?: string) {
    const leagueStore = useLeagueStore();
    const targetLeagueId = leagueId || leagueStore.currentLeagueId;

    if (!targetLeagueId) return;

    try {
      const data = await api.leagues.getLeaderboard(targetLeagueId);
      const teamId = leagueStore.currentTeam?.id;

      leaderboard.value = data.map((entry) => ({
        ...entry,
        isCurrentUser: teamId ? entry.teamId === teamId : false,
      }));
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    }
  }

  /**
   * Buy a new article (create contract)
   */
  async function buyArticle(
    articleId: string,
    tier: "SHORT" | "MEDIUM" | "LONG",
    purchasePrice: number
  ) {
    const leagueStore = useLeagueStore();
    const teamId = leagueStore.currentTeam?.id;

    if (!teamId) {
      error.value = "No team found";
      return null;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const newContract = await api.teams.createContract(teamId, {
        articleId,
        tier,
        purchasePrice,
      });

      // Add to local state
      contracts.value.push(newContract);

      // Update team credits
      if (leagueStore.currentTeam) {
        leagueStore.currentTeam.credits -= purchasePrice;
      }

      return newContract;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to buy article";
      console.error("Failed to buy article:", err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Sell an article (delete contract)
   */
  async function sellArticle(contractId: string) {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await api.contracts.delete(contractId);

      // Remove from local state
      const index = contracts.value.findIndex((c) => c.id === contractId);
      if (index !== -1) {
        contracts.value.splice(index, 1);
      }

      // Update team credits
      const leagueStore = useLeagueStore();
      if (leagueStore.currentTeam) {
        leagueStore.currentTeam.credits += result.refundedCredits;
      }

      return result;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to sell article";
      console.error("Failed to sell article:", err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Refresh all dashboard data
   */
  async function refresh() {
    const leagueStore = useLeagueStore();
    if (leagueStore.currentLeagueId) {
      await fetchDashboardData(leagueStore.currentLeagueId);
    }
  }

  /**
   * Clear dashboard data
   */
  function clear() {
    contracts.value = [];
    leaderboard.value = [];
    summary.value = null;
    error.value = null;
  }

  return {
    // State
    contracts,
    leaderboard,
    summary,
    isLoading,
    error,

    // Getters
    urgentContracts,
    contractsByTier,
    totalPortfolioValue,
    totalPurchaseCost,
    portfolioChange,
    portfolioChangePercent,
    currentPlayerRank,
    playersAroundUser,

    // Actions
    fetchDashboardData,
    fetchContracts,
    fetchLeaderboard,
    buyArticle,
    sellArticle,
    refresh,
    clear,
  };
});
