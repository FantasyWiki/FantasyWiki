<template>
  <div class="contrast">
    <article v-for="c in cases" :key="c.id" class="case">
      <h3 class="case-title">{{ c.title }}</h3>

      <svg
        class="case-chart"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        :aria-label="c.alt"
      >
        <polyline class="case-line" :points="c.line" />
        <line class="case-base" :x1="0" :x2="W" :y1="H - 1" :y2="H - 1" />
      </svg>
      <p class="case-axis">{{ t("guide.contrast.axis") }}</p>

      <dl class="case-readout">
        <div>
          <dt>{{ t("guide.contrast.pointsToday") }}</dt>
          <dd class="readout-points">{{ c.points }}</dd>
        </div>
        <div>
          <dt>{{ t("guide.contrast.pricedOn") }}</dt>
          <dd>{{ t("guide.contrast.readersPerDay", { views: c.priceOn }) }}</dd>
        </div>
      </dl>

      <p class="case-note">{{ c.note }}</p>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { basePoints } from "../../../../model/scoring";

/**
 * The one thing a player has to internalise: points are paid on *today's*
 * readers, prices are set by the *last 30 days*. Two articles, same month, very
 * different bills.
 *
 * Both series are drawn on the same vertical scale, and every number under them
 * is computed from the series by the game's own scoring curve, so the
 * comparison is not a flattering illustration.
 */
const { t, locale } = useI18n();

const W = 240;
const H = 64;

/** A quiet article that broke out today. Views in thousands, 30 days. */
const SPIKE_DAYS = [
  3, 2.8, 3.2, 3, 2.6, 3.4, 3.1, 2.9, 3, 3.3, 2.7, 3, 3.2, 2.8, 3.1, 3, 2.9,
  3.4, 3, 2.6, 3.2, 3, 3.1, 2.8, 3, 3.3, 2.9, 3.1, 3, 200,
].map((k) => k * 1_000);

/** A page that is read heavily every single day. */
const STEADY_DAYS = [
  58, 61, 59, 63, 60, 57, 62, 60, 59, 64, 61, 58, 60, 62, 59, 61, 60, 63, 58,
  60, 62, 59, 61, 60, 58, 63, 60, 59, 62, 60,
].map((k) => k * 1_000);

const PEAK = Math.max(...SPIKE_DAYS, ...STEADY_DAYS);

function line(series: number[]): string {
  const step = W / (series.length - 1);
  return series
    .map((views, i) => {
      const y = H - 2 - (views / PEAK) * (H - 6);
      return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const average = (series: number[]) =>
  series.reduce((sum, v) => sum + v, 0) / series.length;

const compact = (views: number) =>
  new Intl.NumberFormat(locale.value, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(views);

const pointsLabel = (views: number) =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(
    Math.round(basePoints(views) * 10) / 10
  );

const cases = computed(() => [
  {
    id: "spike",
    title: t("guide.contrast.spike.title"),
    alt: t("guide.contrast.spike.alt"),
    line: line(SPIKE_DAYS),
    points: pointsLabel(SPIKE_DAYS[SPIKE_DAYS.length - 1]),
    priceOn: compact(average(SPIKE_DAYS)),
    note: t("guide.contrast.spike.note"),
  },
  {
    id: "steady",
    title: t("guide.contrast.steady.title"),
    alt: t("guide.contrast.steady.alt"),
    line: line(STEADY_DAYS),
    points: pointsLabel(STEADY_DAYS[STEADY_DAYS.length - 1]),
    priceOn: compact(average(STEADY_DAYS)),
    note: t("guide.contrast.steady.note"),
  },
]);
</script>

<style scoped>
.contrast {
  display: grid;
  gap: 1.75rem;
}

@media (min-width: 640px) {
  .contrast {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2.5rem;
  }
}

.case-title {
  margin: 0 0 0.6rem;
  font-family: var(--ion-font-family);
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.case-chart {
  display: block;
  width: 100%;
  height: auto;
}

.case-line {
  fill: none;
  stroke: var(--ion-color-primary);
  stroke-width: 1.5;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.case-base {
  stroke: var(--ion-border-color);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.case-axis {
  margin: 0.3rem 0 0.9rem;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}

.case-readout {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

.case-readout > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--ion-border-color);
}

.case-readout dt {
  font-size: 0.8125rem;
  color: var(--ion-color-medium);
}

.case-readout dd {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ion-text-color);
}

.readout-points {
  color: var(--ion-color-primary);
}

.case-note {
  margin: 0.75rem 0 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--ion-color-medium);
}
</style>
