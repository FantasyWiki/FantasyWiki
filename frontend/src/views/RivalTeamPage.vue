<template>
  <nav-bar>
    <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
      <ion-refresher-content />
    </ion-refresher>

    <!-- Heading first, and outside every branch: the back arrow is the way out
         of a page that failed to load, so it must not depend on the load. -->
    <div class="page-heading">
      <ion-button
        fill="clear"
        size="small"
        class="back-btn"
        :aria-label="t('views.rivalTeamPage.back')"
        @click="goBack()"
      >
        <ion-icon
          aria-hidden="true"
          slot="icon-only"
          :icon="arrowBackOutline"
        />
      </ion-button>
      <h2 class="page-title">
        {{ entry?.team.name ?? t("views.rivalTeamPage.loadingTitle") }}
      </h2>
      <ion-badge v-if="entry" color="medium" class="rank-badge">
        {{ rankLabel }}
      </ion-badge>
    </div>

    <!-- A team that is not in this league's standings is a wrong link, not a
         failed request — saying "retry" would invite a retry that cannot work. -->
    <ion-card v-if="isUnknownTeam" class="state-card">
      <ion-card-content>
        <p class="ion-no-margin state-title">
          {{ t("views.rivalTeamPage.notFoundTitle") }}
        </p>
        <p class="state-detail">
          {{ t("views.rivalTeamPage.notFoundDetail") }}
        </p>
        <ion-button fill="outline" size="small" @click="goBack()">
          {{ t("views.rivalTeamPage.backToStandings") }}
        </ion-button>
      </ion-card-content>
    </ion-card>

    <ion-card v-else-if="isError" color="danger" class="state-card">
      <ion-card-content>
        <div class="error-row">
          <ion-icon aria-hidden="true" :icon="alertCircleOutline" />
          <div>
            <p class="ion-no-margin state-title">
              {{ t("views.rivalTeamPage.failedToLoad") }}
            </p>
            <p class="state-detail">{{ error?.message }}</p>
            <ion-button
              fill="outline"
              color="light"
              size="small"
              @click="refetch()"
            >
              <ion-icon
                aria-hidden="true"
                slot="start"
                :icon="refreshOutline"
              />
              {{ t("views.rivalTeamPage.retry") }}
            </ion-button>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <div v-else-if="isLoading" class="pitch-skeleton" aria-busy="true">
      <ion-skeleton-text :animated="true" class="skeleton-summary" />
      <ion-skeleton-text :animated="true" class="skeleton-pitch" />
      <ion-skeleton-text :animated="true" class="skeleton-bench" />
    </div>

    <page-reveal v-else>
      <!-- Head-to-head. Shown only when the viewer fields a team here: for a
           spectator there is no gap to state, and a zero would claim one. -->
      <div v-if="pointsGap !== null" class="head-to-head">
        <ion-icon
          aria-hidden="true"
          :icon="pointsGap > 0 ? trendingUpOutline : trendingDownOutline"
          :class="pointsGap > 0 ? 'gap-icon--behind' : 'gap-icon--ahead'"
        />
        <span class="gap-text">{{ gapLabel }}</span>
        <ion-button
          fill="clear"
          size="small"
          class="my-team-link"
          @click="router.push({ name: 'Team' })"
        >
          {{ t("views.rivalTeamPage.viewMyTeam") }}
        </ion-button>
      </div>

      <!-- Summary: the standings facts the pitch itself cannot show. -->
      <div class="summary-row">
        <div class="summary-cell">
          <span class="summary-label">{{
            t("views.rivalTeamPage.points")
          }}</span>
          <span class="summary-value">{{ pointsLabel }}</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">{{
            t("views.rivalTeamPage.trend")
          }}</span>
          <span class="summary-value" :class="trend.cssClass">{{
            trend.label
          }}</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">{{
            t("views.rivalTeamPage.schema")
          }}</span>
          <span class="summary-value">{{
            lineup?.formation.schema ?? "—"
          }}</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">{{
            t("views.rivalTeamPage.bench")
          }}</span>
          <span class="summary-value">{{ lineup?.bench.length ?? 0 }}</span>
        </div>
      </div>

      <!-- The same pitch the player edits on their own team page, in its
           read-only mode: one component means a rival's formation can never
           drift from how the viewer's own is drawn. -->
      <team-formation
        v-if="lineup"
        :formation="lineup.formation"
        :editable="false"
        @article-click="openDetail"
      />

      <bench-section
        v-if="lineup"
        :articles="lineup.bench"
        @article-click="openDetail"
      />
    </page-reveal>

    <!-- No onSwap and no onRequestTrade: swapping is the owner's action, and
         those buttons only render when a host supplies the handler. -->
    <article-detail
      v-if="selectedContract"
      :contract="selectedContract"
      :article="selectedContract.article"
      :is-open="isDetailOpen"
      @close="closeDetail"
    />
  </nav-bar>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
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
  refreshOutline,
  trendingDownOutline,
  trendingUpOutline,
} from "ionicons/icons";
import { useI18n } from "vue-i18n";

import NavBar from "@/layout/NavBar.vue";
import PageReveal from "@/components/PageReveal.vue";
import TeamFormation from "@/components/formation/TeamFormation.vue";
import BenchSection from "@/components/formation/BenchSection.vue";
import ArticleDetail from "@/components/ArticleDetail.vue";
import { useRivalLineup } from "@/composables/useRivalLineup";
import type { ContractDTO } from "../../../dto/contractDTO";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();

const leagueId = computed(() => route.params.leagueId as string | undefined);
const teamId = computed(() => route.params.teamId as string | undefined);

const {
  entry,
  pointsGap,
  lineup,
  isUnknownTeam,
  isLeaderboardLoading,
  isLineupLoading,
  isError,
  error,
  refetch,
} = useRivalLineup(leagueId, teamId);

const isLoading = computed(
  () => isLeaderboardLoading.value || isLineupLoading.value
);

const rankLabel = computed(() =>
  entry.value ? t("views.rivalTeamPage.rank", { rank: entry.value.rank }) : ""
);

const pointsLabel = computed(() =>
  entry.value
    ? entry.value.cumulativePoints.toLocaleString(locale.value, {
        maximumFractionDigits: 1,
      })
    : "—"
);

/**
 * Whose favour the points gap is in. Phrased from the viewer's side ("ahead of
 * you" / "behind you") because the reader is comparing themselves to this team,
 * not reading a neutral fixture.
 */
const gapLabel = computed(() => {
  const gap = pointsGap.value;
  if (gap === null) return "";
  const points = Math.abs(gap).toLocaleString(locale.value, {
    maximumFractionDigits: 1,
  });
  if (gap === 0) return t("views.rivalTeamPage.gapLevel");
  return gap > 0
    ? t("views.rivalTeamPage.gapAhead", { points })
    : t("views.rivalTeamPage.gapBehind", { points });
});

/** Same three-way reading as the standings: a dash is "never compared". */
const trend = computed(() => {
  const delta = entry.value?.rankDelta;
  if (delta == null) return { cssClass: "trend--new", label: "—" };
  if (delta === 0) return { cssClass: "trend--stable", label: "=" };
  if (delta > 0) return { cssClass: "trend--up", label: `+${delta}` };
  return { cssClass: "trend--down", label: `${delta}` };
});

// ── Article detail ────────────────────────────────────────────────────────
const selectedContract = ref<ContractDTO | null>(null);
const isDetailOpen = ref(false);

function openDetail(contract: ContractDTO) {
  selectedContract.value = contract;
  isDetailOpen.value = true;
}

function closeDetail() {
  isDetailOpen.value = false;
}

/**
 * Back goes to this league's page rather than through history: the page is also
 * reachable from a shared link, where `router.back()` leaves the app.
 */
function goBack() {
  router.push({ name: "League", params: { leagueId: leagueId.value } });
}

async function handleRefresh(event: CustomEvent) {
  await refetch();
  (event.target as HTMLIonRefresherElement).complete();
}
</script>

<style scoped>
.page-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.page-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.back-btn {
  --padding-start: 0;
  --padding-end: 0;
  margin: 0;
}

.rank-badge {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* ── Head-to-head ──────────────────────────────── */
.head-to-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  font-size: 0.85rem;
}

.gap-text {
  flex: 1;
  min-width: 0;
}

.gap-icon--ahead {
  color: var(--ion-color-success);
}

.gap-icon--behind {
  color: var(--ion-color-danger);
}

.my-team-link {
  --padding-start: 0.25rem;
  --padding-end: 0.25rem;
  margin: 0;
  flex-shrink: 0;
}

/* ── Summary ───────────────────────────────────── */
.summary-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.summary-cell {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.5rem;
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  text-align: center;
}

.summary-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ion-color-medium);
}

.summary-value {
  font-size: 1.05rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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

/* ── States ────────────────────────────────────── */
.state-card {
  margin-inline: 0;
}

.state-title {
  font-weight: 600;
}

.state-detail {
  font-size: 0.85rem;
  margin: 0.25rem 0 0.75rem;
}

.error-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.pitch-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-summary {
  height: 3.5rem;
  border-radius: 8px;
}

.skeleton-pitch {
  height: 18rem;
  border-radius: 8px;
}

.skeleton-bench {
  height: 6rem;
  border-radius: 8px;
}
</style>
