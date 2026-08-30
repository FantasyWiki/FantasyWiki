<template>
  <figure class="day-loop">
    <figcaption class="loop-caption">
      {{ t("onboarding.loop.caption") }}
    </figcaption>

    <ol class="loop-track">
      <li class="loop-beat">
        <span class="beat-glyph" aria-hidden="true">
          <ion-icon aria-hidden="true" :icon="documentTextOutline" />
        </span>
        <span class="beat-value">{{ t("onboarding.loop.holdValue") }}</span>
        <span class="beat-label">{{ t("onboarding.loop.hold") }}</span>
      </li>

      <li class="loop-beat">
        <span class="beat-glyph" aria-hidden="true">
          <ion-icon aria-hidden="true" :icon="eyeOutline" />
        </span>
        <span class="beat-value">{{ readers }}</span>
        <span class="beat-label">{{ t("onboarding.loop.read") }}</span>
      </li>

      <li class="loop-beat loop-beat--score">
        <span class="beat-glyph" aria-hidden="true">
          <ion-icon aria-hidden="true" :icon="starOutline" />
        </span>
        <span class="beat-value">
          {{ t("onboarding.loop.scoreValue", { points: scored }) }}
        </span>
        <span class="beat-label">{{ t("onboarding.loop.score") }}</span>
      </li>
    </ol>
  </figure>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { IonIcon } from "@ionic/vue";
import { documentTextOutline, eyeOutline, starOutline } from "ionicons/icons";
import { basePoints } from "../../../../model/scoring";

/**
 * The core loop in one line of pictures: an article you hold, the people who
 * read it today, the points that lands you.
 *
 * The example is scored by the game's own curve rather than written into the
 * copy, so it agrees with the ladder on the guide page by construction.
 */
const EXAMPLE_READERS = 32_000;

const { t, locale } = useI18n();

const readers = computed(() =>
  new Intl.NumberFormat(locale.value).format(EXAMPLE_READERS)
);

const scored = computed(() =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(
    Math.round(basePoints(EXAMPLE_READERS) * 10) / 10
  )
);
</script>

<style scoped>
.day-loop {
  margin: 0;
}

.loop-caption {
  margin-bottom: 0.75rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}

/* The rule runs behind the beats and is what makes this read as one flow
   rather than three tiles. */
.loop-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.loop-track::before {
  content: "";
  position: absolute;
  top: 1.125rem;
  left: 16%;
  right: 16%;
  border-top: 1px dashed var(--ion-border-color);
}

.loop-beat {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.3rem;
}

.beat-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  color: var(--ion-color-medium);
  font-size: 1.125rem;
}

.loop-beat--score .beat-glyph {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.beat-value {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ion-text-color);
  font-variant-numeric: tabular-nums;
}

.loop-beat--score .beat-value {
  color: var(--ion-color-primary);
}

.beat-label {
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--ion-color-medium);
}
</style>
