<template>
  <ion-card class="leaderboard-card">
    <ion-card-header>
      <div class="header-wrapper">
        <div class="header-icon">
          <ion-icon :icon="trophyOutline" color="warning" />
        </div>
        <div>
          <ion-card-title>League Standings</ion-card-title>
          <ion-card-subtitle>
            <span>{{ currentLeague.icon }}</span>
            <span>{{ currentLeague.name }}</span>
          </ion-card-subtitle>
        </div>
      </div>

      <!-- League Info Badges -->
      <div class="badges-wrapper">
        <ion-badge color="medium">{{ leagueInfo.language }}</ion-badge>
        <ion-badge color="medium" mode="ios">{{ leagueInfo.totalPlayers }} players</ion-badge>
        <ion-badge color="medium" mode="ios">Ends {{ leagueInfo.endDate }}</ion-badge>
      </div>
    </ion-card-header>

    <ion-card-content>
      <!-- Leaderboard List -->
      <ion-list lines="none" class="leaderboard-list">
        <ion-item
          v-for="player in leaderboardData"
          :key="player.rank"
          class="player-item"
          :class="{ 'current-user': player.isCurrentUser }"
        >
          <div class="player-content">
            <div class="player-info">
              <div
                class="rank-badge"
                :class="{ 'top-rank': player.rank <= 3 }"
              >
                {{ player.rank }}
              </div>
              <div>
                <div class="player-name-row">
                  <span
                    class="player-name"
                    :class="{ 'current-user-name': player.isCurrentUser }"
                  >
                    {{ player.name }}
                  </span>
                  <ion-icon
                    v-if="player.rank === 1"
                    :icon="crownIcon"
                    class="crown-icon"
                  />
                  <ion-icon
                    v-else-if="player.rank <= 3"
                    :icon="medalIcon"
                    class="medal-icon"
                  />
                </div>
                <ion-text color="medium">
                  <span class="player-points">{{ player.points.toLocaleString() }} pts</span>
                </ion-text>
              </div>
            </div>

            <div class="player-change" :class="player.change >= 0 ? 'positive' : 'negative'">
              <ion-icon :icon="player.change >= 0 ? trendingUpOutline : trendingDownOutline" />
              <span>{{ player.change >= 0 ? '+' : '' }}{{ player.change }}%</span>
            </div>
          </div>
        </ion-item>
      </ion-list>

      <!-- View Full Leaderboard Button -->
      <ion-button
        expand="block"
        fill="outline"
        class="ion-margin-top"
        @click="navigateToLeague"
      >
        View League Details
        <ion-icon slot="end" :icon="chevronForwardOutline" />
      </ion-button>

      <!-- Quick Action -->
      <div class="quick-action">
        <ion-button expand="block" color="primary" size="small" @click="navigateToMarket">
          Buy Articles
        </ion-button>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useLeagueStore } from "@/stores/league";
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonList,
  IonItem,
  IonText,
  IonButton,
} from "@ionic/vue";
import {
  trophyOutline,
  trendingUpOutline,
  trendingDownOutline,
  chevronForwardOutline,
} from "ionicons/icons";

interface LeaderboardPlayer {
  rank: number;
  name: string;
  points: number;
  change: number;
  isCurrentUser: boolean;
}

interface LeagueInfo {
  language: string;
  totalPlayers: number;
  endDate: string;
}

const router = useRouter();
const leagueStore = useLeagueStore();
const currentLeague = computed(() => leagueStore.currentLeague);

// Mock data - replace with real data from store/API
const leagueInfoMap: Record<string, LeagueInfo> = {
  global: { language: "All Languages", totalPlayers: 10523, endDate: "Mar 31" },
  italy: { language: "Italiano", totalPlayers: 523, endDate: "Feb 28" },
};

const leagueInfo = computed(() => {
  return leagueInfoMap[currentLeague.value.id] || leagueInfoMap.global;
});

const mockLeaderboards: Record<string, LeaderboardPlayer[]> = {
  global: [
    { rank: 1, name: "WikiMaster", points: 15420, change: 15.2, isCurrentUser: false },
    { rank: 2, name: "DataKing", points: 14890, change: 12.8, isCurrentUser: false },
    { rank: 3, name: "InfoQueen", points: 14230, change: 8.5, isCurrentUser: false },
    { rank: 4, name: "You", points: 12750, change: 12.5, isCurrentUser: true },
    { rank: 5, name: "FactFinder", points: 12100, change: 7.2, isCurrentUser: false },
  ],
  italy: [
    { rank: 1, name: "RomaRuler", points: 8950, change: 18.3, isCurrentUser: false },
    { rank: 2, name: "MilanoMaster", points: 8420, change: 14.1, isCurrentUser: false },
    { rank: 3, name: "VenezianoVIP", points: 7890, change: 11.5, isCurrentUser: false },
    { rank: 4, name: "Tu", points: 7250, change: 9.8, isCurrentUser: true },
    { rank: 5, name: "FiorentinoPro", points: 6800, change: 6.4, isCurrentUser: false },
  ],
};

const leaderboardData = computed(() => {
  return mockLeaderboards[currentLeague.value.id] || mockLeaderboards.global;
});

const crownIcon = "👑";
const medalIcon = "🏅";

const navigateToLeague = () => {
  router.push("/leagues");
};

const navigateToMarket = () => {
  router.push("/market");
};
</script>

<style scoped>
.leaderboard-card {
  --background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  position: sticky;
  top: 90px;
}

.header-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.header-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(245, 200, 66, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon ion-icon {
  font-size: 20px;
}

ion-card-title {
  font-size: 1.25rem;
  margin-bottom: 4px;
}

ion-card-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
}

.badges-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

ion-badge {
  font-size: 0.75rem;
  padding: 4px 8px;
}

.leaderboard-list {
  padding: 0;
}

.player-item {
  --background: var(--ion-background-color);
  --padding-start: 12px;
  --padding-end: 12px;
  --inner-padding-end: 0;
  margin-bottom: 8px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.player-item:hover {
  --background: var(--ion-background-color-step-100);
}

.player-item.current-user {
  --background: var(--ion-color-primary-tint);
  border: 1px solid var(--ion-color-primary);
}

.player-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
  padding: 8px 0;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.rank-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  background: var(--ion-color-medium-tint);
  color: var(--ion-color-medium-contrast);
  flex-shrink: 0;
}

.rank-badge.top-rank {
  background: rgba(245, 200, 66, 0.2);
  color: var(--wiki-gold);
}

.player-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.player-name {
  font-weight: 600;
  color: var(--ion-color-dark);
}

.player-name.current-user-name {
  color: var(--ion-color-primary);
}

.crown-icon,
.medal-icon {
  font-size: 14px;
}

.player-points {
  font-size: 0.875rem;
}

.player-change {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  font-weight: 500;
}

.player-change ion-icon {
  font-size: 14px;
}

.player-change.positive {
  color: var(--ion-color-success);
}

.player-change.negative {
  color: var(--ion-color-danger);
}

.quick-action {
  padding-top: 16px;
  border-top: 1px solid var(--ion-border-color);
  margin-top: 16px;
}

/* Dark mode */
.ion-palette-dark .player-name {
  color: var(--ion-color-light);
}
</style>
