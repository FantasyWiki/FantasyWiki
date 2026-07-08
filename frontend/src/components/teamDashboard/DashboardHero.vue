<template>
  <div class="hero-wrapper">
    <div class="hero-bg-decoration" aria-hidden="true" />

    <div class="hero-content">
      <!-- ── Identity + actions ─────────────────────── -->
      <div class="hero-left">
        <!-- League chip -->
        <ion-chip
          v-if="currentLeague"
          class="league-chip"
          color="primary"
          outline
          :disabled="true"
          style="opacity: 1"
        >
          <span class="league-icon">{{ currentLeague.icon }}</span>
          <ion-label>{{ currentLeague.title }}</ion-label>
          <ion-badge
            v-if="currentLeague.endDate.toLocaleString()"
            color="primary"
            class="season-badge"
          >
            {{
              currentLeague.startDate.toLocaleString(locale, {
                month: "short",
                year: "numeric",
              })
            }}
          </ion-badge>
        </ion-chip>

        <!-- Greeting + team name -->
        <div class="hero-heading">
          <ion-text color="medium">
            <p class="greeting-text ion-no-margin">
              {{ $t("dashboard.hero.welcomeBack") }}
            </p>
          </ion-text>
          <h1 class="team-name ion-no-margin">
            {{ data?.team?.name ?? $t("dashboard.hero.yourTeam") }}
          </h1>
        </div>

        <!-- Rank pill — rank only -->
        <div class="rank-pill" v-if="data">
          <ion-icon :icon="trophyOutline" color="warning" />
          <span class="rank-value">#{{ data.rank }}</span>
          <span class="rank-label">{{
            $t("dashboard.hero.rankOf", { count: data.totalPlayers })
          }}</span>
        </div>

        <!-- Actions: Buy Articles + inbox bell -->
        <div class="hero-actions">
          <ion-button
            color="primary"
            fill="solid"
            @click="router.push('/market')"
          >
            <ion-icon slot="start" :icon="cartOutline" />
            {{ $t("dashboard.hero.buyArticles") }}
          </ion-button>

          <in-box />
        </div>
      </div>

      <!-- ── All four stats, always visible ─────────── -->
      <div class="stat-cards" v-if="data">
        <div v-for="stat in allStats" :key="stat.label" class="stat-card">
          <div
            class="stat-card__icon"
            :style="{ background: stat.iconBg, color: stat.iconColor }"
          >
            <ion-icon :icon="stat.icon" />
          </div>
          <div class="stat-card__body">
            <ion-text color="medium">
              <p class="stat-card__label ion-no-margin">
                {{ stat.label }}
              </p>
            </ion-text>
            <div class="stat-card__value-row">
              <span class="stat-card__value">{{ stat.value }}</span>
              <!-- Trend chip — only on the points card -->
              <ion-chip
                v-if="stat.trend !== undefined"
                :color="stat.trend >= 0 ? 'success' : 'danger'"
                class="trend-chip"
                outline
              >
                <ion-icon
                  :icon="
                    stat.trend >= 0 ? trendingUpOutline : trendingDownOutline
                  "
                />
                <ion-label>
                  {{ stat.trend >= 0 ? "+" : "" }}{{ stat.trend }}%
                </ion-label>
              </ion-chip>
            </div>
            <p v-if="stat.sub" class="stat-card__sub ion-no-margin">
              {{ stat.sub }}
            </p>
          </div>
        </div>
      </div>

      <!-- Skeletons for the stat cards -->
      <div class="stat-cards" v-else>
        <div v-for="i in 4" :key="i" class="stat-card">
          <ion-skeleton-text
            :animated="true"
            class="stat-card__skeleton-icon"
          />
          <div class="stat-card__body">
            <ion-skeleton-text
              :animated="true"
              class="stat-card__skeleton-lbl"
            />
            <ion-skeleton-text
              :animated="true"
              class="stat-card__skeleton-val"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  IonBadge,
  IonButton,
  IonChip,
  IonIcon,
  IonLabel,
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
import InBox from "@/components/InBox.vue";
import type { DashboardData } from "@/types/models";
import { useLeagueStore } from "@/stores/league";

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  data: DashboardData | null;
}

const props = defineProps<Props>();
const router = useRouter();
const { t, locale } = useI18n();

const leagueStore = useLeagueStore();
const currentLeague = computed(() => leagueStore.currentLeague);

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
  const s = props.data;
  if (!s) return [];
  return [
    {
      label: t("dashboard.hero.yesterdayPoints"),
      value: s.recentPoints.yesterdayPoints,
      sub: null,
      trend: s.recentPoints.pointsChange,
      icon: trendingUpOutline,
      iconBg: "rgba(var(--ion-color-primary-rgb), 0.12)",
      iconColor: "var(--ion-color-primary)",
    },
    {
      label: t("dashboard.hero.credits"),
      value: s.team.credits,
      sub: t("dashboard.hero.portfolio", { value: s.portfolioValue }),
      icon: cashOutline,
      iconBg: "rgba(var(--ion-color-primary-rgb), 0.12)",
      iconColor: "var(--ion-color-primary)",
    },
    {
      label: t("dashboard.hero.contracts"),
      value: `${s.activeContracts}/${s.maxContracts}`,
      sub: t("dashboard.hero.slotsFree", {
        count: s.maxContracts - s.activeContracts,
      }),
      icon: documentTextOutline,
      iconBg: "rgba(var(--ion-color-secondary-rgb), 0.25)",
      iconColor: "var(--ion-color-secondary-shade)",
    },
    {
      label: t("dashboard.hero.standing"),
      value: `#${s.rank}`,
      sub: t("dashboard.hero.standingSub", { count: s.totalPlayers }),
      icon: trophyOutline,
      iconBg: "rgba(var(--ion-color-warning-rgb), 0.15)",
      iconColor: "var(--ion-color-warning)",
    },
  ];
});
</script>

<style scoped>
/* ── Hero wrapper ────────────────────────────── */
.hero-wrapper {
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  padding: 1.5rem;
  margin-bottom: 1rem;
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

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

/* ── Identity block ──────────────────────────── */
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
  font-family: var(--font-family-headings), serif;
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

/* ── Stat cards ──────────────────────────────── */
.stat-cards {
  margin-top: 1.25rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  border-radius: 0.875rem;
  box-shadow: 0 2px 12px var(--ion-box-shadow-color);
  min-width: 0;
}

.stat-card__icon {
  width: 2.5rem;
  height: 2.5rem;
  min-width: 2.5rem;
  border-radius: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-card__icon ion-icon {
  font-size: 1.2rem;
}

.stat-card__body {
  flex: 1;
  min-width: 0;
}

.stat-card__label {
  font-size: 0.68rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 3px;
}

.stat-card__value-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.stat-card__value {
  font-family: var(--font-family-headings), serif;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ion-text-color);
  line-height: 1.1;
}

.stat-card__sub {
  font-size: 0.72rem;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

.trend-chip {
  height: 1.5rem;
  font-size: 0.72rem;
  --background: transparent;
  flex-shrink: 0;
}

/* Skeletons */
.stat-card__skeleton-icon {
  width: 2.5rem;
  height: 2.5rem;
  min-width: 2.5rem;
  border-radius: 0.65rem;
}

.stat-card__skeleton-lbl {
  width: 70%;
  height: 0.65rem;
  border-radius: 4px;
}

.stat-card__skeleton-val {
  width: 50%;
  height: 1.2rem;
  border-radius: 4px;
}

/* ── Side-panel mode (next to the pitch) ─────── */
@media (min-width: 992px) {
  .hero-wrapper {
    display: flex;
    flex-direction: column;
  }

  .hero-content {
    flex: 1;
  }

  /* One card per row, growing evenly to meet the pitch's bottom edge */
  .stat-cards {
    flex: 1;
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: minmax(0, 1fr);
  }

  .stat-card__value {
    font-size: 1.75rem;
  }
}
</style>
