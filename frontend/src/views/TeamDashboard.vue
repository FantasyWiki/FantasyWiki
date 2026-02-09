<template>
  <nav-bar>
    <!-- Page Header -->
    <div class="dashboard-header">
      <div class="header-text">
        <ion-title>Player Dashboard</ion-title>
        <ion-text color="medium">
          Manage your team, track performance, and climb the leaderboard
        </ion-text>
      </div>
      <div class="header-actions">
        <ion-button
          fill="solid"
          size="large"
          @click="router.push('/notification')"
        >
          <ion-icon :icon="notificationsOutline" />
          <ion-badge
            color="danger"
            v-if="true"
          >
            {{ 1 }}
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

    <!-- Summary Cards -->
    <dashboard-summary />

    <!-- Main Grid -->
    <ion-grid class="dashboard-grid">
      <ion-row>
        <!-- Portfolio & Articles - Takes 2 columns on large screens -->
        <ion-col size="12" size-lg="8">
          <div class="main-column">
            <owned-articles :on-buy-articles="() => router.push('/market')" />
          </div>
        </ion-col>

        <!-- Leaderboard Sidebar -->
        <ion-col size="12" size-lg="4">
          <league-leaderboard />
        </ion-col>
      </ion-row>
    </ion-grid>
  </nav-bar>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import {
  IonText,
  IonButton,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
} from "@ionic/vue";
import { cartOutline, notificationsOutline } from "ionicons/icons";
import NavBar from "@/layout/NavBar.vue";
import DashboardSummary from "@/modules/TeamDashboard/TeamDashboardCards.vue";
import OwnedArticles from "@/modules/TeamDashboard/NeededAttention.vue";
import LeagueLeaderboard from "@/modules/TeamDashboard/LeagueLeaderboard.vue";

const router = useRouter();
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
}

.header-text ion-text {
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
</style>