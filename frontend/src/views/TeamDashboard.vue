<template>
  <nav-bar>
    <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
      <ion-refresher-content
        :pulling-icon="chevronDownCircleOutline"
        refreshing-spinner="crescent"
      />
    </ion-refresher>

    <!-- Loading -->
    <div v-if="isLoading && !dashboardData" class="loading-container">
      <ion-spinner name="crescent" color="primary" />
      <ion-text color="medium"><p>Loading dashboard…</p></ion-text>
    </div>

    <!-- Error -->
    <ion-card v-else-if="isError" color="danger" class="state-card">
      <ion-card-content>
        <div class="error-row">
          <ion-icon :icon="alertCircleOutline" />
          <div>
            <h3 class="ion-no-margin">Error loading dashboard</h3>
            <p>{{ error?.message }}</p>
            <ion-button
              fill="outline"
              color="light"
              size="small"
              @click="refetch"
            >
              <ion-icon slot="start" :icon="refreshOutline" />
              Retry
            </ion-button>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- No league -->
    <ion-card v-else-if="!currentLeague" class="state-card">
      <ion-card-content>
        <div class="empty-state">
          <ion-icon :icon="trophyOutline" color="medium" />
          <h2>No League Selected</h2>
          <p>Select a league from the header to view your dashboard.</p>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Dashboard -->
    <template v-else>
      <!-- Hero contains the notification bell and all top-level actions -->
      <dashboard-hero
        :current-league="currentLeague"
        :current-team="team"
        :data="dashboardData!"
      />

      <ion-grid class="content-grid ion-no-padding">
        <ion-row>
          <ion-col size="12" size-lg="6">
            <needed-attention
              :urgent-contract="urgentContracts"
              :on-buy-articles="() => router.push('/market')"
            />
          </ion-col>
          <ion-col size="12" size-lg="6">
            <league-leaderboard
              :leaderboard="leaderBoard"
              :current-league="currentLeague"
              :current-team="team"
              :past-leaderboard="pastLeaderboard"
              :slice="LEADERBOARD_SLICE"
            />
          </ion-col>
        </ion-row>
      </ion-grid>
    </template>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCol,
  IonGrid,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonRow,
  IonSpinner,
  IonText,
} from "@ionic/vue";
import {
  alertCircleOutline,
  chevronDownCircleOutline,
  refreshOutline,
  trophyOutline,
} from "ionicons/icons";

import NavBar from "@/layout/NavBar.vue";
import DashboardHero from "@/components/teamDashboard/DashboardHero.vue";
import NeededAttention from "@/components/teamDashboard/NeededAttention.vue";
import LeagueLeaderboard from "@/components/teamDashboard/LeagueLeaderboard.vue";

import { useLeagueStore } from "@/stores/league";
import { useDashboard } from "@/stores/useDashboard";
import { useLeaguePerformances } from "@/stores/useLeaguePerformances";

const router = useRouter();
const leagueStore = useLeagueStore();

const currentLeague = computed(() => leagueStore.currentLeague);
//const loading = ref(true);
const {
  dashboardData,
  isLoading,
  isError,
  error,
  refetch,
  team,
  contracts,
  leaderBoard,
} = useDashboard();

const urgentContracts = computed(() => {
  if (!contracts.value?.length) return [];
  else
    return contracts.value.filter(
      (c) => c.expiresIn.total({ unit: "days" }) < 3
    );
});

const LEADERBOARD_SLICE = 5;
const { pastLeaderboard } = useLeaguePerformances();

async function handleRefresh(event: CustomEvent) {
  await refetch();
  (event.target as HTMLIonRefresherElement).complete();
}
</script>

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  gap: 1rem;
}

.loading-container ion-spinner {
  width: 3rem;
  height: 3rem;
}

.state-card {
  margin-top: 2rem;
}

.error-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}
.error-row ion-icon {
  font-size: 3rem;
  flex-shrink: 0;
}
.error-row h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.empty-state {
  text-align: center;
  padding: 2.5rem 1rem;
}
.empty-state ion-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}
.empty-state h2 {
  font-size: 1.35rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}
.empty-state p {
  color: var(--ion-color-medium);
  margin: 0;
}

.content-grid {
  margin-top: 0;
}
</style>
