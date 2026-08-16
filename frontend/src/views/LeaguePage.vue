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

        <!-- Renders only for a private league, and only for a caller its
             invite policy lets hand the code out. The server is what decides
             that; this component simply has nothing to show otherwise. -->
        <league-invite-card :league-id="leagueId" :league="league" />

        <!-- The mirror of the card above: that one is for a member handing the
             league out, this one is for a visitor who has not joined it yet.
             They are mutually exclusive by construction — you cannot both hold
             a team here and be offered one. -->
        <league-join-card
          :league="league"
          :my-team-id="myTeamId"
          :is-pending="isMyTeamPending"
        />

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
          @open-team="openTeam"
        />

        <!-- Ending the league, or your part in it. Last on the page and
             deliberately quiet: these are not what anyone came here to do, and
             nothing they do is undoable. Absent rather than disabled when they
             do not apply — the server says which, if either, is the caller's
             to take. -->
        <footer v-if="showLifecycle" class="lifecycle">
          <p v-if="isClosed" class="lifecycle-note">
            {{ t("leagueLifecycle.closedNote") }}
          </p>
          <ion-button
            v-if="canLeave"
            fill="clear"
            size="small"
            color="medium"
            class="lifecycle-btn"
            :disabled="isWorking"
            @click="leave()"
          >
            {{ t("leagueLifecycle.leaveAction") }}
          </ion-button>
          <ion-button
            v-if="canClose"
            fill="clear"
            size="small"
            color="medium"
            class="lifecycle-btn"
            :disabled="isWorking"
            @click="close()"
          >
            {{ t("leagueLifecycle.closeAction") }}
          </ion-button>
        </footer>
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
import LeagueInviteCard from "@/components/league/LeagueInviteCard.vue";
import LeagueJoinCard from "@/components/league/LeagueJoinCard.vue";
import LeaguePodium from "@/components/league/LeaguePodium.vue";
import LeagueStandings from "@/components/league/LeagueStandings.vue";
import { useLeagueCalendar } from "@/composables/useLeagueCalendar";
import { useLeagueDetail } from "@/composables/useLeagueDetail";
import { useLeagueLifecycle } from "@/composables/useLeagueLifecycle";
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
const { myTeamId, isPending: isMyTeamPending } = useMyTeam(leagueId);

/**
 * Opens a rival's line-up. Pushed, not replaced: it is a step down from the
 * standings, and Back has to come straight back to the row it was opened from.
 */
function openTeam(teamId: string) {
  router.push({
    name: "RivalTeam",
    params: { leagueId: leagueId.value, teamId },
  });
}

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
 * The second rule has to mean *the selection changed*, not merely that it
 * differs from the route. Plenty of leagues are legitimately readable while
 * some other one stays selected — a public league on the featured shelf, an
 * ended league in the archive, anything reached by an invitation link — and
 * treating "different" as "switched" redirected off every one of them the
 * instant anything touched the store. So what is remembered is the selection
 * this page arrived alongside, and only a move away from *that* is a switch.
 *
 * `replace`, not `push`: a switch is a change of context, not a step in a trail,
 * and stacking it would make Back walk the switch history instead of returning
 * to wherever the player came from.
 */
let reconciledFor: string | undefined;
let reconciledSelection: string | null = null;

watch(
  [
    leagueId,
    () => leagueStore.availableLeagues,
    () => leagueStore.currentLeagueId,
  ],
  ([id, available, currentId]) => {
    if (!id) return;

    // Re-reconcile whenever the route names a different league, since the same
    // page instance is reused when one league page navigates to another.
    if (reconciledFor !== id) {
      // An empty list means the fetch has not landed yet — there is nothing to
      // reconcile against, and guessing now is what caused the bounce.
      if (!available.length) return;

      // Selectable, not merely joined: the picker offers active leagues only,
      // so adopting an ended one would put the switcher on a league it cannot
      // show — and `_resolveCurrentLeague` would then throw the selection back
      // to an active league on the next fetch. A league the player has not
      // joined is not selectable either; the page still shows it, the switcher
      // just keeps pointing at one of theirs.
      const selectable = leagueStore.activeLeagues.find((lg) => lg.id === id);
      if (selectable && currentId !== id) {
        leagueStore.setCurrentLeague(selectable);
      }
      reconciledFor = id;
      reconciledSelection = selectable ? id : currentId;
      return;
    }

    if (currentId !== reconciledSelection) {
      reconciledSelection = currentId;
      if (currentId) {
        router.replace({ name: "League", params: { leagueId: currentId } });
      }
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

const { canClose, canLeave, isClosed, isWorking, close, leave } =
  useLeagueLifecycle(leagueId, league);

/**
 * The whole footer, not each button: an ended season offers neither action —
 * there is nothing left to close and nothing left to walk out of — but a league
 * closed early still says so. `phase` is read here rather than inside the
 * composable so the page has exactly one idea of when a season is over.
 */
const showLifecycle = computed(
  () =>
    isClosed.value ||
    (phase.value !== "ended" && (canLeave.value || canClose.value))
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

/* ── Lifecycle ─────────────────────────────────── */
/* Quieter than the invite card, which is quieter than the factsheet: this is
   the bottom of the page and the least of what anyone came for. A hairline and
   muted text, no card and no heading — the buttons name themselves. */
.lifecycle {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin-top: 2rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--ion-border-color);
}

.lifecycle-note {
  margin: 0;
  font-size: 0.78rem;
  color: var(--ion-color-medium);
}

.lifecycle-btn {
  --padding-start: 0;
  --padding-end: 0;
  margin-inline-end: 0.75rem;
  font-size: 0.78rem;
  text-transform: none;
  letter-spacing: 0;
}
</style>
