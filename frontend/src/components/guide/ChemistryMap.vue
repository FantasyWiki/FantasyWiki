<template>
  <figure class="chem">
    <svg
      class="chem-svg"
      viewBox="0 0 320 132"
      role="img"
      :aria-label="t('guide.chemistry.alt')"
    >
      <!-- One arrowhead per level, since a marker does not inherit the stroke
           of the line that references it. -->
      <defs>
        <marker
          v-for="level in ['excellent', 'good']"
          :id="`chem-arrow-${level}`"
          :key="level"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L8,4 L0,8 z" :class="`chem-arrowhead--${level}`" />
        </marker>
      </defs>

      <!-- Mutual link: both articles link to each other -->
      <line
        class="chem-link chem-link--excellent"
        x1="72"
        y1="88"
        x2="148"
        y2="40"
        marker-start="url(#chem-arrow-excellent)"
        marker-end="url(#chem-arrow-excellent)"
      />
      <!-- One-way link -->
      <line
        class="chem-link chem-link--good"
        x1="172"
        y1="40"
        x2="248"
        y2="88"
        marker-end="url(#chem-arrow-good)"
      />
      <!-- Both placed, neither links to the other -->
      <line
        class="chem-link chem-link--weak"
        x1="76"
        y1="100"
        x2="244"
        y2="100"
      />

      <g class="chem-node">
        <circle cx="60" cy="100" r="18" />
        <text x="60" y="105">A</text>
      </g>
      <g class="chem-node">
        <circle cx="160" cy="28" r="18" />
        <text x="160" y="33">B</text>
      </g>
      <g class="chem-node">
        <circle cx="260" cy="100" r="18" />
        <text x="260" y="105">C</text>
      </g>

      <text class="chem-value chem-value--excellent" x="96" y="52">
        {{ values.excellent }}
      </text>
      <text class="chem-value chem-value--good" x="216" y="52">
        {{ values.good }}
      </text>
      <text class="chem-value chem-value--weak" x="160" y="122">
        {{ values.weak }}
      </text>
    </svg>

    <ul class="chem-legend">
      <li>
        <span class="swatch swatch--excellent" aria-hidden="true" />
        {{ t("guide.chemistry.mutual") }}
      </li>
      <li>
        <span class="swatch swatch--good" aria-hidden="true" />
        {{ t("guide.chemistry.oneway") }}
      </li>
      <li>
        <span class="swatch swatch--weak" aria-hidden="true" />
        {{ t("guide.chemistry.none") }}
      </li>
    </ul>
  </figure>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { synergyPoints } from "../../../../model/scoring";

/**
 * What a Chemistry Link pays, drawn as the topology it actually is: a value on
 * the line between two connected spots, not a property of an article. The
 * numbers come from the game's own synergy table.
 */
const { t, locale } = useI18n();

const format = (points: number) =>
  new Intl.NumberFormat(locale.value, {
    signDisplay: points > 0 ? "always" : "never",
    minimumFractionDigits: points > 0 ? 1 : 0,
  }).format(points);

const values = computed(() => ({
  excellent: format(synergyPoints("excellent")),
  good: format(synergyPoints("good")),
  weak: format(synergyPoints("weak")),
}));
</script>

<style scoped>
.chem {
  margin: 0;
}

.chem-svg {
  display: block;
  width: 100%;
  max-width: 24rem;
  height: auto;
}

/* Level is carried by colour and nothing else, exactly as the pitch draws it:
   the same three values a player already reads on their formation. Weight is
   uniform so the eye compares hue, not thickness. */
.chem-link {
  stroke-width: 2.5;
  stroke-linecap: round;
  opacity: 0.85;
  vector-effect: non-scaling-stroke;
}

.chem-link--excellent {
  stroke: var(--chem-excellent);
}

.chem-link--good {
  stroke: var(--chem-good);
}

.chem-link--weak {
  stroke: var(--chem-weak);
}

.chem-arrowhead--excellent {
  fill: var(--chem-excellent);
}

.chem-arrowhead--good {
  fill: var(--chem-good);
}

.chem-node circle {
  fill: var(--ion-background-color);
  stroke: var(--ion-border-color);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.chem-node text {
  fill: var(--ion-color-medium);
  font-size: 13px;
  font-weight: 700;
  text-anchor: middle;
}

.chem-value {
  font-size: 13px;
  font-weight: 700;
  text-anchor: middle;
}

.chem-value--excellent {
  fill: var(--chem-excellent);
}

.chem-value--good {
  fill: var(--chem-good);
}

.chem-value--weak {
  fill: var(--chem-weak);
}

.chem-legend {
  display: grid;
  gap: 0.4rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--ion-color-medium);
}

.chem-legend li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

/* The same rounded marker the pitch legend uses. */
.swatch {
  flex-shrink: 0;
  width: 1.75rem;
  height: 4px;
  border-radius: 999px;
}

.swatch--excellent {
  background: var(--chem-excellent);
}

.swatch--good {
  background: var(--chem-good);
}

.swatch--weak {
  background: var(--chem-weak);
}
</style>
