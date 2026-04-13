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
            {{ props.currentLeague?.icon }} {{ props.currentLeague?.title }}
          </ion-card-subtitle>
        </div>
      </div>

      <!-- League meta chips -->
      <div class="meta-chips" v-if="props.currentLeague">
        <ion-chip class="meta-chip" color="medium" outline>
          <ion-label>{{ props.currentLeague?.domain }}</ion-label>
        </ion-chip>
        <ion-chip class="meta-chip" color="medium" outline>
          <ion-label>{{ props.currentLeague?.teams.length }} players</ion-label>
        </ion-chip>
        <ion-chip class="meta-chip" color="medium" outline>
          <ion-label>Ends {{ props.currentLeague?.endDate }}</ion-label>
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
          v-for="(player, rank) in props.leaderboard"
          :key="rank"
          class="player-item"
          :class="{ 'player-item--me': isCurrentUser(player) }"
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
                  :class="{ 'player-name--me': isCurrentUser(player) }"
                >
                  {{ player.name }}
                </span>
                <ion-badge
                  v-if="isCurrentUser(player)"
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
              :class="getRankChange(player.id).cssClass"
            >
              <ion-icon :icon="getRankChange(player.id).icon" />
              <span>{{ getRankChange(player.id).label }}</span>
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
  removeOutline,
  trendingDownOutline,
  trendingUpOutline,
  trophyOutline,
} from "ionicons/icons";
import { TeamDTO } from "../../../../dto/teamDTO";
import { LeagueDTO } from "../../../../dto/leagueDTO";
import { computed } from "vue";
import { PerformanceDTO } from "../../../../dto/performanceDTO";

interface Props {
  leaderboard: TeamDTO[];
  currentLeague: LeagueDTO | null;
  currentTeam: TeamDTO | null;
  pastLeaderboard: PerformanceDTO[] | null;
  slice: number;
}

const props = defineProps<Props>();
const router = useRouter();

function isCurrentUser(t: TeamDTO): boolean {
  return t.id === props.currentTeam?.id;
}

const sliceAroundUser = computed<[number, number]>(() => {
  const entries = props.leaderboard || [];
  const idx = entries.findIndex((e) => e.id === props.currentTeam?.id);
  if (idx === -1) return [0, props.slice]; // user not found, default to top slice
  const start = Math.max(0, idx - props.slice / 2);
  const end = Math.min(entries.length, idx + props.slice / 2 + 1);
  return [start, end];
});

const previousRanks = computed(() => {
  const raw = props.pastLeaderboard ?? [];

  const grouped = raw.reduce((map, p) => {
    const group = map.get(p.teamId) ?? [];
    group.push(p);
    map.set(p.teamId, group);
    return map;
  }, new Map<string, PerformanceDTO[]>());

  const twoDaysAgoPoints = [...grouped.entries()]
    .map(([teamId, perfs]) => ({
      teamId,
      points: perfs[1]?.points ?? 0,
    }))
    .sort((a, b) => b.points - a.points);

  const previousRanks = new Map(
    twoDaysAgoPoints.map((entry, idx) => [entry.teamId, idx + 1])
  );

  return [...grouped.entries()]
    .map(([teamId, perfs]) => ({
      teamId,
      points: perfs[0]?.points ?? 0,
      previousRank: previousRanks.get(teamId) ?? null,
    }))
    .sort((a, b) => b.points - a.points)
    .map((entry, idx) => ({
      ...entry,
      rankChange:
        entry.previousRank !== null ? entry.previousRank - (idx + 1) : null,
    }));
});

function rankChangeById(id: string) {
  return (
    previousRanks.value.find((entry) => entry.teamId === id)?.rankChange ?? 0
  );
}

function getRankChange(teamId: string): {
  icon: string;
  cssClass: string;
  label: string;
} {
  const change = rankChangeById(teamId);
  if (change === null)
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

.footer-divider {
  height: 1px;
  background: var(--ion-border-color);
  margin: 0.25rem 0;
}

/* ion-text-color already adapts in dark mode — no override needed */
</style>
