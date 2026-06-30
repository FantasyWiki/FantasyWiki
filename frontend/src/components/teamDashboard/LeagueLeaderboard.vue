<template>
  <ion-card class="leaderboard-card td-card">
    <!-- ── Header ───────────────────────────────── -->
    <ion-card-header>
      <div class="leaderboard-header td-header-left">
        <div class="header-icon-wrapper td-header-icon td-header-icon--warning">
          <ion-icon :icon="trophyOutline" color="warning" />
        </div>
        <div class="header-text">
          <ion-card-title class="td-card-title">{{
            $t("dashboard.leaderboard.title")
          }}</ion-card-title>
          <ion-card-subtitle v-if="props.currentLeague">
            {{ props.currentLeague?.icon }} {{ props.currentLeague?.title }}
          </ion-card-subtitle>
        </div>
      </div>

      <!-- League meta chips -->
      <div class="meta-chips" v-if="props.currentLeague">
        <ion-chip
          class="meta-chip"
          color="medium"
          outline
          :disabled="true"
          style="opacity: 1"
        >
          <ion-label>{{ props.currentLeague?.domain.toUpperCase() }}</ion-label>
        </ion-chip>
        <ion-chip
          class="meta-chip"
          color="medium"
          outline
          :disabled="true"
          style="opacity: 1"
        >
          <ion-label>{{
            $t("dashboard.leaderboard.players", {
              count: props.leaderboard.length,
            })
          }}</ion-label>
        </ion-chip>
        <ion-chip
          class="meta-chip"
          color="medium"
          outline
          :disabled="true"
          style="opacity: 1"
        >
          <ion-label>{{
            $t("dashboard.leaderboard.ends", {
              date: props.currentLeague?.endDate.toLocaleString(locale, {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            })
          }}</ion-label>
        </ion-chip>
      </div>
    </ion-card-header>

    <!-- ── List ─────────────────────────────────── -->
    <ion-card-content class="ion-no-padding">
      <!-- Skeleton when loading -->
      <div v-if="props.leaderboard.length === 0" class="skeleton-list">
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
          v-for="(entry, rank) in props.leaderboard"
          :key="rank"
          class="player-item"
          :class="{ 'player-item--me': isCurrentUser(entry) }"
          :detail="false"
        >
          <div
            class="player-row"
            v-if="rank >= sliceAroundUser[0] && rank < sliceAroundUser[1]"
          >
            <!-- Rank badge -->
            <div
              class="rank-badge"
              :class="{ 'rank-badge--top': rank + 1 <= 3 }"
            >
              <span v-if="rank + 1 === 1">👑</span>
              <span v-else-if="rank + 1 === 2">🥈</span>
              <span v-else-if="rank + 1 === 3">🥉</span>
              <span v-else>{{ rank + 1 }}</span>
            </div>

            <!-- Player info -->
            <div class="player-info">
              <div class="player-name-row">
                <span
                  class="player-name"
                  :class="{ 'player-name--me': isCurrentUser(entry) }"
                >
                  {{ entry.team.name }}
                </span>
                <ion-badge
                  v-if="isCurrentUser(entry)"
                  color="primary"
                  class="you-badge"
                >
                  {{ $t("dashboard.leaderboard.you") }}
                </ion-badge>
              </div>
              <ion-text color="medium">
                <p class="player-points ion-no-margin">
                  {{
                    $t("dashboard.leaderboard.points", {
                      points: entry.cumulativePoints.toLocaleString(),
                    })
                  }}
                </p>
              </ion-text>
            </div>

            <!-- Change indicator -->
            <div class="player-change" :class="getRankChange(entry).cssClass">
              <ion-icon
                class="player-change-icon"
                :icon="getRankChange(entry).icon"
              />
              <span>{{ getRankChange(entry).label }}</span>
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
          {{ $t("dashboard.leaderboard.viewDetails") }}
          <ion-icon slot="end" :icon="chevronForwardOutline" />
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
  removeOutline,
  trendingDownOutline,
  trendingUpOutline,
  trophyOutline,
} from "ionicons/icons";
import { TeamDTO } from "../../../../dto/teamDTO";
import { LeagueDTO } from "../../../../dto/leagueDTO";
import { LeaderboardEntryDTO } from "../../../../dto/leaderboardDTO";
import { computed } from "vue";

import { useI18n } from "vue-i18n";

interface Props {
  leaderboard: LeaderboardEntryDTO[];
  currentLeague: LeagueDTO | null;
  currentTeam: TeamDTO | null;
  slice: number;
}

const props = defineProps<Props>();
const router = useRouter();

const { locale } = useI18n();

function isCurrentUser(entry: LeaderboardEntryDTO): boolean {
  return entry.team.id === props.currentTeam?.id;
}

const sliceAroundUser = computed<[number, number]>(() => {
  const entries = props.leaderboard || [];
  const idx = entries.findIndex((e) => e.team.id === props.currentTeam?.id);
  if (idx === -1) return [0, props.slice]; // user not found, default to top slice
  const start = Math.max(0, idx - props.slice / 2);
  const end = Math.min(entries.length, idx + props.slice / 2 + 1);
  return [start, end];
});

function getRankChange(entry: LeaderboardEntryDTO): {
  icon: string;
  cssClass: string;
  label: string;
} {
  const change = entry.rankDelta;
  if (change == null)
    return { icon: removeOutline, cssClass: "player-change--new", label: "—" };
  if (change === 0)
    return {
      icon: removeOutline,
      cssClass: "player-change--stable",
      label: "",
    };
  if (change > 0)
    return {
      icon: trendingUpOutline,
      cssClass: "player-change--up",
      label: `+${change}`,
    };
  return {
    icon: trendingDownOutline,
    cssClass: "player-change--down",
    label: `${change}`,
  };
}
</script>

<style scoped src="src/components/teamDashboard/team-dashboard.css"></style>

<style scoped>
/* ── Header ────────────────────────────────────── */
.leaderboard-header {
  margin-bottom: 0.75rem;
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

.player-change-icon {
  font-size: 0.85rem;
}

.player-change--up {
  color: var(--ion-color-success);
}
.player-change--down {
  color: var(--ion-color-danger);
}
.player-change--stable {
  color: var(--ion-color-medium);
}
.player-change--new {
  color: var(--ion-color-medium);
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

/* ion-text-color already adapts in dark mode — no override needed */
</style>
