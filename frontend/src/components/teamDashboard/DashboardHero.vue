<template>
  <div class="hero-wrapper">
    <div class="hero-bg-decoration" aria-hidden="true" />

    <div class="hero-content">
      <!-- ── Identity + actions ─────────────────────── -->
      <div class="hero-left">
        <!-- Greeting + team name, league chip aligned right -->
        <div class="hero-top">
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

      <!-- ── Stat ledger: label left, value right ───── -->
      <div class="stat-list" v-if="data">
        <div v-for="stat in allStats" :key="stat.label" class="stat-row">
          <div class="stat-row__meta">
            <div
              class="stat-row__icon"
              :style="{ background: stat.iconBg, color: stat.iconColor }"
            >
              <ion-icon :icon="stat.icon" />
            </div>
            <div class="stat-row__labels">
              <ion-text color="medium">
                <p class="stat-row__label ion-no-margin">
                  {{ stat.label }}
                </p>
              </ion-text>
              <p v-if="stat.sub" class="stat-row__sub ion-no-margin">
                {{ stat.sub }}
              </p>
            </div>
          </div>

          <div class="stat-row__figure">
            <!-- Trend chip — only on the points row -->
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
            <span
              class="stat-row__value"
              :class="{ 'stat-row__value--gold': stat.gold }"
            >
              {{ stat.value }}
            </span>
          </div>
        </div>
      </div>

      <!-- Skeletons for the stat rows -->
      <div class="stat-list" v-else>
        <div v-for="i in 4" :key="i" class="stat-row">
          <div class="stat-row__meta">
            <ion-skeleton-text
              :animated="true"
              class="stat-row__skeleton-icon"
            />
            <ion-skeleton-text
              :animated="true"
              class="stat-row__skeleton-lbl"
            />
          </div>
          <ion-skeleton-text :animated="true" class="stat-row__skeleton-val" />
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
  /** Wiki Gold value — reserved for ranking/prestige stats */
  gold?: boolean;
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
      gold: true,
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

/* Heading left, league chip pushed to the right edge */
.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.hero-heading {
  min-width: 0;
  flex: 1;
}

.league-chip {
  margin: 0;
  flex-shrink: 0;
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
  margin-bottom: 0.75rem;
}

.team-name {
  font-family: var(--font-family-headings), serif;
  font-size: clamp(1vw, 3vw, 5vw);
  font-weight: 700;
  color: var(--ion-text-color);
  line-height: 1.1;
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

/* ── Stat ledger ─────────────────────────────── */
.stat-list {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.25rem;
  min-width: 0;
}

.stat-row + .stat-row {
  border-top: 1px solid var(--ion-border-color);
}

.stat-row__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.stat-row__icon {
  width: 2.5rem;
  height: 2.5rem;
  min-width: 2.5rem;
  border-radius: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-row__icon ion-icon {
  font-size: 1.2rem;
}

.stat-row__labels {
  min-width: 0;
}

.stat-row__label {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.stat-row__sub {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  margin-top: 3px;
}

/* Right-aligned figures form one scannable column down the panel */
.stat-row__figure {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.stat-row__value {
  font-family: var(--font-family-headings), serif;
  font-size: 1.65rem;
  font-weight: 700;
  color: var(--ion-text-color);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.stat-row__value--gold {
  color: var(--ion-color-warning);
}

.trend-chip {
  height: 1.5rem;
  font-size: 0.72rem;
  --background: transparent;
  flex-shrink: 0;
  margin: 0;
}

/* Skeletons */
.stat-row__skeleton-icon {
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  border-radius: 0.6rem;
}

.stat-row__skeleton-lbl {
  width: 7rem;
  height: 0.8rem;
  border-radius: 4px;
}

.stat-row__skeleton-val {
  width: 3.5rem;
  height: 1.4rem;
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

  /* Rows share the leftover height so the last divider rhythm
     carries the panel down to the pitch's bottom edge */
  .stat-list {
    flex: 1;
  }

  .stat-row {
    flex: 1;
    padding: 0.875rem 0.25rem;
  }

  .stat-row__icon {
    width: 3rem;
    height: 3rem;
    min-width: 3rem;
    border-radius: 0.75rem;
  }

  .stat-row__icon ion-icon {
    font-size: 1.4rem;
  }

  .stat-row__meta {
    gap: 1rem;
  }

  .stat-row__label {
    font-size: 0.92rem;
    letter-spacing: 0.05em;
  }

  .stat-row__sub {
    font-size: 0.98rem;
    margin-top: 4px;
  }

  .stat-row__value {
    font-size: 1.85rem;
  }

  .trend-chip {
    height: 1.65rem;
    font-size: 0.78rem;
  }
}
</style>
