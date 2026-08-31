<template>
  <div class="standings">
    <div class="standings-controls">
      <ion-searchbar
        class="search-bar"
        :placeholder="t('league.searchPlaceholder')"
        :value="search"
        :debounce="200"
        @ionInput="
          search = ($event.target as HTMLIonSearchbarElement).value ?? ''
        "
      />
    </div>

    <!-- Skeleton while the standings query is in flight -->
    <div v-if="loading" class="skeleton-list">
      <div v-for="i in SKELETON_ROWS" :key="i" class="skeleton-row">
        <ion-skeleton-text :animated="true" class="skeleton-rank" />
        <ion-skeleton-text :animated="true" class="skeleton-name" />
        <ion-skeleton-text :animated="true" class="skeleton-points" />
      </div>
    </div>

    <template v-else>
      <!-- Before the first scoring day the standings list every team in the
           league, all on zero, because this is the only screen that shows who is
           playing at all. The note says why the table is flat rather than
           leaving it to be read as a bug — and a league that has not kicked off
           yet is a different situation from one whose first day is still open. -->
      <p v-if="isUnscored" class="unscored-note">
        {{
          phase === "upcoming"
            ? t("league.notStartedNote")
            : t("league.unscoredNote")
        }}
      </p>

      <div class="standings-table">
        <!-- No `role="row"`: a row outside a table role is a claim the rest
             of this markup does not keep, and a screen reader announces the
             structure it was promised. The board is a list of buttons, and
             reads as one. Real table semantics would mean role=table/row/cell
             around interactive rows — recorded, not faked. -->
        <div class="standings-head">
          <span class="col-rank">{{ t("league.colRank") }}</span>
          <span class="col-team">{{ t("league.colTeam") }}</span>
          <span class="col-points">{{ t("league.colPoints") }}</span>
          <span class="col-trend">{{ t("league.colTrend") }}</span>
        </div>

        <!-- Every row but the viewer's own opens that team's line-up, and does
             it as a real button so the board stays keyboard-reachable. Your own
             row stays inert: your team page is where you edit the line-up, and
             routing you to the read-only copy of it would be a dead end. -->
        <component
          :is="isMine(entry) ? 'div' : 'button'"
          v-for="entry in visible"
          :key="entry.team.id"
          :type="isMine(entry) ? undefined : 'button'"
          class="standings-row"
          :class="{
            'standings-row--me': isMine(entry),
            'standings-row--link': !isMine(entry),
          }"
          @click="isMine(entry) || emit('openTeam', entry.team.id)"
        >
          <div class="col-rank">
            <span
              class="rank-badge"
              :class="{ 'rank-badge--top': isPodium(entry) }"
            >
              <span v-if="entry.rank === 1">👑</span>
              <span v-else-if="entry.rank === 2">🥈</span>
              <span v-else-if="entry.rank === 3">🥉</span>
              <span v-else>{{ entry.rank }}</span>
            </span>
          </div>

          <div class="col-team">
            <span class="team-name">{{ entry.team.name }}</span>
            <ion-badge v-if="isMine(entry)" color="primary" class="you-badge">
              {{ t("league.you") }}
            </ion-badge>
          </div>

          <div class="col-points">
            {{ formatPoints(entry.cumulativePoints) }}
          </div>

          <div class="col-trend" :class="trend(entry).cssClass">
            <ion-icon
              aria-hidden="true"
              :icon="trend(entry).icon"
              class="trend-icon"
            />
            <span class="trend-label">{{ trend(entry).label }}</span>
          </div>
        </component>

        <!-- A failed fetch is not an empty league. Saying "no teams" for a
             network error would be a claim about the league that nothing
             supports. -->
        <p v-if="!filtered.length" class="standings-empty">
          {{ emptyMessage }}
        </p>
      </div>

      <!-- Long boards reveal in chunks rather than paginating: rank order is a
           single continuous run, and page breaks turn "where am I relative to
           them" into an arithmetic problem. -->
      <ion-infinite-scroll
        :disabled="!hasMore"
        threshold="200px"
        @ionInfinite="loadMore($event)"
      >
        <ion-infinite-scroll-content
          loading-spinner="crescent"
          :loading-text="t('league.loadingMore')"
        />
      </ion-infinite-scroll>

      <p v-if="filtered.length" class="standings-count">
        {{
          t("league.showing", {
            shown: visible.length,
            total: filtered.length,
          })
        }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  IonBadge,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonSearchbar,
  IonSkeletonText,
} from "@ionic/vue";
import {
  removeOutline,
  trendingDownOutline,
  trendingUpOutline,
} from "ionicons/icons";
import { useI18n } from "vue-i18n";
import type { LeaguePhase } from "@/composables/useLeagueCalendar";
import type { LeaderboardEntryDTO } from "../../../../dto/leaderboardDTO";

const props = defineProps<{
  leaderboard: LeaderboardEntryDTO[];
  /** The viewer's team in this league, or null when they only spectate. */
  myTeamId: string | null;
  loading?: boolean;
  /** The standings query failed — distinct from a league with no teams. */
  errored?: boolean;
  /** Where the league sits in its calendar; only the pre-scoring note reads it. */
  phase?: LeaguePhase | null;
}>();

const emit = defineEmits<{
  /** A row other than the viewer's own was activated. */
  openTeam: [teamId: string];
}>();

const { t, locale } = useI18n();

/** Rows revealed per infinite-scroll batch. */
const CHUNK = 25;
const SKELETON_ROWS = 8;

const search = ref("");
const shown = ref(CHUNK);

const filtered = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase(locale.value);
  if (!needle) return props.leaderboard;
  return props.leaderboard.filter((e) =>
    e.team.name.toLocaleLowerCase(locale.value).includes(needle)
  );
});

const visible = computed(() => filtered.value.slice(0, shown.value));
const hasMore = computed(() => shown.value < filtered.value.length);

/**
 * A league whose first scoring day has not closed: teams are enrolled, none has
 * points. The board still lists them — the standings are the roster too, and
 * hiding it would leave a new league with nowhere to see who is in it.
 */
const isUnscored = computed(
  () =>
    props.leaderboard.length > 0 &&
    props.leaderboard.every((e) => e.cumulativePoints === 0)
);

const emptyMessage = computed(() => {
  if (props.errored) return t("league.boardError");
  return search.value.trim() ? t("league.noMatches") : t("league.emptyBoard");
});

// A new search starts the reveal over: a window left open from the previous
// needle would show an arbitrary prefix of the new results. Shrinking the list
// any other way needs no reset — `visible` slices, and `hasMore` follows.
watch(search, () => {
  shown.value = CHUNK;
});

function loadMore(event: CustomEvent) {
  shown.value += CHUNK;
  (event.target as HTMLIonInfiniteScrollElement).complete();
}

function isMine(entry: LeaderboardEntryDTO): boolean {
  return props.myTeamId !== null && entry.team.id === props.myTeamId;
}

function isPodium(entry: LeaderboardEntryDTO): boolean {
  return entry.rank <= 3;
}

function formatPoints(points: number): string {
  return points.toLocaleString(locale.value, { maximumFractionDigits: 1 });
}

/**
 * Rank movement since the previous scoring day. `null` means the team has no
 * scoring history yet, which is not the same as "held its place" — a dash says
 * so, an equals sign would claim a comparison that was never made.
 */
function trend(entry: LeaderboardEntryDTO): {
  icon: string;
  cssClass: string;
  label: string;
} {
  const delta = entry.rankDelta;
  if (delta == null)
    return { icon: removeOutline, cssClass: "trend--new", label: "—" };
  if (delta === 0)
    return { icon: removeOutline, cssClass: "trend--stable", label: "" };
  if (delta > 0)
    return {
      icon: trendingUpOutline,
      cssClass: "trend--up",
      label: `+${delta}`,
    };
  return {
    icon: trendingDownOutline,
    cssClass: "trend--down",
    label: `${delta}`,
  };
}

// Deliberately no auto-scroll to the viewer's own row on load: it moved the
// page out from under the reader before they had seen the top of it, which read
// as the standings stealing focus. The searchbar is the way to find yourself.
</script>

<style scoped>
.standings-controls {
  margin-bottom: 0.75rem;
}

.search-bar {
  --border-radius: 8px;
  --color: var(--ion-text-color);
  --placeholder-color: var(--ion-color-medium);
  --placeholder-opacity: 1;
  --icon-color: var(--ion-color-medium);
  --box-shadow: none;
  padding: 0;
}

.search-bar :deep(.searchbar-input-container) {
  border: 1.5px solid var(--ion-color-primary);
  border-radius: 8px;
}

/* ── Table ─────────────────────────────────────── */
.standings-table {
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--ion-card-background, var(--ion-background-color));
}

.standings-head,
.standings-row {
  display: grid;
  grid-template-columns: 3.25rem minmax(0, 1fr) auto 3.5rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
}

.standings-head {
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
  border-bottom: 1px solid var(--ion-border-color);
}

.standings-row {
  border-bottom: 1px solid var(--ion-border-color);
}

.standings-row:last-of-type {
  border-bottom: none;
}

.standings-row--me {
  background: rgba(var(--ion-color-primary-rgb), 0.08);
}

/* Rows that navigate are <button>: strip the UA chrome so they stay visually
   identical to the inert one, and keep the grid the row layout depends on. */
.standings-row--link {
  width: 100%;
  border-left: none;
  border-right: none;
  border-top: none;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.standings-row--link:hover {
  background: var(--ion-background-color-step-50);
}

.standings-row--link:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: -2px;
}

.col-points,
.standings-head .col-points {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.standings-head .col-points,
.standings-head .col-trend {
  font-weight: 600;
}

.col-trend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.rank-badge {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--ion-background-color-step-100);
  color: var(--ion-color-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.rank-badge--top {
  background: rgba(var(--ion-color-warning-rgb), 0.15);
  color: var(--ion-color-warning);
  font-size: 1rem;
}

.col-team {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}

.team-name {
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The shade, not the base green: this row's background is that same green at
   8%, and the base against it reads 4.38:1 — just under WCAG 1.4.3. */
.standings-row--me .team-name {
  color: var(--ion-color-primary-shade);
}

.you-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  height: 1.1rem;
  /* Same optical correction as the dashboard's leaderboard badge: the labels
     have no descender, so centring the font box leaves the text visibly high. */
  padding: 0.25em 6px 0;
  line-height: 1;
}

.trend-icon {
  font-size: 0.85rem;
}

.trend--up {
  color: var(--ion-color-success);
}
.trend--down {
  color: var(--ion-color-danger);
}
.trend--stable,
.trend--new {
  color: var(--ion-color-medium);
}

/* Column labels are the only thing worth dropping on a narrow screen — the
   four columns themselves all still fit. */
@media (max-width: 480px) {
  .standings-head .col-trend {
    display: none;
  }
}

/* ── States ────────────────────────────────────── */
.standings-empty {
  text-align: center;
  padding: 2.5rem 1rem;
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}

.unscored-note {
  margin: 0 0 0.625rem;
  font-size: 0.78rem;
  color: var(--ion-color-medium);
}

.standings-count {
  margin: 0.75rem 0 0;
  font-size: 12px;
  color: var(--ion-color-medium);
  text-align: right;
}

.skeleton-list {
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-row {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr) 4rem;
  align-items: center;
  gap: 0.75rem;
}

.skeleton-rank {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  margin: 0;
}

.skeleton-name {
  height: 0.9rem;
  border-radius: 4px;
  margin: 0;
}

.skeleton-points {
  height: 0.9rem;
  border-radius: 4px;
  margin: 0;
}
</style>
