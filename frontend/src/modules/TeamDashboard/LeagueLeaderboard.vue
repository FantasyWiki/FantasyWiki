<template>
  <ion-card class="leaderboard-card">
    <!-- ── Header ───────────────────────────────── -->
    <ion-card-header>
      <div class="leaderboard-header">
        <div class="header-icon-wrapper">
          <ion-icon :icon="trophyOutline" color="warning" />
        </div>
        <div class="header-text">
          <ion-card-title>League Standings</ion-card-title>
          <ion-card-subtitle v-if="props.currentLeague">
            {{ props.currentLeague.icon }} {{ props.currentLeague.name }}
          </ion-card-subtitle>
        </div>
      </div>

      <!-- League meta chips -->
      <div class="meta-chips" v-if="props.currentLeague">
        <ion-chip class="meta-chip" color="medium" outline>
          <ion-label>{{ props.currentLeague.language }}</ion-label>
        </ion-chip>
        <ion-chip class="meta-chip" color="medium" outline>
          <ion-label>{{ props.currentLeague.totalPlayers }} players</ion-label>
        </ion-chip>
        <ion-chip class="meta-chip" color="medium" outline>
          <ion-label>Ends {{ props.currentLeague.endDate }}</ion-label>
        </ion-chip>
      </div>
    </ion-card-header>

    <!-- ── List ─────────────────────────────────── -->
    <ion-card-content class="ion-no-padding">
      <!-- Skeleton when loading -->
      <div v-if="props.leaderBoardEntry.length === 0" class="skeleton-list">
        <div v-for="i in 5" :key="i" class="skeleton-item">
          <ion-skeleton-text :animated="true" class="skeleton-rank" />
          <div class="skeleton-info">
            <ion-skeleton-text :animated="true" class="skeleton-name" />
            <ion-skeleton-text :animated="true" class="skeleton-pts" />
          </div>
          <ion-skeleton-text :animated="true" class="skeleton-change" />
        </div>
      </div>

      <ion-list v-else lines="none" class="player-list">
        <ion-item
          v-for="player in props.leaderBoardEntry"
          :key="player.rank"
          class="player-item"
          :class="{ 'player-item--me': player.isCurrentUser }"
          :detail="false"
        >
          <div class="player-row">
            <!-- Rank badge -->
            <div
              class="rank-badge"
              :class="{ 'rank-badge--top': player.rank <= 3 }"
            >
              <span v-if="player.rank === 1">👑</span>
              <span v-else-if="player.rank === 2">🥈</span>
              <span v-else-if="player.rank === 3">🥉</span>
              <span v-else>{{ player.rank }}</span>
            </div>

            <!-- Player info -->
            <div class="player-info">
              <div class="player-name-row">
                <span
                  class="player-name"
                  :class="{ 'player-name--me': player.isCurrentUser }"
                >
                  {{ player.username }}
                </span>
                <ion-badge
                  v-if="player.isCurrentUser"
                  color="primary"
                  class="you-badge"
                >
                  You
                </ion-badge>
              </div>
              <ion-text color="medium">
                <p class="player-points ion-no-margin">
                  {{ player.points.toLocaleString() }} pts
                </p>
              </ion-text>
            </div>

            <!-- Change indicator -->
            <div
              class="player-change"
              :class="
                player.change >= 0 ? 'player-change--up' : 'player-change--down'
              "
            >
              <ion-icon
                :icon="
                  player.change >= 0 ? trendingUpOutline : trendingDownOutline
                "
              />
              <span
                >{{ player.change >= 0 ? "+" : "" }}{{ player.change }}%</span
              >
            </div>
          </div>
        </ion-item>
      </ion-list>

      <!-- ── Footer Actions ─────────────────────── -->
      <div class="leaderboard-footer">
        <ion-button
          expand="block"
          fill="outline"
          class="footer-btn"
          @click="router.push('/leagues')"
        >
          View League Details
          <ion-icon slot="end" :icon="chevronForwardOutline" />
        </ion-button>

        <div class="footer-divider" />

        <ion-button
          expand="block"
          color="primary"
          size="small"
          @click="router.push('/market')"
        >
          Buy Articles
        </ion-button>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import {
  IonBadge,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonButton,
  IonChip,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSkeletonText,
  IonText,
} from "@ionic/vue";
import {
  chevronForwardOutline,
  trendingDownOutline,
  trendingUpOutline,
  trophyOutline,
} from "ionicons/icons";
import type { LeaderboardEntry, League, Team } from "@/types/models";

interface Props {
  leaderBoardEntry: LeaderboardEntry[];
  currentLeague: League | null;
  currentTeam: Team | null;
}

const props = defineProps<Props>();
const router = useRouter();
</script>

<style scoped>
/* ── Card ──────────────────────────────────────── */
.leaderboard-card {
  --background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  border-radius: 0.875rem;
  box-shadow: 0 2px 8px var(--ion-box-shadow-color);
  margin: 0 0 1rem 0;
}

/* ── Header ────────────────────────────────────── */
.leaderboard-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.header-icon-wrapper {
  width: 2.5rem;
  height: 2.5rem;
  min-width: 2.5rem;
  border-radius: 0.5rem;
  background: rgba(var(--ion-color-warning-rgb), 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon-wrapper ion-icon {
  font-size: 1.25rem;
}

.header-text ion-card-title {
  font-size: 1.1rem;
  margin-bottom: 2px;
}

.header-text ion-card-subtitle {
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Meta chips */
.meta-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.25rem;
}

.meta-chip {
  height: 1.5rem;
  font-size: 0.7rem;
  margin: 0;
}

/* ── Skeleton ──────────────────────────────────── */
.skeleton-list {
  padding: 0.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.skeleton-rank {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
}

.skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skeleton-name {
  height: 0.9rem;
  width: 60%;
  border-radius: 4px;
}

.skeleton-pts {
  height: 0.75rem;
  width: 40%;
  border-radius: 4px;
}

.skeleton-change {
  width: 3rem;
  height: 0.9rem;
  border-radius: 4px;
}

/* ── Player list ───────────────────────────────── */
.player-list {
  padding: 0.25rem 0;
}

.player-item {
  --background: transparent;
  --padding-start: 1rem;
  --padding-end: 1rem;
  --inner-padding-end: 0;
  --min-height: 3.25rem;
  margin: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  transition: background 0.15s ease;
}

.player-item:hover {
  --background: var(--ion-background-color-step-50);
}

.player-item--me {
  --background: rgba(var(--ion-color-primary-rgb), 0.08);
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.25);
}

.player-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 0;
}

/* Rank badge */
.rank-badge {
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  border-radius: 50%;
  background: var(--ion-background-color-step-100);
  color: var(--ion-color-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8rem;
}

.rank-badge--top {
  background: rgba(var(--ion-color-warning-rgb), 0.15);
  color: var(--ion-color-warning);
  font-size: 1rem;
}

/* Player info */
.player-info {
  flex: 1;
  min-width: 0;
}

.player-name-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.player-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--ion-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-name--me {
  color: var(--ion-color-primary);
}

.you-badge {
  font-size: 0.6rem;
  height: 1.1rem;
  padding: 0 6px;
}

.player-points {
  font-size: 0.78rem;
  margin-top: 1px;
}

/* Change indicator */
.player-change {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.player-change ion-icon {
  font-size: 0.85rem;
}

.player-change--up {
  color: var(--ion-color-success);
}

.player-change--down {
  color: var(--ion-color-danger);
}

/* ── Footer ────────────────────────────────────── */
.leaderboard-footer {
  padding: 0.75rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.footer-btn {
  --border-color: var(--ion-border-color);
}

.footer-divider {
  height: 1px;
  background: var(--ion-border-color);
  margin: 0.25rem 0;
}

/* ion-text-color already adapts in dark mode — no override needed */
</style>
