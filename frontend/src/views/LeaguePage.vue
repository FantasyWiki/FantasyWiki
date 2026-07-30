<template>
  <nav-bar>
    <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
      <ion-refresher-content />
    </ion-refresher>

    <div class="page-container">
      <!-- Heading: back arrow first, so it is reachable while the league loads -->
      <div class="page-heading">
        <ion-button
          fill="clear"
          size="small"
          class="back-btn"
          :aria-label="t('league.back')"
          @click="router.push({ name: 'Dashboard' })"
        >
          <ion-icon slot="icon-only" :icon="arrowBackOutline" />
        </ion-button>
        <span v-if="league" class="league-icon">{{ league.icon }}</span>
        <h2 class="page-title">
          {{ league?.title ?? t("league.loadingTitle") }}
        </h2>
      </div>

      <!-- Error: the league itself could not be resolved, so there is no page -->
      <ion-card v-if="isError" color="danger" class="state-card">
        <ion-card-content>
          <div class="error-row">
            <ion-icon :icon="alertCircleOutline" />
            <div>
              <p class="ion-no-margin error-title">
                {{ t("league.errorTitle") }}
              </p>
              <p class="error-detail">
                {{ error?.message || t("league.errorDetail") }}
              </p>
              <ion-button
                fill="outline"
                color="light"
                size="small"
                @click="refetch()"
              >
                <ion-icon slot="start" :icon="refreshOutline" />
                {{ t("league.retry") }}
              </ion-button>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <page-reveal v-else>
        <league-factsheet :league="league" :team-count="teamCount" />

        <!-- The top three lead the page all season, and the full table follows
             underneath. A finished season escalates the same podium into the
             result rather than introducing a different one. -->
        <league-podium
          v-if="showPodium"
          :leaderboard="leaderboard"
          :my-team-id="myTeamId"
          :variant="podiumVariant"
        />

        <league-standings
          :leaderboard="leaderboard"
          :my-team-id="myTeamId"
          :loading="isLeaderboardLoading"
          :errored="isLeaderboardError"
          :phase="phase"
        />
      </page-reveal>
    </div>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
} from "@ionic/vue";
import {
  alertCircleOutline,
  arrowBackOutline,
  refreshOutline,
} from "ionicons/icons";
import { useI18n } from "vue-i18n";

import NavBar from "@/layout/NavBar.vue";
import PageReveal from "@/components/PageReveal.vue";
import LeagueFactsheet from "@/components/league/LeagueFactsheet.vue";
import LeaguePodium from "@/components/league/LeaguePodium.vue";
import LeagueStandings from "@/components/league/LeagueStandings.vue";
import { useLeagueCalendar } from "@/composables/useLeagueCalendar";
import { useLeagueDetail } from "@/composables/useLeagueDetail";
import { useMyTeam } from "@/composables/useMyTeam";
import { useLeagueStore } from "@/stores/league";

const route = useRoute();
const router = useRouter();
const leagueStore = useLeagueStore();
const { t } = useI18n();

const leagueId = computed(() => route.params.leagueId as string | undefined);

const {
  league,
  leaderboard,
  teamCount,
  isLeaderboardLoading,
  isLeaderboardError,
  isError,
  error,
  refetch,
} = useLeagueDetail(leagueId);

// Scoped to the league in the route, not the selected one: this page is
// reachable for any league, and "You" has to mark the right row.
const { myTeamId } = useMyTeam(leagueId);

/**
 * Keeps the URL and the NavBar's league switcher saying the same thing. Two
 * rules that have to coexist without fighting each other:
 *
 *  - **On arrival the route wins.** A cold deep link mounts before the store has
 *    fetched anything, and `initialize()` then settles the selection on the
 *    persisted (or first) league. Reacting to that as if it were a switch would
 *    bounce the player off the league they actually asked for.
 *  - **Afterwards the switcher wins.** Picking a league in the NavBar moves the
 *    page, rather than leaving the chrome naming one league and the page showing
 *    another.
 *
 * `replace`, not `push`: a switch is a change of context, not a step in a trail,
 * and stacking it would make Back walk the switch history instead of returning
 * to wherever the player came from.
 */
let reconciledWithStore = false;

watch(
  [
    leagueId,
    () => leagueStore.availableLeagues,
    () => leagueStore.currentLeagueId,
  ],
  ([id, available, currentId]) => {
    if (!id) return;

    if (!reconciledWithStore) {
      // An empty list means the fetch has not landed yet — there is nothing to
      // reconcile against, and guessing now is what caused the bounce.
      if (!available.length) return;
      reconciledWithStore = true;
      const joined = available.find((lg) => lg.id === id);
      // A league the player has not joined is not selectable; the page still
      // shows it, the switcher just keeps pointing at one of theirs.
      if (joined && currentId !== id) leagueStore.setCurrentLeague(joined);
      return;
    }

    if (currentId && currentId !== id) {
      router.replace({ name: "League", params: { leagueId: currentId } });
    }
  },
  { immediate: true }
);

const { phase } = useLeagueCalendar(league);

/**
 * The podium runs all season, not just at the whistle — see LeaguePodium for
 * why. Two things withhold it:
 *
 *  - a board that has not settled (mid-fetch it is empty, and a podium built
 *    from that would stage the wrong three for a frame);
 *  - a league where nobody has scored yet, where the ranks are an arbitrary
 *    ordering of a universal tie and crowning anyone would be a fiction.
 */
const isScored = computed(() =>
  leaderboard.value.some((e) => e.cumulativePoints > 0)
);

const showPodium = computed(
  () =>
    !isLeaderboardLoading.value &&
    isScored.value &&
    // A league that has not kicked off has no standing to stage, whatever the
    // board happens to say.
    (phase.value === "active" || phase.value === "ended")
);

const podiumVariant = computed<"live" | "final">(() =>
  phase.value === "ended" ? "final" : "live"
);

async function handleRefresh(event: CustomEvent) {
  await refetch();
  (event.target as HTMLIonRefresherElement).complete();
}
</script>

<style scoped>
.page-container {
  max-width: 1000px;
  margin: 0 auto;
}

@media (min-width: 1024px) {
  .page-container {
    padding-left: 2rem;
    padding-right: 2rem;
  }
}

/* ── Heading ───────────────────────────────────── */
.page-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.back-btn {
  --padding-start: 0;
  --padding-end: 4px;
  margin-inline-end: 0;
}

.league-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  font-family: var(--font-family-headings);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .page-title {
    font-size: 2rem;
  }
  .league-icon {
    font-size: 2rem;
  }
}

/* ── Error ─────────────────────────────────────── */
.state-card {
  margin-top: 1rem;
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
  opacity: 0.85;
  margin: 0 0 8px;
}
</style>
