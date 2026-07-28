<template>
  <!--
    Re-proposes an interrupted first run. A brand-new player is sent to
    `/team-creation` by the auth callback, but that is a one-shot signal
    (`?new=1`): a player who closes the browser mid-onboarding, before naming a
    team, comes back authenticated with no team in any league and nothing to
    prompt them again — the dashboard just shows its "no league" card and the
    game is unreachable (issue #475).

    This modal closes that gap from state rather than from a URL flag: whenever
    an authenticated player is known to have no team, it stands in front of the
    app until they go create one. Membership, not a query param, is the trigger,
    so it works no matter how the session was restored (fresh login *or* an
    existing cookie on app boot).
  -->
  <ion-modal
    :is-open="isOpen"
    css-class="login-modal"
    :backdrop-dismiss="false"
    :keyboard-close="false"
  >
    <div class="team-required-card">
      <ion-icon :icon="trophyOutline" class="team-required-icon" />
      <h2 class="team-required-title">
        {{ t("onboarding.teamRequired.title") }}
      </h2>
      <ion-text color="medium" class="team-required-lede">
        <p>{{ t("onboarding.teamRequired.body") }}</p>
      </ion-text>
      <ion-button
        expand="block"
        class="team-required-cta"
        @click="goToTeamCreation"
      >
        {{ t("onboarding.teamRequired.cta") }}
      </ion-button>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { IonModal, IonButton, IonIcon, IonText } from "@ionic/vue";
import { trophyOutline } from "ionicons/icons";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/app";
import { useLeagueStore } from "@/stores/league";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const leagueStore = useLeagueStore();

// The team-creation routes are the way *out* of this prompt, so it must never
// cover them; on every other authenticated screen a teamless player is stranded
// without it. `hasTeam` is undefined until the league list has been fetched,
// which keeps the modal from flashing on the not-yet-loaded state.
const isOnTeamCreation = computed(
  () => route.name === "TeamCreation" || route.name === "LeagueTeamCreation"
);

const isOpen = computed(
  () =>
    appStore.isAuthenticated &&
    leagueStore.hasTeam === false &&
    !isOnTeamCreation.value
);

function goToTeamCreation() {
  router.push("/team-creation");
}
</script>

<style scoped>
.team-required-card {
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.25rem;
}

.team-required-icon {
  font-size: 3.5rem;
  color: var(--ion-color-primary);
}

.team-required-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}

.team-required-lede {
  font-size: 0.95rem;
  line-height: 1.5;
}

.team-required-lede p {
  margin: 0;
}

.team-required-cta {
  width: 100%;
  --border-radius: 8px;
  height: 48px;
}
</style>
