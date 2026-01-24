<template>
  <section id="leagues" class="ion-padding-vertical">
    <ion-grid>
      <ion-row class="ion-align-items-center">
        <!-- Left Content -->
        <ion-col size="12" size-lg="6" class="ion-margin-bottom">
          <div class="ion-margin-bottom">
            <ion-chip color="primary">
              <ion-icon
                :icon="trophyOutline"
                class="ion-padding-end ion-no-margin"
              ></ion-icon>
              Weekly Tournament
            </ion-chip>
          </div>

          <h2 class="ion-margin-bottom">
            Compete for <ion-text color="secondary">Glory</ion-text>
          </h2>

          <p class="subtitle ion-margin-bottom">
            Every week, all active players automatically enter a competitive
            tournament. Climb the ranks, earn bonus points, and prove your
            knowledge dominance.
          </p>

          <div class="ion-margin-bottom">
            <div
              class="ion-display-flex ion-align-items-center ion-margin-vertical"
              v-for="reward in rewards"
              :key="reward.rank"
            >
              <div
                class="reward-badge ion-display-flex ion-justify-content-center ion-align-items-center ion-padding ion-margin-end"
                :class="reward.badgeClass"
              >
                {{ reward.medal }}
              </div>
              <div>
                <div class="reward-title ion-margin-bottom">
                  {{ reward.rank }}
                </div>
                <div class="reward-description">{{ reward.description }}</div>
              </div>
            </div>
          </div>

          <ion-button
            expand="block"
            size="large"
            class="ion-text-capitalize ion-padding-horizontal"
          >
            Join the Competition
            <ion-icon :icon="trophyOutline" slot="end"></ion-icon>
          </ion-button>
        </ion-col>

        <!-- Right - Leaderboard -->
        <ion-col size="12" size-lg="6">
          <ion-card class="leaderboard-card">
            <ion-card-header class="leaderboard-header">
              <div
                class="header-content ion-display-flex ion-align-items-center ion-justify-content-between"
              >
                <h3>🏆 Global Leaderboard</h3>
                <span class="update-time">Updated hourly</span>
              </div>
            </ion-card-header>

            <ion-card-content class="ion-no-padding">
              <ion-list>
                <ion-item
                  v-for="player in leaderboardData"
                  :key="player.rank"
                  :class="[
                    'leaderboard-item ion-no-padding',
                    player.rank <= 3 ? 'top-3' : '',
                  ]"
                  lines="none"
                >
                  <div
                    slot="start"
                    class="rank-badge"
                    :class="getRankClass(player.rank)"
                  >
                    {{ player.rank }}
                  </div>

                  <ion-label>
                    <div class="player-name">{{ player.name }}</div>
                  </ion-label>

                  <div slot="end" class="player-stats">
                    <div class="points">
                      {{ player.points.toLocaleString() }}
                    </div>
                    <div class="trend" :class="`trend-${player.trend}`">
                      <ion-icon
                        :icon="getTrendIcon(player.trend)"
                        class="trend-icon"
                      ></ion-icon>
                      {{ player.change > 0 ? "+" : "" }}{{ player.change }}%
                    </div>
                  </div>
                </ion-item>
              </ion-list>
            </ion-card-content>

            <ion-card-header class="leaderboard-footer">
              <div class="footer-content">
                <span>Your Rank</span>
                <span class="your-rank">#4,523</span>
              </div>
            </ion-card-header>
          </ion-card>
        </ion-col>
      </ion-row>
    </ion-grid>
  </section>
</template>

<script setup lang="ts">
import {
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonIcon,
  IonButton,
  IonChip,
  IonList,
  IonItem,
  IonLabel,
  IonText,
} from "@ionic/vue";
import {
  trophyOutline,
  trendingUp,
  trendingDown,
  removeOutline,
} from "ionicons/icons";

interface LeaderboardPlayer {
  rank: number;
  name: string;
  points: number;
  change: number;
  trend: "up" | "down" | "neutral";
}

const leaderboardData: LeaderboardPlayer[] = [
  { rank: 1, name: "CryptoGod", points: 3850, change: 12, trend: "up" },
  { rank: 2, name: "WordHunter", points: 3720, change: 5, trend: "up" },
  { rank: 3, name: "BullishBot", points: 3610, change: -3, trend: "down" },
  { rank: 4, name: "TrendMaster", points: 3480, change: 8, trend: "up" },
  { rank: 5, name: "WikiWizard", points: 3350, change: 0, trend: "neutral" },
  { rank: 6, name: "ArticleAce", points: 3210, change: -1, trend: "down" },
  { rank: 7, name: "PageviewPro", points: 3100, change: 4, trend: "up" },
  { rank: 8, name: "KnowledgeKing", points: 2980, change: 2, trend: "up" },
];

const rewards = [
  {
    rank: "Top 10",
    medal: "🥇",
    description: "+20 bonus points/day in main game",
    badgeClass: "badge-gold",
  },
  {
    rank: "Top 100",
    medal: "🥈",
    description: "+10 bonus points/day in main game",
    badgeClass: "badge-silver",
  },
  {
    rank: "Top 1000",
    medal: "🥉",
    description: "+5 bonus points/day in main game",
    badgeClass: "badge-bronze",
  },
];

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case "up":
      return trendingUp;
    case "down":
      return trendingDown;
    default:
      return removeOutline;
  }
};

const getRankClass = (rank: number) => {
  if (rank === 1) return "rank-1";
  if (rank === 2) return "rank-2";
  if (rank === 3) return "rank-3";
  return "rank-default";
};
</script>

<style scoped>
ion-chip {
  font-weight: 500;
}

.subtitle {
  font-size: 1.125rem;
  color: var(--ion-color-medium);
}

.reward-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.reward-badge {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
}

.badge-gold {
  background-color: var(--ion-color-tertiary);
}

.badge-silver {
  background-color: var(--ion-color-tertiary);
}

.badge-bronze {
  background-color: var(--ion-color-tertiary);
}

.reward-title {
  font-weight: 500;
  --ion-margin: 0.125rem;
}

.reward-description {
  font-size: 0.875rem;
}

/* Leaderboard Card */
.leaderboard-card {
  border-radius: 1rem;
  border: 1px solid var(--ion-color-light-shade);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.leaderboard-header {
  background-color: rgba(var(--ion-color-secondary-rgb), 0.5);
  border-bottom: 1px solid var(--ion-color-light-shade);
  padding: 1rem;
}

.header-content h3 {
  margin: 0;
  font-size: 1rem;
}

.update-time {
  font-size: 0.75rem;
}

/* Leaderboard Items */
.leaderboard-item {
  padding: 1rem;
  transition: background-color 0.2s ease;
  --background: transparent;
}

.leaderboard-item:hover {
  --background: rgba(var(--ion-color-secondary-rgb), 0.5);
}

.leaderboard-item.top-3 {
  background-color: rgba(245, 166, 35, 0.05);
}

.rank-badge {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: bold;
  margin-right: 0.5rem;
}

.rank-1 {
  background-color: #f5a623;
  color: white;
}

.rank-2 {
  background-color: var(--ion-color-medium);
  color: white;
}

.rank-3 {
  background-color: rgba(245, 166, 35, 0.5);
  color: white;
}

.rank-default {
  background-color: var(--ion-color-light);
  color: var(--ion-color-medium);
}

.player-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-stats {
  text-align: right;
}

.points {
  font-weight: bold;
  margin-bottom: 0.125rem;
}

.trend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.trend-icon {
  font-size: 0.75rem;
}

.trend-up {
  color: var(--ion-color-primary);
}

.trend-down {
  color: var(--ion-color-danger);
}

.trend-neutral {
  color: var(--ion-color-medium);
}

.leaderboard-footer {
  background-color: rgba(var(--ion-color-secondary-rgb), 0.3);
  border-top: 1px solid var(--ion-color-light-shade);
  padding: 1rem;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.your-rank {
  font-weight: bold;
  color: var(--ion-color-primary);
}

/* Responsive */
@media (max-width: 991px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>
