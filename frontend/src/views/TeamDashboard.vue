<template>
  <nav-bar>
    <!-- Page Header -->
    <div class="dashboard-header">
      <div class="header-text">
        <ion-title v-if="currentTeam"
          >{{ currentTeam.name }} Dashboard</ion-title
        >
        <ion-title v-else>Team Dashboard</ion-title>
        <ion-text color="medium">
          <p v-if="currentLeague">
            {{ currentLeague.icon }} {{ currentLeague.name }} • Season
            {{ currentLeague.season }}
          </p>
          <p v-else>Select a league to view your team</p>
        </ion-text>
      </div>
      <div class="header-actions">
        <ion-button
          fill="outline"
          size="large"
          @click="router.push('/notifications')"
        >
          <ion-icon :icon="notificationsOutline" />
          <ion-badge color="danger" v-if="unreadCount > 0">
            {{ unreadCount }}
          </ion-badge>
        </ion-button>

        <ion-button
          fill="solid"
          size="large"
          color="primary"
          @click="router.push('/market')"
        >
          <ion-icon slot="start" :icon="cartOutline" />
          Buy Articles
        </ion-button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <ion-spinner name="crescent" color="primary" />
      <ion-text color="medium">
        <p>Loading dashboard...</p>
      </ion-text>
    </div>

    <!-- Error State -->
    <ion-card v-else-if="error" color="danger">
      <ion-card-content>
        <div class="error-content">
          <ion-icon :icon="alertCircleOutline" />
          <div>
            <h3>Error Loading Dashboard</h3>
            <p>{{ error }}</p>
            <ion-button
              @click="refresh"
              size="small"
              fill="outline"
              color="light"
            >
              <ion-icon slot="start" :icon="refreshOutline" />
              Retry
            </ion-button>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Dashboard Content -->
    <template v-else-if="currentLeague && currentTeam">
      <!-- Summary Cards -->
      <dashboard-summary :summaryData="summary" />

      <!-- Main Grid -->
      <ion-grid class="dashboard-grid">
        <ion-row>
          <!-- Portfolio & Articles - Takes 2 columns on large screens -->
          <ion-col size="12" size-lg="8">
            <div class="main-column">
              <needed-attention
                :urgentContract="urgentContracts"
                :on-buy-articles="() => router.push('/market')"
                @refresh="refresh"
              />
            </div>
          </ion-col>

          <!-- Leaderboard Sidebar -->
          <ion-col size="12" size-lg="4">
            <league-leaderboard
              :leaderBoardEntry="playersAroundUser"
              :currentLeague="currentLeague"
              :currentTeam="currentTeam"
            />
          </ion-col>
        </ion-row>
      </ion-grid>
    </template>

    <!-- No League Selected State -->
    <ion-card v-else class="empty-state-card">
      <ion-card-content>
        <div class="empty-state">
          <ion-icon :icon="trophyOutline" />
          <h2>No League Selected</h2>
          <p>
            Please select a league from the header to view your team dashboard.
          </p>
        </div>
      </ion-card-content>
    </ion-card>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCol,
  IonGrid,
  IonIcon,
  IonRow,
  IonSpinner,
  IonText,
  IonTitle,
} from "@ionic/vue";
import {
  alertCircleOutline,
  cartOutline,
  notificationsOutline,
  refreshOutline,
  trophyOutline,
} from "ionicons/icons";
import NavBar from "@/layout/NavBar.vue";
import DashboardSummary from "@/modules/TeamDashboard/DashboardSummary.vue";
import NeededAttention from "@/modules/TeamDashboard/NeededAttention.vue";
import LeagueLeaderboard from "@/modules/TeamDashboard/LeagueLeaderboard.vue";
import { useLeagueStore } from "@/stores/league";
import { useDashboardStore } from "@/stores/dashboard";

const router = useRouter();
const leagueStore = useLeagueStore();
const dashboardStore = useDashboardStore();

// Computed properties from stores
const currentLeague = computed(() => leagueStore.currentLeague);
const currentTeam = computed(() => leagueStore.currentTeam);
const unreadCount = computed(() => leagueStore.unreadCount);
const isLoading = computed(
  () => dashboardStore.isLoading || leagueStore.isLoading
);
const error = computed(() => dashboardStore.error || leagueStore.error);
const summary = computed(() => dashboardStore.summary);
const urgentContracts = computed(() => dashboardStore.urgentContracts);
const playersAroundUser = computed(() => dashboardStore.playersAroundUser);

// Methods
const refresh = async () => {
  if (currentLeague.value) {
    await dashboardStore.fetchDashboardData(currentLeague.value.id);
  }
};

// Watch for league changes and reload data
watch(
  () => leagueStore.currentLeagueId,
  async (newLeagueId) => {
    if (newLeagueId) {
      await dashboardStore.fetchDashboardData(newLeagueId);
    }
  }
);

// Initialize on mount
onMounted(async () => {
  // Initialize league store if not already done
  if (!leagueStore.currentLeague) {
    await leagueStore.initialize();
  }

  // Fetch dashboard data for current league
  if (leagueStore.currentLeagueId) {
    await dashboardStore.fetchDashboardData(leagueStore.currentLeagueId);
  }
});
</script>

<style scoped>
.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}

.header-text ion-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 8px 0;
  padding: 0;
}

.header-text ion-text p {
  margin: 0;
  font-size: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dashboard-grid {
  padding: 0;
  margin-top: 24px;
}

.main-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
}

.loading-container ion-spinner {
  width: 48px;
  height: 48px;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.error-content ion-icon {
  font-size: 48px;
  flex-shrink: 0;
}

.error-content h3 {
  margin: 0 0 8px 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.error-content p {
  margin: 0 0 12px 0;
}

.empty-state-card {
  margin-top: 40px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-state ion-icon {
  font-size: 64px;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
}

.empty-state h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--ion-color-dark);
}

.empty-state p {
  margin: 0;
  color: var(--ion-color-medium);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions ion-button {
    flex: 1;
  }

  .header-text ion-title {
    font-size: 1.5rem;
  }
}

/* Dark mode */
.ion-palette-dark .empty-state h2 {
  color: var(--ion-color-light);
}
</style>
