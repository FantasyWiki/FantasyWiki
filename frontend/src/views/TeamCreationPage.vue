<template>
  <nav-bar>
    <page-reveal class="start-layout" :class="{ 'is-join': !isFirstRun }">
      <welcome-intro v-if="isFirstRun" />

      <section class="start-form">
        <h2 class="form-title">
          {{
            isFirstRun
              ? t("onboarding.start.formTitle")
              : t("views.teamCreation.joinTitle")
          }}
        </h2>
        <p class="form-hint">
          {{
            isFirstRun
              ? t("onboarding.start.formHint")
              : t("views.teamCreation.joinHint")
          }}
        </p>

        <team-creation-form
          v-if="league"
          :league="league"
          @created="handleCreated"
        />
        <ion-text v-else-if="isError" color="danger" class="league-error">
          {{ t("views.teamCreation.leagueUnavailable") }}
        </ion-text>
        <ion-spinner v-else name="dots" class="league-loading" />
      </section>
    </page-reveal>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { IonSpinner, IonText } from "@ionic/vue";
import { useI18n } from "vue-i18n";
import NavBar from "@/layout/NavBar.vue";
import PageReveal from "@/components/PageReveal.vue";
import WelcomeIntro from "@/components/onboarding/WelcomeIntro.vue";
import TeamCreationForm from "@/components/TeamCreationForm.vue";
import api from "@/services/api";
import { queryKeys } from "@/composables/queryKeys";
import { useLeagueStore } from "@/stores/league";
import { useOnboardingStore } from "@/stores/onboarding";

/**
 * Naming a team for one league. A player does this once per league they enter,
 * so this page serves two arrivals from the same form:
 *
 *  - `/team-creation` — signup. No league is named, so it is the Global League
 *    (the one every new player joins), the welcome sits beside the form, and
 *    submitting hands over to the real dashboard with the guided tour running
 *    on top of it. No interstitial slideshow between signing up and playing.
 *  - `/leagues/:leagueId/team-creation` — entering a further league. The league
 *    comes from the route, there is no welcome (the player knows the game) and
 *    no tour; they just land on the league they have just joined.
 *
 * The presence of the route param is the discriminator rather than "does this
 * player have leagues": it is known at first render, so the welcome can never
 * flash on-screen while a league list is still in flight, and the parameterized
 * route is only reachable from inside the app anyway.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const leagueStore = useLeagueStore();
const onboarding = useOnboardingStore();

const leagueId = computed(() => (route.params.leagueId as string) || null);
const isFirstRun = computed(() => leagueId.value === null);

const { data: league, isError } = useQuery({
  queryKey: computed(() =>
    leagueId.value ? queryKeys.league(leagueId.value) : queryKeys.globalLeague()
  ),
  // A player joining a league is by definition not a member of it yet, so the
  // league store (which only holds leagues they already have a team in) cannot
  // answer this and the league is fetched by id instead.
  // TODO: the parameterized route works against MSW but not yet against the
  // real backend, which has no `GET /leagues/:id` (and no
  // `LeagueService.getLeagueById` behind it). That endpoint, and whatever
  // screen links here, are what the join-a-league flow still needs; signup (no
  // param) goes through `/api/leagues/global` and works today.
  queryFn: () =>
    leagueId.value
      ? api.leagues.getById(leagueId.value)
      : api.leagues.getGlobal(),
});

async function handleCreated() {
  // Read before navigating: `isFirstRun` is derived from the route, and the
  // push below takes this page (and its param) off screen.
  const firstRun = isFirstRun.value;

  // The player was not a member of this league a second ago, so the store the
  // NavBar populated on mount does not contain it yet and the dashboard would
  // render its "no league" card. Refetching here is what makes the next screen
  // the *populated* dashboard.
  await leagueStore.fetchLeagues();

  // …and this is what makes it the dashboard of the league they just joined:
  // the refetch resolves to the previously stored league, which for a second
  // league would be the old one. The list entry is preferred over the fetched
  // league because it carries the team that was just created, but if the list
  // lags behind the write, landing on the right league with a stale roster
  // still beats landing on the wrong one.
  const joined =
    leagueStore.availableLeagues.find((lg) => lg.id === league.value?.id) ??
    league.value;
  if (joined) leagueStore.setCurrentLeague(joined);

  // Land on the dashboard first, then start narrating it: starting the tour
  // while still on this page would make the dock issue the same navigation a
  // moment before this one does.
  await router.push("/dashboard");
  if (firstRun) onboarding.start();
}
</script>

<style scoped>
.start-layout {
  display: grid;
  gap: 2rem;
  max-width: 62rem;
  margin: 0 auto;
  padding: 1rem 0 2rem;
}

/* Side by side once there is room; the intro keeps reading order above the
   form when stacked. */
@media (min-width: 992px) {
  .start-layout {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    gap: 3.5rem;
    align-items: start;
    padding-top: 2.5rem;
  }
}

/* Without the intro there is nothing to sit beside, so the form centres at a
   readable width instead of clinging to one column of a two-column grid. */
.start-layout.is-join {
  max-width: 30rem;
  padding-top: 2.5rem;
}

@media (min-width: 992px) {
  .start-layout.is-join {
    grid-template-columns: minmax(0, 1fr);
  }
}

.start-form {
  padding: 1.5rem;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-background-color-step-50);
}

.form-title {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
  line-height: 1.3;
}

.form-hint {
  margin: 0 0 1.5rem;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--ion-color-medium);
}

.league-error,
.league-loading {
  display: block;
  font-size: 0.875rem;
}
</style>
