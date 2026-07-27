<template>
  <figure class="ladder">
    <svg
      class="ladder-svg"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="t('guide.points.alt')"
    >
      <!-- Point gridlines -->
      <g class="grid">
        <template v-for="p in GRID_POINTS" :key="`g${p}`">
          <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(p)" :y2="y(p)" />
        </template>
      </g>

      <!-- The curve itself, sampled from the real scoring rule -->
      <polyline class="curve" :points="curve" />

      <!-- Rungs a player can check against the table below -->
      <g class="rungs">
        <template v-for="rung in RUNGS" :key="rung.views">
          <line
            :x1="x(rung.views)"
            :x2="x(rung.views)"
            :y1="y(0)"
            :y2="y(points(rung.views))"
          />
          <circle :cx="x(rung.views)" :cy="y(points(rung.views))" r="3.5" />
        </template>
      </g>
    </svg>

    <!-- Axis labels live in HTML, not SVG text: they stay selectable, scale
         with the reader's font size and never distort with the viewBox. -->
    <ol class="ladder-scale">
      <li
        v-for="rung in RUNGS"
        :key="`l${rung.views}`"
        :style="{ left: `${(x(rung.views) / W) * 100}%` }"
      >
        <span class="scale-views">{{ format(rung.views) }}</span>
        <span class="scale-points">
          {{
            t(
              "guide.points.worth",
              { points: pointsLabel(rung.views) },
              Math.round(points(rung.views))
            )
          }}
        </span>
      </li>
    </ol>

    <figcaption class="ladder-caption">{{ t("guide.points.rule") }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { basePoints } from "../../../../model/scoring";

/**
 * The scoring curve, drawn by calling the game's own `basePoints` rather than
 * traced by hand, so the picture cannot drift from what the backend scores.
 *
 * Readers run on a **plain linear axis**, deliberately: a log axis would
 * straighten the doubling stretch and bend the flat-rate tail upwards, showing
 * the reader the exact opposite of the shape the rule describes. On this axis
 * the picture says what the caption says — steep early returns that flatten
 * out, then a straight climb once the tail takes over at 150,000.
 */
const { t, locale } = useI18n();

const W = 320;
const H = 150;
const PAD = { l: 8, r: 8, t: 10, b: 8 };

/** Where the curve crosses zero; also the left edge of the drawing. */
const MIN_VIEWS = 2_000;
const MAX_VIEWS = 250_000;
const MAX_POINTS = 9;

/** Point levels the gridlines sit on. */
const GRID_POINTS = [0, 3, 6, 9] as const;

/**
 * The anchor of the doubling stretch and the point where the tail takes over.
 * Both sit far enough from the edges for their labels to stay inside the frame.
 */
const RUNGS = [{ views: 32_000 }, { views: 150_000 }] as const;

const points = basePoints;

function x(views: number): number {
  const ratio = (views - MIN_VIEWS) / (MAX_VIEWS - MIN_VIEWS);
  return PAD.l + ratio * (W - PAD.l - PAD.r);
}

function y(pts: number): number {
  const ratio = pts / MAX_POINTS;
  return H - PAD.b - ratio * (H - PAD.t - PAD.b);
}

const curve = computed(() => {
  // Sampled geometrically but drawn linearly: that puts the most samples where
  // the curve actually bends, and the straight tail needs barely any.
  const samples = 120;
  return Array.from({ length: samples + 1 }, (_, i) => {
    const views = MIN_VIEWS * Math.pow(MAX_VIEWS / MIN_VIEWS, i / samples);
    return `${x(views).toFixed(1)},${y(points(views)).toFixed(1)}`;
  }).join(" ");
});

const format = (views: number) =>
  new Intl.NumberFormat(locale.value, {
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(views);

const pointsLabel = (views: number) =>
  new Intl.NumberFormat(locale.value, {
    maximumFractionDigits: 1,
  }).format(Math.round(points(views) * 10) / 10);
</script>

<style scoped>
.ladder {
  margin: 0;
}

.ladder-svg {
  display: block;
  width: 100%;
  height: auto;
}

.grid line {
  stroke: var(--ion-border-color);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.curve {
  fill: none;
  stroke: var(--ion-color-primary);
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.rungs line {
  stroke: var(--ion-color-primary);
  stroke-width: 1;
  stroke-dasharray: 2 3;
  opacity: 0.55;
  vector-effect: non-scaling-stroke;
}

.rungs circle {
  fill: var(--ion-color-primary);
}

/* Each label sits under the rung it belongs to, positioned with the same
   scale function the curve uses, so the two can never drift apart. */
.ladder-scale {
  position: relative;
  height: 2.5rem;
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
}

.ladder-scale li {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  min-width: 4.25rem;
  text-align: center;
  transform: translateX(-50%);
}

.scale-views {
  font-size: 0.8125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ion-text-color);
}

.scale-points {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.ladder-caption {
  margin-top: 0.9rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--ion-color-medium);
}
</style>
