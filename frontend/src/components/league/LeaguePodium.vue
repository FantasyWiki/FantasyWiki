<template>
  <section
    class="podium-wrap"
    :class="`podium-wrap--${variant}`"
    :aria-label="
      variant === 'final'
        ? t('league.podiumLabel')
        : t('league.podiumLabelLive')
    "
  >
    <p class="podium-eyebrow">
      {{
        variant === "final" ? t("league.podiumFinal") : t("league.podiumLive")
      }}
    </p>

    <!-- Silver, gold, bronze in that visual order — a podium reads centre-first,
         so the winner sits in the middle on its tallest block. The DOM keeps
         rank order (1, 2, 3) for anyone reading it linearly; `order` does the
         staging. -->
    <ol class="podium">
      <li
        v-for="step in steps"
        :key="step.entry.team.id"
        class="step"
        :class="[`step--${step.entry.rank}`, { 'step--me': step.isMine }]"
        :style="{ '--reveal-delay': `${step.delayMs}ms` }"
      >
        <div class="step-medal">{{ MEDALS[step.entry.rank] }}</div>
        <p class="step-team">{{ step.entry.team.name }}</p>
        <!-- Your own step is called out inside the block rather than above it:
             an extra line above would make this step taller than the other two
             and lift it off the base line the podium is built on. The block's
             height is fixed, so the badge stacks under the rank without
             displacing anything — and the rank stays readable. -->
        <div class="step-block">
          <span class="step-rank">{{ step.entry.rank }}</span>
          <ion-badge v-if="step.isMine" color="primary" class="step-you">
            {{ t("league.you") }}
          </ion-badge>
        </div>
        <!-- Points sit under the block, on the base line the three steps share,
             so the figures read as one row across the podium. -->
        <p class="step-points">
          {{ t("league.podiumPoints", { points: format(step.entry) }) }}
        </p>
        <!-- Movement, live only: while the season runs, whether a leader is
             climbing or slipping is the interesting half of the standing. Once
             it is over there is nothing left to move, so the final podium drops
             it. Rendered for all three steps (blank when static) to keep the
             steps the same height and the base line intact. -->
        <p
          v-if="variant === 'live'"
          class="step-trend"
          :class="step.trend.cssClass"
        >
          <ion-icon
            aria-hidden="true"
            v-if="step.trend.icon"
            :icon="step.trend.icon"
          />
          <span>{{ step.trend.label }}</span>
        </p>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonBadge, IonIcon } from "@ionic/vue";
import { trendingDownOutline, trendingUpOutline } from "ionicons/icons";
import { useI18n } from "vue-i18n";
import type { LeaderboardEntryDTO } from "../../../../dto/leaderboardDTO";

const props = defineProps<{
  /** The full standings, already rank-ordered by the backend. */
  leaderboard: LeaderboardEntryDTO[];
  myTeamId: string | null;
  /**
   * `live` while the season runs — a provisional top three, movement shown.
   * `final` once it is over — the result, staged as one.
   *
   * The podium is not held back for the finale: a target only motivates while it
   * can still be reached, and in a friends-sized league the top three is both
   * reachable and made of people the player knows. What the finale gets is a
   * different treatment, not the only one — otherwise the season's end has no
   * moment of its own.
   */
  variant: "live" | "final";
}>();

const { t, locale } = useI18n();

// The crown for the winner, medals for the other two — the same marks the
// standings rows use for ranks 1–3, so a team keeps its emblem between the
// podium and the table.
const MEDALS: Record<number, string> = { 1: "👑", 2: "🥈", 3: "🥉" };

/**
 * Up to three steps. A league that finished with one or two teams still gets a
 * podium — a short one — rather than nothing: the winner is the point.
 *
 * The stagger runs bronze → silver → gold so the eye lands on the winner last.
 */
const steps = computed(() =>
  props.leaderboard.slice(0, 3).map((entry) => ({
    entry,
    isMine: props.myTeamId !== null && entry.team.id === props.myTeamId,
    delayMs: (3 - entry.rank) * 140,
    trend: trend(entry),
  }))
);

/** Same reading of `rankDelta` the standings rows use, minus the flat-line icon. */
function trend(entry: LeaderboardEntryDTO): {
  icon: string | null;
  cssClass: string;
  label: string;
} {
  const delta = entry.rankDelta;
  if (delta == null || delta === 0)
    return { icon: null, cssClass: "step-trend--flat", label: "" };
  if (delta > 0)
    return {
      icon: trendingUpOutline,
      cssClass: "step-trend--up",
      label: `+${delta}`,
    };
  return {
    icon: trendingDownOutline,
    cssClass: "step-trend--down",
    label: `${delta}`,
  };
}

function format(entry: LeaderboardEntryDTO): string {
  return entry.cumulativePoints.toLocaleString(locale.value, {
    maximumFractionDigits: 1,
  });
}
</script>

<style scoped>
.podium-wrap {
  margin-bottom: 1.5rem;
}

.podium-eyebrow {
  margin: 0 0 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ion-color-medium);
  text-align: center;
}

.podium {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .podium {
    gap: 1rem;
  }
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  text-align: center;
  animation: rise 0.5s cubic-bezier(0.2, 0.8, 0.25, 1) backwards;
  animation-delay: var(--reveal-delay);
}

/* Gold centre, silver left, bronze right. */
.step--1 {
  order: 2;
}
.step--2 {
  order: 1;
}
.step--3 {
  order: 3;
}

.step-medal {
  font-size: 1.5rem;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.step--1 .step-medal {
  font-size: 2.25rem;
}

.step-team {
  margin: 0;
  font-weight: 700;
  font-size: 0.8rem;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step--1 .step-team {
  font-size: 0.95rem;
}

/* ── Your own step ─────────────────────────────── */
/* A tinted name was too quiet to find at a glance. The step gets a badge, a
   ring in the brand colour and a lifted block, so it is the thing the eye
   catches even when it is not the winner's. */
.step--me .step-team {
  color: var(--ion-color-primary);
}

.step-you {
  font-size: 0.6rem;
  height: 1.15rem;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  letter-spacing: 0.04em;
}

.step--me .step-block {
  border-color: var(--ion-color-primary);
  border-width: 2px;
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.16);
}

.step--me .step-rank {
  color: var(--ion-color-primary);
  opacity: 0.9;
}

.step--me .step-points {
  color: var(--ion-color-primary);
  font-weight: 700;
}

/* Sized and weighted like the standings' points column — the same figure in the
   same league should not shrink between the podium and the table.
   One size for all three: `align-items: end` aligns the bottom of each step, so
   a taller winner's points line would push the gold block up off the base line
   the podium depends on. The winner is set apart by colour, not by size. */
.step-points {
  margin: 0.45rem 0 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--ion-color-medium);
  font-variant-numeric: tabular-nums;
}

.step--1 .step-points {
  color: var(--ion-text-color);
}

/* Movement line, live podium only. Always occupies its row so the three steps
   stay the same height even when nobody moved. */
.step-trend {
  margin: 0.2rem 0 0;
  min-height: 1rem;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.72rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.step-trend ion-icon {
  font-size: 0.8rem;
}

.step-trend--up {
  color: var(--ion-color-success);
}
.step-trend--down {
  color: var(--ion-color-danger);
}
.step-trend--flat {
  color: var(--ion-color-medium);
}

/* ── Live vs final ─────────────────────────────── */
/* The live podium is provisional and says so by being quieter: shorter blocks,
   no glow. The final one is the season's result and is allowed the ceremony —
   otherwise a podium the player has seen every day has nothing left to give on
   the day it matters most. */
.podium-wrap--final .step--1 .step-block {
  box-shadow:
    0 0 0 1px rgba(212, 175, 55, 0.35),
    0 6px 20px -6px rgba(212, 175, 55, 0.55);
}

/* Winning it yourself: keep the "this is you" ring, and the champion's glow on
   top of it. Declared after both so neither rule silently drops the other. */
.podium-wrap--final .step--1.step--me .step-block {
  box-shadow:
    0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.2),
    0 6px 22px -6px rgba(212, 175, 55, 0.6);
}

.podium-wrap--final .step--1 .step-medal {
  font-size: 2.5rem;
}

.podium-wrap--final .podium-eyebrow {
  color: var(--ion-text-color);
  font-weight: 700;
}

/* The block itself: heights are what makes the three read as one podium. Closed
   on all four sides because the points line now sits below it — the blocks share
   a base line with each other rather than with the bottom of the section. */
.step-block {
  width: 100%;
  box-sizing: border-box;
  border-radius: 8px 8px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0 0.25rem;
  font-weight: 800;
  border: 1px solid var(--ion-border-color);
}

.step-rank {
  font-size: 1.1rem;
  opacity: 0.55;
}

/* Bronze is the shortest block; on a narrow screen the rank and the badge
   together fill it, so the numeral gives up a little size rather than the badge
   overflowing. */
@media (max-width: 639px) {
  .step--3 .step-rank {
    font-size: 0.9rem;
  }
}

/* Each step wears its own metal. Literal gold/silver/bronze rather than theme
   colours: the medals above them are already those three, and the blocks reading
   as the same material is what ties medal to step. */
.step--1 .step-block {
  height: 5.5rem;
  background: linear-gradient(
    180deg,
    rgba(212, 175, 55, 0.5),
    rgba(212, 175, 55, 0.12)
  );
  border-color: rgba(212, 175, 55, 0.65);
}

.step--2 .step-block {
  height: 3.75rem;
  background: linear-gradient(
    180deg,
    rgba(168, 172, 178, 0.45),
    rgba(168, 172, 178, 0.1)
  );
  border-color: rgba(168, 172, 178, 0.6);
}

.step--3 .step-block {
  height: 2.75rem;
  background: linear-gradient(
    180deg,
    rgba(176, 111, 66, 0.42),
    rgba(176, 111, 66, 0.1)
  );
  border-color: rgba(176, 111, 66, 0.6);
}

/* ── Light mode only ───────────────────────────── */
/* Those translucent metals are built for a dark page. Over a light one they wash
   out to three near-identical pale bands: the podium stops reading as a podium
   and the rank inside it stops being legible. Light mode gets the same three
   metals as solid fills, with dark ink to sit on them.
   Scoped to `body:not(.ion-palette-dark)` — the class the app store toggles — so
   dark mode keeps exactly the treatment above, untouched.

   Written as a plain descendant selector, never `:global(body…) .step-block`:
   Vue's `:global()` keeps only what is inside the parentheses and throws the
   rest of the selector away, so that spelling compiled to a bare
   `body:not(.ion-palette-dark) { … }` and painted the whole document in the
   third step's bronze. Scoping needs no help here — the scope attribute goes on
   the last compound selector, and `body` is only an ancestor. */
body:not(.ion-palette-dark) .step--1 .step-block {
  background: linear-gradient(180deg, #f0d271 0%, #dcb840 100%);
  border-color: #bf9a2c;
  color: #43340a;
}

body:not(.ion-palette-dark) .step--2 .step-block {
  background: linear-gradient(180deg, #dfe3e8 0%, #c1c7cf 100%);
  border-color: #9aa1aa;
  color: #333a41;
}

body:not(.ion-palette-dark) .step--3 .step-block {
  background: linear-gradient(180deg, #e0aa7d 0%, #c4854f 100%);
  border-color: #a06a37;
  color: #46280f;
}

/* Solid metal needs a firmer numeral than a wash does. */
body:not(.ion-palette-dark) .step-rank {
  color: inherit;
  opacity: 0.75;
}

/* Brand green on solid gold is unreadable; the badge below already says "you". */
body:not(.ion-palette-dark) .step--me .step-rank {
  color: inherit;
  opacity: 0.85;
}

@media (min-width: 640px) {
  .step--1 .step-block {
    height: 7.5rem;
  }
  .step--2 .step-block {
    height: 5.25rem;
  }
  .step--3 .step-block {
    height: 3.75rem;
  }
}

/* A running season gets a lower-profile podium than the finale's. */
.podium-wrap--live .step--1 .step-block {
  height: 4.25rem;
}
.podium-wrap--live .step--2 .step-block {
  height: 3rem;
}
.podium-wrap--live .step--3 .step-block {
  height: 2.25rem;
}

@media (min-width: 640px) {
  .podium-wrap--live .step--1 .step-block {
    height: 5.5rem;
  }
  .podium-wrap--live .step--2 .step-block {
    height: 3.9rem;
  }
  .podium-wrap--live .step--3 .step-block {
    height: 2.9rem;
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(1.25rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .step {
    animation: none;
  }
}
</style>
