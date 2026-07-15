<template>
  <nav-bar>
    <!-- ── Pull-to-refresh ──────────────────────────────────────────────── -->
    <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
      <ion-refresher-content />
    </ion-refresher>

    <!-- ── Page heading ────────────────────────────────────────────────── -->
    <div class="page-heading">
      <div class="heading-left">
        <ion-button
          fill="clear"
          size="small"
          class="back-btn"
          @click="router.back()"
        >
          <ion-icon slot="icon-only" :icon="arrowBackOutline" />
        </ion-button>
        <h2 class="page-title">{{ t("views.formationPerformance.title") }}</h2>
        <ion-badge v-if="currentLeague" color="primary" class="league-badge">
          {{ currentLeague.icon }} {{ currentLeague.title }}
        </ion-badge>
      </div>
    </div>

    <!-- ── Loading skeleton ────────────────────────────────────────────── -->
    <div v-if="isLoading" class="perf-skeleton" aria-busy="true">
      <ion-skeleton-text :animated="true" class="skeleton-hero" />
      <ion-skeleton-text :animated="true" class="skeleton-pitch" />
    </div>

    <!-- ── Error state ─────────────────────────────────────────────────── -->
    <ion-card v-else-if="isError" color="danger" class="error-card">
      <ion-card-content>
        <div class="error-row">
          <ion-icon :icon="alertCircleOutline" />
          <div>
            <p class="error-title">
              {{ t("views.formationPerformance.failedToLoad") }}
            </p>
            <p class="error-detail">{{ error?.message }}</p>
            <ion-button
              fill="outline"
              color="light"
              size="small"
              @click="refetch()"
            >
              <ion-icon slot="start" :icon="refreshOutline" />
              {{ t("views.formationPerformance.retry") }}
            </ion-button>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- ── Empty state (no scored day yet) ─────────────────────────────── -->
    <ion-card v-else-if="!hasPerformance" class="empty-card">
      <ion-card-content class="empty-content">
        <ion-icon :icon="moonOutline" class="empty-icon" />
        <p class="empty-title">
          {{ t("views.formationPerformance.emptyTitle") }}
        </p>
        <p class="empty-detail">
          {{ t("views.formationPerformance.emptyDetail") }}
        </p>
      </ion-card-content>
    </ion-card>

    <!-- ── Main content ────────────────────────────────────────────────── -->
    <template v-else>
      <!-- Points summary -->
      <ion-card class="score-hero">
        <ion-card-content>
          <p class="score-label">
            {{ t("views.formationPerformance.pointsScored") }}
          </p>
          <div class="score-value-row">
            <span class="score-value">{{ formattedPoints }}</span>
            <span
              v-if="pointsDelta !== null"
              class="score-delta"
              :class="deltaClass"
            >
              <ion-icon :icon="deltaIcon" />
              {{ deltaLabel }}
            </span>
          </div>
          <p v-if="scoredDate" class="score-date">
            {{ t("views.formationPerformance.scoredOn", { date: scoredDate }) }}
          </p>
          <p v-if="pointsDelta === null" class="score-firstnight">
            {{ t("views.formationPerformance.firstNight") }}
          </p>
        </ion-card-content>
      </ion-card>

      <!-- The formation that was scored, rendered read-only -->
      <p class="pitch-caption">
        {{ t("views.formationPerformance.formationCaption") }}
      </p>
      <TeamFormation v-if="formation" :formation="formation" />
    </template>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
} from "@ionic/vue";
import {
  alertCircleOutline,
  arrowBackOutline,
  arrowDownOutline,
  arrowUpOutline,
  moonOutline,
  refreshOutline,
  removeOutline,
} from "ionicons/icons";
import { useI18n } from "vue-i18n";

import NavBar from "@/layout/NavBar.vue";
import TeamFormation from "@/components/formation/TeamFormation.vue";
import { useFormationPerformance } from "@/composables/useFormationPerformance";
import { useLeagueStore } from "@/stores/league";
import { useAppStore } from "@/stores/app";

const router = useRouter();
const { t } = useI18n();

const leagueStore = useLeagueStore();
const appStore = useAppStore();
const currentLeague = computed(() => leagueStore.currentLeague);

const {
  isLoading,
  isError,
  error,
  refetch,
  latest,
  hasPerformance,
  points,
  pointsDelta,
  pointsDeltaPercent,
  formation,
} = useFormationPerformance();

// Points render as whole numbers — a daily team score is a large integer-like
// figure, and the fractional base-point tail is noise at this altitude.
const formattedPoints = computed(() =>
  Math.round(points.value).toLocaleString(appStore.currentLanguage.code)
);

const scoredDate = computed(() => {
  const date = latest.value?.date;
  if (!date) return null;
  return date.toLocaleString(appStore.currentLanguage.code, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
});

const deltaClass = computed(() => {
  const delta = pointsDelta.value;
  if (delta === null || delta === 0) return "score-delta--flat";
  return delta > 0 ? "score-delta--up" : "score-delta--down";
});

const deltaIcon = computed(() => {
  const delta = pointsDelta.value;
  if (delta === null || delta === 0) return removeOutline;
  return delta > 0 ? arrowUpOutline : arrowDownOutline;
});

// Prefer the percentage swing when it's meaningful; fall back to the absolute
// point delta when the prior night scored zero (percentage undefined).
const deltaLabel = computed(() => {
  const delta = pointsDelta.value;
  if (delta === null) return "";
  const sign = delta > 0 ? "+" : "";
  const percent = pointsDeltaPercent.value;
  if (percent !== null) {
    return `${sign}${percent}%`;
  }
  return `${sign}${Math.round(delta).toLocaleString(
    appStore.currentLanguage.code
  )}`;
});

async function handleRefresh(event: CustomEvent) {
  await refetch();
  (event.target as HTMLIonRefresherElement).complete();
}
</script>

<style scoped>
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.heading-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.back-btn {
  --padding-start: 0;
  --padding-end: 4px;
  margin-inline-end: 4px;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  font-family: var(--font-family-headings);
}

.league-badge {
  font-size: 11px;
}

/* ── Score hero ───────────────────────────────────────────────────────────── */
.score-hero {
  margin: 0 0 16px;
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    rgba(var(--ion-color-primary-rgb), 0.14),
    rgba(var(--ion-color-primary-rgb), 0.04)
  );
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.18);
  box-shadow: none;
}

.score-label {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ion-color-medium-shade);
}

.score-value-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.score-value {
  font-size: 2.6rem;
  font-weight: 800;
  line-height: 1;
  font-family: var(--font-family-headings);
  color: var(--ion-color-primary);
}

.score-delta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.95rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
}

.score-delta ion-icon {
  font-size: 0.95rem;
}

.score-delta--up {
  color: #1f7a4d;
  background: rgba(47, 143, 91, 0.14);
}

.score-delta--down {
  color: #b12414;
  background: rgba(212, 42, 23, 0.12);
}

.score-delta--flat {
  color: var(--ion-color-medium-shade);
  background: rgba(var(--ion-color-medium-rgb), 0.14);
}

.score-date {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--ion-color-medium-shade);
}

.score-firstnight {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ion-color-medium);
  font-style: italic;
}

.pitch-caption {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium-shade);
  text-align: center;
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
.perf-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-hero {
  height: 110px;
  border-radius: 14px;
}

.skeleton-pitch {
  height: 480px;
  border-radius: 12px;
}

/* ── Empty state ──────────────────────────────────────────────────────────── */
.empty-card {
  margin-top: 8px;
  border-radius: 14px;
}

.empty-content {
  text-align: center;
  padding: 32px 20px;
}

.empty-icon {
  font-size: 2.75rem;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
}

.empty-title {
  font-weight: 700;
  font-size: 1.05rem;
  margin: 0 0 6px;
}

.empty-detail {
  font-size: 13px;
  color: var(--ion-color-medium-shade);
  margin: 0;
}

/* ── Error state ──────────────────────────────────────────────────────────── */
.error-card {
  margin-top: 8px;
}

.error-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.error-row ion-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.error-title {
  font-weight: 600;
  margin: 0 0 4px;
}

.error-detail {
  font-size: 13px;
  color: var(--ion-color-light);
  margin: 0 0 8px;
  opacity: 0.85;
}
</style>
