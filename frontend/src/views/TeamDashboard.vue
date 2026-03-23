<template>
  <nav-bar>
    <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
      <ion-refresher-content
        pulling-icon="chevron-down-circle-outline"
        refreshing-spinner="crescent"
      />
    </ion-refresher>

    <!-- Loading -->
    <div v-if="isLoading && !summary" class="loading-container">
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
        :summary="summary"
      />

      <ion-grid class="content-grid ion-no-padding">
        <ion-row>
          <ion-col size="12" size-lg="8">
            <needed-attention
              :urgent-contract="urgentContracts"
              :on-buy-articles="() => router.push('/market')"
            />
          </ion-col>
          <ion-col size="12" size-lg="4">
            <league-leaderboard
              :leader-board-entry="playersAroundUser"
              :current-league="currentLeague"
              :current-team="team"
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
  refreshOutline,
  trophyOutline,
} from "ionicons/icons";

import NavBar from "@/layout/NavBar.vue";
import DashboardHero from "@/modules/TeamDashboard/DashboardHero.vue";
import NeededAttention from "@/modules/TeamDashboard/NeededAttention.vue";
import LeagueLeaderboard from "@/modules/TeamDashboard/LeagueLeaderboard.vue";

import { useLeagueStore } from "@/stores/league";
import { useDashboard } from "@/stores/useDashboard";

const router = useRouter();
const leagueStore = useLeagueStore();

const currentLeague = computed(() => leagueStore.currentLeague);

const {
  isLoading,
  isError,
  error,
  refetch,
  summary,
  team,
  contracts,
  leaderboard,
} = useDashboard();

const urgentContracts = computed(() =>
  contracts.value.filter((c) => c.expiresIn <= 3)
);

const playersAroundUser = computed(() => {
  const entries = leaderboard.value;
  const idx = entries.findIndex((e) => e.isCurrentUser);
  if (idx === -1) return entries.slice(0, 5);
  const start = Math.max(0, idx - 2);
  const end = Math.min(entries.length, idx + 3);
  return entries.slice(start, end);
});

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
