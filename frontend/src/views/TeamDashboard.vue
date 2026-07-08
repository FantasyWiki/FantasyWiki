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
      <ion-text color="medium"
        ><p>{{ t("views.teamDashboard.loading") }}</p></ion-text
      >
    </div>

    <!-- Error -->
    <ion-card v-else-if="isError" color="danger" class="state-card">
      <ion-card-content>
        <div class="error-row">
          <ion-icon :icon="alertCircleOutline" />
          <div>
            <h3 class="ion-no-margin">
              {{ t("views.teamDashboard.errorTitle") }}
            </h3>
            <p>{{ error?.message }}</p>
            <ion-button
              fill="outline"
              color="light"
              size="small"
              @click="refetch"
            >
              <ion-icon slot="start" :icon="refreshOutline" />
              {{ t("views.teamDashboard.retry") }}
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
          <h2>{{ t("views.teamDashboard.noLeagueTitle") }}</h2>
          <p>{{ t("views.teamDashboard.noLeagueHint") }}</p>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Dashboard -->
    <!--
      Desktop geometry (named grid areas): the pitch fills the left column
      while the right column is a vertical rail of hero + leaderboard, so
      both columns bottom out together; needed-attention spans below.
      On mobile the DOM order applies: hero, pitch, attention, leaderboard.
    -->
    <template v-else>
      <div class="dashboard-layout">
        <div class="area-hero">
          <!-- Hero contains the notification bell and all top-level actions -->
          <dashboard-hero
            :current-league="currentLeague"
            :current-team="team"
            :data="dashboardData!"
          />
        </div>
        <div class="area-pitch">
          <team-management :formation="draftFormation" />
        </div>
        <div class="area-attention">
          <needed-attention
            :urgent-contract="urgentContracts"
            :on-buy-articles="() => router.push('/market')"
          />
        </div>
        <div class="area-leaderboard">
          <league-leaderboard
            :leaderboard="leaderBoard"
            :current-league="currentLeague"
            :current-team="team"
            :slice="LEADERBOARD_SLICE"
          />
        </div>
      </div>
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
  IonIcon,
  IonRefresher,
  IonRefresherContent,
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
import { useDashboard } from "@/composables/useDashboard";
import { useTeamLineup } from "@/composables/useTeamLineup";
import TeamManagement from "@/components/teamDashboard/TeamManagement.vue";
import { useI18n } from "vue-i18n";

const router = useRouter();
const leagueStore = useLeagueStore();
const { draftFormation, refetch: refetchTeamLineup } = useTeamLineup();

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

const { t } = useI18n();
const urgentContracts = computed(() => {
  if (!contracts.value?.length) return [];
  else
    return contracts.value.filter(
      (c) => c.expiresIn.total({ unit: "days" }) < 3
    );
});

const LEADERBOARD_SLICE = 5;

async function handleRefresh(event: CustomEvent) {
  await refetchTeamLineup();
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

.dashboard-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

/* Desktop: pitch left, hero right; attention + leaderboard underneath */
@media (min-width: 992px) {
  .dashboard-layout {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    grid-template-areas:
      "pitch hero"
      "attention leaderboard";
    column-gap: 1rem;
  }

  /* Stretch the formation card (and the pitch inside it) and the hero to
     the same height so both columns bottom out on the same line. */
  .area-pitch {
    grid-area: pitch;
    display: flex;
    flex-direction: column;
  }

  .area-pitch :deep(.td-card) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .area-pitch :deep(.td-card ion-card-content) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .area-pitch :deep(.pitch-card) {
    flex: 1;
  }

  .area-hero {
    grid-area: hero;
    display: flex;
    flex-direction: column;
  }

  .area-hero :deep(.hero-wrapper) {
    flex: 1;
  }

  .area-attention {
    grid-area: attention;
  }

  .area-leaderboard {
    grid-area: leaderboard;
  }
}
</style>
