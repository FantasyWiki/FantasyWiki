<template>
  <ion-card class="leaderboard-card td-card">
    <!-- ── Header ───────────────────────────────── -->
    <ion-card-header>
      <div class="leaderboard-header td-header-left">
        <div class="header-icon-wrapper td-header-icon td-header-icon--warning">
          <ion-icon aria-hidden="true" :icon="trophyOutline" color="warning" />
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
      <!-- Skeleton while the standings query is in flight -->
      <div v-if="props.loading" class="skeleton-list">
        <div v-for="i in props.slice" :key="i" class="skeleton-item">
          <ion-skeleton-text :animated="true" class="skeleton-rank" />
          <div class="skeleton-info">
            <ion-skeleton-text :animated="true" class="skeleton-name" />
            <ion-skeleton-text :animated="true" class="skeleton-pts" />
          </div>
          <ion-skeleton-text :animated="true" class="skeleton-change" />
        </div>
      </div>

      <!-- Settled and still empty: nobody has been scored yet -->
      <div v-else-if="props.leaderboard.length === 0" class="leaderboard-empty">
        <ion-text color="medium">
          <p class="ion-no-margin">{{ $t("dashboard.leaderboard.empty") }}</p>
        </ion-text>
      </div>

      <ion-list v-else lines="none" class="player-list">
        <template
          v-for="row in rows"
          :key="row.kind === 'gap' ? 'gap' : row.entry.team.id"
        >
          <!-- Ranks skipped between the pinned leader and the window -->
          <div
            v-if="row.kind === 'gap'"
            class="rank-gap"
            role="separator"
            :aria-label="$t('dashboard.leaderboard.gap')"
          >
            <span class="rank-gap-dots"> <i></i><i></i><i></i> </span>
          </div>

          <ion-item
            v-else
            class="player-item"
            :class="{ 'player-item--me': isCurrentUser(row.entry) }"
            :detail="false"
          >
            <div class="player-row">
              <!-- Rank badge -->
              <div
                class="rank-badge"
                :class="{ 'rank-badge--top': row.entry.rank <= 3 }"
              >
                <span v-if="row.entry.rank === 1">👑</span>
                <span v-else-if="row.entry.rank === 2">🥈</span>
                <span v-else-if="row.entry.rank === 3">🥉</span>
                <span v-else>{{ row.entry.rank }}</span>
              </div>

              <!-- Player info -->
              <div class="player-info">
                <div class="player-name-row">
                  <span
                    class="player-name"
                    :class="{ 'player-name--me': isCurrentUser(row.entry) }"
                  >
                    {{ row.entry.team.name }}
                  </span>
                  <ion-badge
                    v-if="isCurrentUser(row.entry)"
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
                        points: row.entry.cumulativePoints.toLocaleString(),
                      })
                    }}
                  </p>
                </ion-text>
              </div>

              <!-- Change indicator -->
              <div
                class="player-change"
                :class="getRankChange(row.entry).cssClass"
              >
                <ion-icon
                  aria-hidden="true"
                  class="player-change-icon"
                  :icon="getRankChange(row.entry).icon"
                />
                <span>{{ getRankChange(row.entry).label }}</span>
              </div>
            </div>
          </ion-item>
        </template>
      </ion-list>

      <!-- ── Footer Actions ─────────────────────── -->
      <div class="leaderboard-footer">
        <ion-button
          expand="block"
          fill="outline"
          class="footer-btn"
          :disabled="!props.currentLeague"
          @click="openLeaguePage()"
        >
          {{ $t("dashboard.leaderboard.viewDetails") }}
          <ion-icon
            aria-hidden="true"
            slot="end"
            :icon="chevronForwardOutline"
          />
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
  loading?: boolean;
}

/** A rendered line of the card: a team, or the marker for skipped ranks. */
type Row = { kind: "entry"; entry: LeaderboardEntryDTO } | { kind: "gap" };

const props = defineProps<Props>();
const router = useRouter();

const { locale } = useI18n();

function isCurrentUser(entry: LeaderboardEntryDTO): boolean {
  return entry.team.id === props.currentTeam?.id;
}

/**
 * The card is a window onto the standings; the league's own page carries the
 * whole table. Named-route push so the id lives in one place — the card renders
 * before the league resolves, hence the guarded button.
 */
function openLeaguePage() {
  if (!props.currentLeague) return;
  router.push({
    name: "League",
    params: { leagueId: props.currentLeague.id },
  });
}

/**
 * Bounds of the `slice` entries centred on the current team, always full-width
 * when the league is big enough: clamping at either end shifts the window
 * instead of truncating it, so a team sitting 1st or last still sees `slice`
 * rivals.
 */
const windowRange = computed<[number, number]>(() => {
  const entries = props.leaderboard ?? [];
  const idx = entries.findIndex((e) => e.team.id === props.currentTeam?.id);
  // User not found, default to the top slice.
  if (idx === -1) return [0, Math.min(entries.length, props.slice)];

  const half = Math.floor(props.slice / 2);
  const end = Math.min(entries.length, Math.max(0, idx - half) + props.slice);
  return [Math.max(0, end - props.slice), end];
});

/**
 * The window, with the league leader pinned on top once the window has moved
 * past them — a standings card that omits 1st place reads as broken. The gap
 * marker goes in only when ranks are actually skipped: a window starting at
 * rank 2 already runs on from the pinned leader.
 *
 * A viewer sitting 1st forces `start === 0`, so the pinned row can never
 * duplicate a row already in the window.
 */
const rows = computed<Row[]>(() => {
  const entries = props.leaderboard ?? [];
  const [start, end] = windowRange.value;
  const windowRows: Row[] = entries
    .slice(start, end)
    .map((entry) => ({ kind: "entry", entry }));

  if (start === 0) return windowRows;

  return [
    { kind: "entry", entry: entries[0] },
    ...(start > 1 ? [{ kind: "gap" } as Row] : []),
    ...windowRows,
  ];
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

/* ── Empty state ───────────────────────────────── */
.leaderboard-empty {
  padding: 1.25rem 1rem;
  text-align: center;
  font-size: 0.8rem;
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

/* Skipped-ranks marker — dots sit in the rank-badge column, so the break in
   the numbering reads as deliberate rather than as a missing row. */
.rank-gap {
  display: flex;
  align-items: center;
  margin: 0 0.5rem;
  padding: 0.25rem 1rem;
}

.rank-gap-dots {
  width: 2.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.rank-gap-dots i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--ion-color-medium);
  opacity: 0.45;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
