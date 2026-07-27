<template>
  <nav-bar>
    <page-reveal class="guide">
      <header class="guide-head">
        <h1 class="guide-title">{{ t("guide.title") }}</h1>
        <p class="guide-lede">{{ t("guide.lede") }}</p>
      </header>

      <section class="guide-section">
        <h2 class="section-title">{{ t("guide.day.title") }}</h2>
        <day-loop class="section-figure" />
        <p class="section-text">{{ t("guide.day.body") }}</p>
      </section>

      <section class="guide-section">
        <h2 class="section-title">{{ t("guide.contrast.title") }}</h2>
        <p class="section-text section-text--lead">
          {{ t("guide.contrast.body") }}
        </p>
        <spike-vs-steady class="section-figure" />
        <p class="section-text">{{ t("guide.contrast.takeaway") }}</p>
      </section>

      <section class="guide-section">
        <h2 class="section-title">{{ t("guide.points.title") }}</h2>
        <points-ladder class="section-figure" />
        <p class="section-text">{{ t("guide.points.floor") }}</p>
      </section>

      <section class="guide-section">
        <h2 class="section-title">{{ t("guide.chemistry.title") }}</h2>
        <chemistry-map class="section-figure" />
        <p class="section-text">{{ t("guide.chemistry.body") }}</p>
        <p class="section-text">
          {{ t("guide.chemistry.cap", { cap: synergyCap }) }}
        </p>
      </section>

      <section class="guide-section">
        <h2 class="section-title">{{ t("guide.contracts.title") }}</h2>

        <ul class="tier-row">
          <li v-for="tier in tiers" :key="tier.label">
            <span class="tier-days">{{ tier.days }}</span>
            <span class="tier-label">{{ tier.label }}</span>
          </li>
        </ul>

        <dl class="rule-list">
          <div>
            <dt>{{ t("guide.contracts.holdTitle") }}</dt>
            <dd>{{ t("guide.contracts.hold") }}</dd>
          </div>
          <div>
            <dt>{{ t("guide.contracts.sellTitle") }}</dt>
            <dd>{{ t("guide.contracts.sell") }}</dd>
          </div>
          <div>
            <dt>{{ t("guide.contracts.renewTitle") }}</dt>
            <dd>{{ t("guide.contracts.renew") }}</dd>
          </div>
        </dl>

        <p class="section-text">
          {{ t("guide.contracts.budget", { credits: startingCredits }) }}
        </p>
        <p class="section-text">{{ t("guide.contracts.free") }}</p>
      </section>

      <footer class="guide-foot">
        <ion-button
          v-if="appStore.isAuthenticated"
          router-link="/dashboard?tour=1"
          color="primary"
          fill="solid"
          size="small"
        >
          {{ t("guide.replay") }}
        </ion-button>
        <ion-button
          v-else
          color="primary"
          fill="solid"
          size="small"
          @click="appStore.openLoginModal()"
        >
          {{ t("guide.signIn") }}
        </ion-button>
      </footer>
    </page-reveal>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { IonButton } from "@ionic/vue";
import NavBar from "@/layout/NavBar.vue";
import PageReveal from "@/components/PageReveal.vue";
import DayLoop from "@/components/onboarding/DayLoop.vue";
import PointsLadder from "@/components/guide/PointsLadder.vue";
import SpikeVsSteady from "@/components/guide/SpikeVsSteady.vue";
import ChemistryMap from "@/components/guide/ChemistryMap.vue";
import { useAppStore } from "@/stores/app";
import { TIER_DAYS } from "../../../model/pricing";
import { TEAM_SYNERGY_CAP } from "../../../model/scoring";
import { STARTING_CREDITS } from "../../../model/team";

/**
 * The rules, for a player: what happens to you, in the order you meet it.
 * Every number on this page is read from the shared game model rather than
 * written into the copy, so the guide cannot quietly go out of date, and every
 * figure is a picture of a rule the player can act on.
 *
 * Public on purpose (no session needed), which is why the closing call to
 * action has a signed-out branch.
 */
const { t, locale } = useI18n();
const appStore = useAppStore();

const tiers = computed(() => [
  { days: TIER_DAYS.SHORT, label: t("guide.contracts.shortDays") },
  { days: TIER_DAYS.MEDIUM, label: t("guide.contracts.mediumDays") },
  { days: TIER_DAYS.LONG, label: t("guide.contracts.longDays") },
]);

const startingCredits = computed(() =>
  new Intl.NumberFormat(locale.value).format(STARTING_CREDITS)
);

const synergyCap = computed(() =>
  new Intl.NumberFormat(locale.value).format(TEAM_SYNERGY_CAP)
);
</script>

<style scoped>
.guide {
  max-width: 44rem;
  margin: 0 auto;
  padding: 1rem 0 1.5rem;
}

.guide-head {
  padding-bottom: 2rem;
}

.guide-title {
  margin: 0 0 0.5rem;
  font-size: 2rem;
  line-height: 1.15;
}

@media (min-width: 768px) {
  .guide-title {
    font-size: 2.5rem;
  }
}

.guide-lede {
  margin: 0;
  max-width: 32rem;
  font-size: 1.0625rem;
  line-height: 1.55;
  color: var(--ion-color-medium);
}

/* Sections are separated by rule and rhythm rather than boxed into cards, so
   the page reads as one document and the figures stay the loudest thing on it. */
.guide-section {
  padding: 2.25rem 0;
  border-top: 1px solid var(--ion-border-color);
}

.section-title {
  margin: 0 0 1rem;
  font-size: 1.25rem;
  line-height: 1.3;
}

.section-figure {
  margin: 1.25rem 0;
}

.section-text {
  margin: 0.75rem 0 0;
  max-width: 38rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--ion-color-medium);
}

.section-text--lead {
  margin-top: 0;
}

.tier-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 2.5rem;
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
}

.tier-row li {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.tier-days {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ion-color-primary);
}

.tier-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

.rule-list {
  margin: 0;
  display: grid;
  gap: 1rem;
}

.rule-list dt {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.rule-list dd {
  margin: 0.2rem 0 0;
  max-width: 38rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--ion-color-medium);
}

.guide-foot {
  padding-top: 2rem;
  border-top: 1px solid var(--ion-border-color);
}
</style>
