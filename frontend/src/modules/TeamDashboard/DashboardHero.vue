<template>
  <div class="hero-wrapper">
    <div class="hero-bg-decoration" aria-hidden="true" />

    <ion-grid class="hero-grid ion-no-padding">
      <ion-row class="ion-align-items-center">
        <!-- ── Left: identity + actions ─────────────── -->
        <ion-col size="12" size-md="6">
          <div class="hero-left">
            <!-- League chip -->
            <ion-chip
              v-if="currentLeague"
              class="league-chip"
              color="primary"
              outline
            >
              <span class="league-icon">{{ currentLeague.icon }}</span>
              <ion-label>{{ currentLeague.name }}</ion-label>
              <ion-badge
                v-if="currentLeague.season"
                color="primary"
                class="season-badge"
              >
                {{ currentLeague.season }}
              </ion-badge>
            </ion-chip>

            <!-- Greeting + team name -->
            <div class="hero-heading">
              <ion-text color="medium">
                <p class="greeting-text ion-no-margin">Welcome back</p>
              </ion-text>
              <h1 class="team-name ion-no-margin">
                {{ currentTeam?.name ?? "Your Team" }}
              </h1>
            </div>

            <!-- Rank pill — rank only -->
            <div class="rank-pill" v-if="summary">
              <ion-icon :icon="trophyOutline" color="warning" />
              <span class="rank-value">#{{ summary.rank }}</span>
              <span class="rank-label">of {{ summary.totalPlayers }}</span>
            </div>

            <!-- Actions: Buy Articles + inbox bell only (no leaderboard button) -->
            <div class="hero-actions">
              <ion-button
                color="primary"
                fill="solid"
                @click="router.push('/market')"
              >
                <ion-icon slot="start" :icon="cartOutline" />
                Buy Articles
              </ion-button>

              <div class="bell-wrapper">
                <ion-button
                  fill="outline"
                  color="primary"
                  class="bell-icon-btn"
                  :aria-label="`Inbox – ${totalBadgeCount} pending`"
                  @click="inboxOpen = true"
                >
                  <ion-icon :icon="notificationsOutline" slot="icon-only" />
                </ion-button>
                <ion-badge
                  v-if="totalBadgeCount > 0"
                  color="danger"
                  class="bell-badge"
                >
                  {{ totalBadgeCount > 9 ? "9+" : totalBadgeCount }}
                </ion-badge>
              </div>
            </div>
          </div>
        </ion-col>

        <!-- ── Right: rotating featured card + small stats ── -->
        <ion-col size="12" size-md="6">
          <div class="right-column">
            <!-- Featured card — the active stat is shown large -->
            <div class="featured-card-wrapper" v-if="summary">
              <ion-card class="featured-card" @click="advance">
                <ion-card-content class="featured-content">
                  <!-- Icon -->
                  <div
                    class="featured-icon-wrap"
                    :style="{
                      background: activeStatDef.iconBg,
                      color: activeStatDef.iconColor,
                    }"
                  >
                    <ion-icon :icon="activeStatDef.icon" />
                  </div>

                  <!-- Label + value -->
                  <div class="featured-body">
                    <ion-text color="medium">
                      <p class="featured-label ion-no-margin">
                        {{ activeStatDef.label }}
                      </p>
                    </ion-text>
                    <div class="featured-value-row">
                      <span class="featured-value">{{
                        activeStatDef.value
                      }}</span>
                      <!-- Trend chip — only on the points card -->
                      <ion-chip
                        v-if="activeStatDef.trend !== undefined"
                        :color="activeStatDef.trend >= 0 ? 'success' : 'danger'"
                        class="trend-chip"
                        outline
                      >
                        <ion-icon
                          :icon="
                            activeStatDef.trend >= 0
                              ? trendingUpOutline
                              : trendingDownOutline
                          "
                        />
                        <ion-label>
                          {{ activeStatDef.trend >= 0 ? "+" : ""
                          }}{{ activeStatDef.trend }}%
                        </ion-label>
                      </ion-chip>
                    </div>
                    <p
                      v-if="activeStatDef.sub"
                      class="featured-sub ion-no-margin"
                    >
                      {{ activeStatDef.sub }}
                    </p>
                  </div>

                  <!-- Dot indicators -->
                  <div class="carousel-dots">
                    <button
                      v-for="(_, i) in allStats"
                      :key="i"
                      class="dot"
                      :class="{ 'dot--active': activeIndex === i }"
                      :aria-label="`Show stat ${i + 1}`"
                      @click.stop="goTo(i)"
                    />
                  </div>
                </ion-card-content>
              </ion-card>
            </div>

            <!-- Skeleton for featured card -->
            <ion-card v-else class="featured-card featured-card--skeleton">
              <ion-card-content>
                <ion-skeleton-text
                  :animated="true"
                  style="height: 88px; border-radius: 8px"
                />
              </ion-card-content>
            </ion-card>

            <!-- Small stats row: always shows the 3 non-active stats -->
            <div class="small-stats" v-if="summary">
              <div
                v-for="stat in secondaryStats"
                :key="stat.label"
                class="small-stat"
                @click="goToLabel(stat.label)"
              >
                <div
                  class="small-stat__icon"
                  :style="{ background: stat.iconBg, color: stat.iconColor }"
                >
                  <ion-icon :icon="stat.icon" />
                </div>
                <div class="small-stat__text">
                  <p class="small-stat__label ion-no-margin">
                    {{ stat.label }}
                  </p>
                  <p class="small-stat__value ion-no-margin">
                    {{ stat.value }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Skeleton for small stats -->
            <div class="small-stats" v-else>
              <div v-for="i in 3" :key="i" class="small-stat">
                <ion-skeleton-text
                  :animated="true"
                  class="small-stat__skeleton-icon"
                />
                <div class="small-stat__text">
                  <ion-skeleton-text
                    :animated="true"
                    class="small-stat__skeleton-lbl"
                  />
                  <ion-skeleton-text
                    :animated="true"
                    class="small-stat__skeleton-val"
                  />
                </div>
              </div>
            </div>
          </div>
        </ion-col>
      </ion-row>
    </ion-grid>
  </div>

  <!-- ── Inbox popover ──────────────────────────── -->
  <ion-popover
    :is-open="inboxOpen"
    @did-dismiss="inboxOpen = false"
    class="inbox-popover"
    side="bottom"
    alignment="start"
    :show-backdrop="true"
  >
    <ion-content class="ion-no-padding">
      <div class="inbox-header">
        <span class="inbox-title">Trade Inbox</span>
        <ion-badge v-if="pendingCount > 0" color="danger">{{
          pendingCount
        }}</ion-badge>
        <ion-chip
          v-if="currentLeague"
          color="primary"
          outline
          class="inbox-league-chip"
        >
          <ion-label
            >{{ currentLeague.icon }} {{ currentLeague.name }}</ion-label
          >
        </ion-chip>
        <ion-button fill="clear" size="small" @click="inboxOpen = false">
          <ion-icon :icon="closeOutline" slot="icon-only" />
        </ion-button>
      </div>

      <div v-if="isTradesLoading" class="inbox-loading">
        <ion-spinner name="crescent" color="primary" />
      </div>

      <div v-else-if="incomingPending.length === 0" class="inbox-empty">
        <ion-icon :icon="mailOpenOutline" color="medium" />
        <ion-text color="medium">
          <p class="ion-no-margin">No pending proposals</p>
        </ion-text>
      </div>

      <ion-list v-else lines="full" class="inbox-list">
        <ion-item
          v-for="proposal in incomingPending"
          :key="proposal.id"
          class="inbox-item"
          :detail="false"
        >
          <div class="proposal-row">
            <div class="proposal-avatar">{{ currentLeague?.icon ?? "🌐" }}</div>
            <div class="proposal-info">
              <p class="ion-no-margin proposal-from">
                <strong>{{ proposal.fromUsername }}</strong>
              </p>
              <p class="ion-no-margin proposal-detail">
                Wants:
                <span class="highlight">{{
                  proposal.requestedArticle.name
                }}</span>
              </p>
              <p class="ion-no-margin proposal-offer">
                Offers:
                <span v-if="proposal.offeredArticle" class="highlight">
                  {{ proposal.offeredArticle.name }}
                </span>
                <span v-if="proposal.offeredCredits" class="highlight">
                  {{ proposal.offeredCredits }} credits
                </span>
              </p>
            </div>
            <div class="proposal-actions">
              <ion-button
                fill="solid"
                color="primary"
                size="small"
                :disabled="isActioning"
                @click="handleAccept(proposal.id)"
              >
                <ion-icon :icon="checkmarkOutline" slot="icon-only" />
              </ion-button>
              <ion-button
                fill="outline"
                color="danger"
                size="small"
                :disabled="isActioning"
                @click="handleReject(proposal.id)"
              >
                <ion-icon :icon="closeOutline" slot="icon-only" />
              </ion-button>
            </div>
          </div>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-popover>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonRow,
  IonSkeletonText,
  IonSpinner,
  IonText,
} from "@ionic/vue";
import {
  cartOutline,
  cashOutline,
  checkmarkOutline,
  closeOutline,
  documentTextOutline,
  mailOpenOutline,
  notificationsOutline,
  trendingDownOutline,
  trendingUpOutline,
  trophyOutline,
} from "ionicons/icons";
import { useTrades } from "@/stores/useTrades";
import { useNotifications } from "@/stores/useNotifications";
import type { DashboardSummary, League, Team } from "@/types/models";

// ── Props ─────────────────────────────────────────
interface Props {
  currentLeague: League | null;
  currentTeam: Team | null;
  summary: DashboardSummary | null;
}

const props = defineProps<Props>();
const router = useRouter();

// ── Trades + notifications ────────────────────────
const {
  incomingPending,
  pendingCount,
  isLoading: isTradesLoading,
  isActioning,
  accept,
  reject,
} = useTrades();

const { currentLeagueUnreadCount } = useNotifications();

// Badge shows unread notifications for the current league only.
// This matches what the inbox popover shows — league-scoped activity.
const totalBadgeCount = computed(() => currentLeagueUnreadCount.value);

// ── Inbox ─────────────────────────────────────────
const inboxOpen = ref(false);

async function handleAccept(id: string) {
  await accept(id);
  if (pendingCount.value === 0) inboxOpen.value = false;
}

async function handleReject(id: string) {
  await reject(id);
  if (pendingCount.value === 0) inboxOpen.value = false;
}

// ── Stat definitions ──────────────────────────────
// All 4 stats as a flat array. The carousel picks one as "featured";
// the remaining 3 are rendered in the small row below.

interface StatDef {
  label: string;
  value: string | number;
  sub?: string | null;
  trend?: number; // only present on the points card
  icon: string;
  iconBg: string;
  iconColor: string;
}

const allStats = computed<StatDef[]>(() => {
  const s = props.summary;
  if (!s) return [];
  return [
    {
      label: "Yesterday's Points",
      value: s.yesterdayPoints,
      sub: null,
      trend: s.pointsChange,
      icon: trendingUpOutline,
      iconBg: "rgba(var(--ion-color-primary-rgb), 0.12)",
      iconColor: "var(--ion-color-primary)",
    },
    {
      label: "Credits",
      value: s.credits,
      sub: `Portfolio: ${s.portfolioValue} Cr`,
      icon: cashOutline,
      iconBg: "rgba(var(--ion-color-primary-rgb), 0.12)",
      iconColor: "var(--ion-color-primary)",
    },
    {
      label: "Contracts",
      value: `${s.activeContracts}/${s.maxContracts}`,
      sub: `${s.maxContracts - s.activeContracts} slots free`,
      icon: documentTextOutline,
      iconBg: "rgba(var(--ion-color-secondary-rgb), 0.25)",
      iconColor: "var(--ion-color-secondary-shade)",
    },
    {
      label: "Standing",
      value: `#${s.rank}`,
      sub: `of ${s.totalPlayers} players`,
      icon: trophyOutline,
      iconBg: "rgba(var(--ion-color-warning-rgb), 0.15)",
      iconColor: "var(--ion-color-warning)",
    },
  ];
});

// ── Carousel state ────────────────────────────────
const INTERVAL_MS = 3500;
const activeIndex = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

/** The currently featured stat. */
const activeStatDef = computed(
  () => allStats.value[activeIndex.value] ?? allStats.value[0]
);

/** The 3 stats that are not currently featured, shown small below. */
const secondaryStats = computed(() =>
  allStats.value.filter((_, i) => i !== activeIndex.value)
);

function advance() {
  if (!allStats.value.length) return;
  activeIndex.value = (activeIndex.value + 1) % allStats.value.length;
}

function goTo(i: number) {
  activeIndex.value = i;
  restartTimer();
}

function goToLabel(label: string) {
  const i = allStats.value.findIndex((s) => s.label === label);
  if (i !== -1) goTo(i);
}

function startTimer() {
  timer = setInterval(advance, INTERVAL_MS);
}

function restartTimer() {
  if (timer) clearInterval(timer);
  startTimer();
}

onMounted(startTimer);
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
/* ── Hero wrapper ────────────────────────────── */
.hero-wrapper {
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  background: linear-gradient(
    135deg,
    rgba(var(--ion-color-primary-rgb), 0.06) 0%,
    rgba(var(--ion-color-tertiary-rgb), 0.08) 100%
  );
  border: 1px solid var(--ion-border-color);
}

.hero-bg-decoration {
  position: absolute;
  top: -60px;
  right: -60px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(var(--ion-color-primary-rgb), 0.12) 0%,
    transparent 70%
  );
  pointer-events: none;
}

.hero-grid {
  position: relative;
  z-index: 1;
}

/* ── Left column ─────────────────────────────── */
.hero-left {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.league-chip {
  align-self: flex-start;
  --background: rgba(var(--ion-color-primary-rgb), 0.08);
  font-size: 0.8rem;
  height: 2rem;
}

.league-icon {
  margin-right: 4px;
  font-size: 1rem;
}
.season-badge {
  margin-left: 4px;
  font-size: 0.65rem;
}
.greeting-text {
  font-size: 0.875rem;
  letter-spacing: 0.02em;
}

.team-name {
  font-family: var(--font-family-headings);
  font-size: clamp(1.5rem, 5vw, 2.25rem);
  font-weight: 700;
  color: var(--ion-text-color);
  line-height: 1.1;
}

/* Rank pill */
.rank-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  border-radius: 999px;
  padding: 0.4rem 1rem;
  width: fit-content;
}

.rank-pill ion-icon {
  font-size: 1rem;
}

.rank-value {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--ion-text-color);
}

.rank-label {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

/* Actions */
.hero-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.hero-actions ion-button {
  --border-radius: 0.5rem;
}

/* Bell */
.bell-wrapper {
  position: relative;
  display: inline-flex;
}

.bell-icon-btn {
  --border-radius: 0.5rem;
  --padding-start: 0.75rem;
  --padding-end: 0.75rem;
}

.bell-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 0.6rem;
  min-width: 1.1rem;
  height: 1.1rem;
  border-radius: 999px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
}

/* ── Right column ────────────────────────────── */
.right-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  /* space from left col on mobile */
  margin-top: 1.25rem;
}

@media (min-width: 768px) {
  .right-column {
    margin-top: 0;
  }
}

/* ── Featured card ───────────────────────────── */
.featured-card-wrapper {
  position: relative;
}

.featured-card {
  --background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  border-radius: 0.875rem;
  box-shadow: 0 2px 12px var(--ion-box-shadow-color);
  margin: 0;
  cursor: pointer;
  transition: box-shadow 0.2s ease;
}

.featured-card:hover {
  box-shadow: 0 4px 20px var(--ion-box-shadow-color);
}

.featured-card--skeleton {
  cursor: default;
}

.featured-content {
  padding: 1rem 1rem 0.75rem !important;
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
}

.featured-icon-wrap {
  width: 3rem;
  height: 3rem;
  min-width: 3rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.35s ease;
}

.featured-icon-wrap ion-icon {
  font-size: 1.4rem;
}

.featured-body {
  flex: 1;
  min-width: 0;
}

.featured-label {
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}

.featured-value-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.featured-value {
  font-family: var(--font-family-headings);
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--ion-text-color);
  line-height: 1;
  transition: color 0.35s ease;
}

.featured-sub {
  font-size: 0.72rem;
  color: var(--ion-color-medium);
  margin-top: 3px;
}

.trend-chip {
  height: 1.5rem;
  font-size: 0.72rem;
  --background: transparent;
  flex-shrink: 0;
}

/* Dot indicators — sit inside the card at the bottom */
.carousel-dots {
  display: flex;
  justify-content: flex-end;
  gap: 0.375rem;
  padding-top: 0.5rem;
  /* span full width so they sit at the right edge */
  grid-column: 1 / -1;
  width: 100%;
}

/* rearrange featured-content to a grid so dots span the bottom */
.featured-content {
  display: grid;
  grid-template-columns: 3rem 1fr;
  grid-template-rows: auto auto;
  column-gap: 0.875rem;
  row-gap: 0.5rem;
  align-items: start;
}

.featured-icon-wrap {
  grid-row: 1;
  grid-column: 1;
}
.featured-body {
  grid-row: 1;
  grid-column: 2;
}
.carousel-dots {
  grid-row: 2;
  grid-column: 1 / -1;
}

.dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--ion-border-color);
  border: none;
  cursor: pointer;
  padding: 0;
  transition:
    background 0.25s ease,
    transform 0.25s ease;
}

.dot--active {
  background: var(--ion-color-primary);
  transform: scale(1.4);
}

/* ── Small stats row ─────────────────────────── */
.small-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.small-stat {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  border-radius: 0.75rem;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  min-width: 0;
  overflow: hidden;
}

.small-stat:hover {
  border-color: rgba(var(--ion-color-primary-rgb), 0.4);
  box-shadow: 0 2px 8px var(--ion-box-shadow-color);
}

.small-stat__icon {
  width: 1.75rem;
  height: 1.75rem;
  min-width: 1.75rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.35s ease;
}

.small-stat__icon ion-icon {
  font-size: 0.9rem;
}

.small-stat__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.small-stat__label {
  font-size: 0.6rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ion-color-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.small-stat__value {
  font-family: var(--font-family-headings);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ion-text-color);
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* On very small screens (< 380px) reduce padding further */
@media (max-width: 380px) {
  .small-stats {
    gap: 0.375rem;
  }
  .small-stat {
    padding: 0.4rem;
    gap: 0.375rem;
  }
  .small-stat__icon {
    width: 1.5rem;
    height: 1.5rem;
    min-width: 1.5rem;
  }
  .small-stat__icon ion-icon {
    font-size: 0.8rem;
  }
  .small-stat__value {
    font-size: 0.8rem;
  }
  .small-stat__label {
    font-size: 0.55rem;
  }
}

/* Skeletons for small stats */
.small-stat__skeleton-icon {
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  border-radius: 0.5rem;
}

.small-stat__skeleton-lbl {
  width: 70%;
  height: 0.65rem;
  border-radius: 4px;
}

.small-stat__skeleton-val {
  width: 50%;
  height: 1rem;
  border-radius: 4px;
}

/* ── Inbox popover ───────────────────────────── */
.inbox-popover {
  --width: min(400px, 95vw);
  --border-radius: 0.875rem;
  --box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.inbox-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem 0.75rem;
  border-bottom: 1px solid var(--ion-border-color);
  flex-wrap: wrap;
}

.inbox-title {
  font-weight: 700;
  font-size: 1rem;
  color: var(--ion-text-color);
  flex: 1;
}

.inbox-league-chip {
  height: 1.4rem;
  font-size: 0.7rem;
  margin: 0;
}

.inbox-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.inbox-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
}

.inbox-empty ion-icon {
  font-size: 2.5rem;
}

.inbox-list {
  padding: 0;
  margin: 0;
  max-height: 360px;
  overflow-y: auto;
}

.inbox-item {
  --padding-start: 1rem;
  --padding-end: 1rem;
  --inner-padding-end: 0;
  --min-height: 0;
}

.proposal-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 0;
}

.proposal-avatar {
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  border-radius: 50%;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
}

.proposal-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.proposal-from {
  font-size: 0.85rem;
}
.proposal-detail,
.proposal-offer {
  font-size: 0.78rem;
  color: var(--ion-color-medium);
}
.highlight {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.proposal-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
}
.proposal-actions ion-button {
  --border-radius: 0.375rem;
  width: 2rem;
  height: 2rem;
  margin: 0;
}

/* ── Dark mode ───────────────────────────────── */
.ion-palette-dark .hero-wrapper {
  background: linear-gradient(
    135deg,
    rgba(var(--ion-color-primary-rgb), 0.1) 0%,
    rgba(var(--ion-color-tertiary-rgb), 0.05) 100%
  );
}

.ion-palette-dark .team-name,
.ion-palette-dark .rank-value,
.ion-palette-dark .featured-value,
.ion-palette-dark .small-stat__value,
.ion-palette-dark .inbox-title {
  color: var(--ion-color-light);
}
</style>
