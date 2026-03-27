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

            <!-- Actions: Buy Articles + inbox bell -->
            <div class="hero-actions">
              <ion-button
                color="primary"
                fill="solid"
                @click="router.push('/market')"
              >
                <ion-icon slot="start" :icon="cartOutline" />
                Buy Articles
              </ion-button>

              <inbox
                ref="inboxRef"
                :pending-trades="incomingPending"
                :outgoing-count="outgoingCount"
                :is-loading="isTradesLoading"
                :is-actioning="isActioning"
                @accept="handleAccept"
                @reject="handleReject"
               />
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
                      v-for="(i) in allStats.length"
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
  IonGrid,
  IonIcon,
  IonLabel,
  IonRow,
  IonSkeletonText,
  IonText,
} from "@ionic/vue";
import {
  cartOutline,
  cashOutline,
  documentTextOutline,
  trendingDownOutline,
  trendingUpOutline,
  trophyOutline,
} from "ionicons/icons";
import Inbox from "@/modules/Inbox.vue";
import { useTrades } from "@/stores/useTrades";
import { useNotifications } from "@/stores/useNotifications";
import type { DashboardSummary, League, Team } from "@/types/models";

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  currentLeague: League | null;
  currentTeam: Team | null;
  summary: DashboardSummary | null;
}

const props = defineProps<Props>();
const router = useRouter();

// ── Trades + notifications ────────────────────────────────────────────────────
const {
  incomingPending,
  proposals,
  isLoading: isTradesLoading,
  isActioning,
  accept,
  reject,
} = useTrades();

const outgoingCount = computed(
  () => (proposals.value ?? []).filter((p) => p.type === "outgoing" && p.status === "pending").length
);

const { currentLeagueUnreadCount } = useNotifications();
const totalBadgeCount = computed(() => currentLeagueUnreadCount.value);

// ── Inbox ref ─────────────────────────────────────────────────────────────────
const inboxRef = ref<InstanceType<typeof Inbox> | null>(null);

async function handleAccept(id: string) {
  await accept(id);
}

async function handleReject(id: string) {
  await reject(id);
}

// ── Stat definitions ──────────────────────────────
interface StatDef {
  label: string;
  value: string | number;
  sub?: string | null;
  trend?: number;
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

// ── Carousel ──────────────────────────────────────
const INTERVAL_MS = 3500;
const activeIndex = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

const activeStatDef = computed(
  () => allStats.value[activeIndex.value] ?? allStats.value[0]
);

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
  font-family: var(--font-family-headings),serif;
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

/* ── Right column ────────────────────────────── */
.right-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
  grid-row: 1;
  grid-column: 2;
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
  font-family: var(--font-family-headings),serif;
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

.carousel-dots {
  grid-row: 2;
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 0.375rem;
  padding-top: 0.5rem;
  width: 100%;
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
  font-family: var(--font-family-headings),serif;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ion-text-color);
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

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

.proposal-actions ion-button {
  --border-radius: 0.375rem;
  width: 2rem;
  height: 2rem;
  margin: 0;
}

</style>
