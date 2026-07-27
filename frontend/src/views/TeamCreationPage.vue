<template>
  <nav-bar>
    <page-reveal class="start-layout">
      <section class="start-intro">
        <p class="intro-eyebrow">{{ t("onboarding.start.eyebrow") }}</p>
        <h1 class="intro-title">{{ t("onboarding.start.title") }}</h1>
        <p class="intro-lede">{{ t("onboarding.start.lede") }}</p>

        <day-loop class="intro-loop" />

        <ul class="intro-facts">
          <li>
            <strong>
              {{ t("onboarding.start.creditsValue", { credits }) }}
            </strong>
            {{ t("onboarding.start.credits") }}
          </li>
          <li>
            <strong>{{ t("onboarding.start.slotsValue") }}</strong>
            {{ t("onboarding.start.slots") }}
          </li>
          <li>
            <strong>{{ t("onboarding.start.winValue") }}</strong>
            {{ t("onboarding.start.win") }}
          </li>
        </ul>
      </section>

      <section class="start-form">
        <h2 class="form-title">{{ t("onboarding.start.formTitle") }}</h2>
        <p class="form-hint">{{ t("onboarding.start.formHint") }}</p>
        <team-creation-form @created="startPlaying" />
      </section>
    </page-reveal>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import NavBar from "@/layout/NavBar.vue";
import PageReveal from "@/components/PageReveal.vue";
import DayLoop from "@/components/onboarding/DayLoop.vue";
import TeamCreationForm from "@/components/TeamCreationForm.vue";
import { useLeagueStore } from "@/stores/league";
import { useOnboardingStore } from "@/stores/onboarding";
import { STARTING_CREDITS } from "../../../model/team";

/**
 * First screen of a new player's game: what FantasyWiki is, next to the one
 * form they have to fill in. The app chrome stays (so the language switcher in
 * the NavBar is reachable here like everywhere else), and submitting the form
 * hands straight over to the real dashboard with the guided tour running on
 * top of it — no interstitial slideshow between signing up and playing.
 */
const { t, locale } = useI18n();
const router = useRouter();
const leagueStore = useLeagueStore();
const onboarding = useOnboardingStore();

const credits = computed(() =>
  new Intl.NumberFormat(locale.value).format(STARTING_CREDITS)
);

async function startPlaying() {
  // The player had no league a second ago, so the store NavBar populated on
  // mount is empty and the dashboard would render its "no league" card.
  // Refetching here is what makes the next screen the *populated* dashboard.
  await leagueStore.initialize();
  // Land on the dashboard first, then start narrating it: starting the tour
  // while still on this page would make the dock issue the same navigation a
  // moment before this one does.
  await router.push("/dashboard");
  onboarding.start();
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

.intro-eyebrow {
  margin: 0 0 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ion-color-primary);
}

.intro-title {
  margin: 0 0 0.75rem;
  font-size: 2rem;
  line-height: 1.15;
}

@media (min-width: 768px) {
  .intro-title {
    font-size: 2.5rem;
  }
}

.intro-lede {
  margin: 0 0 2rem;
  max-width: 34rem;
  font-size: 1.0625rem;
  line-height: 1.55;
  color: var(--ion-color-medium);
}

.intro-loop {
  max-width: 30rem;
  margin-bottom: 2rem;
}

.intro-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.75rem;
  margin: 0;
  padding: 1rem 0 0;
  border-top: 1px solid var(--ion-border-color);
  list-style: none;
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

.intro-facts strong {
  font-weight: 700;
  color: var(--ion-text-color);
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
</style>
