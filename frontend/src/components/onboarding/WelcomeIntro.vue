<template>
  <section class="start-intro">
    <p class="intro-eyebrow">{{ t("onboarding.start.eyebrow") }}</p>
    <h1 class="intro-title">{{ t("onboarding.start.title") }}</h1>
    <p class="intro-lede">{{ t("onboarding.start.lede") }}</p>

    <day-loop class="intro-loop" />

    <ul class="intro-facts">
      <li>
        <strong>{{ t("onboarding.start.creditsValue", { credits }) }}</strong>
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
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import DayLoop from "@/components/onboarding/DayLoop.vue";
import { STARTING_CREDITS } from "../../../../model/team";

/**
 * What FantasyWiki is, for a player seeing it for the first time. It is
 * deliberately separate from the team-creation form it sits beside: joining a
 * *further* league later runs the same form without any of this, and a player
 * who already has a team should never be told what the game is again.
 */
const { t, locale } = useI18n();

const credits = computed(() =>
  new Intl.NumberFormat(locale.value).format(STARTING_CREDITS)
);
</script>

<style scoped>
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
</style>
