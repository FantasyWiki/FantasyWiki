<template>
  <section class="factsheet" :aria-label="t('league.factsheet')">
    <!-- The four facts a player comes to this page for, each given the weight of
         a figure rather than of a caption. -->
    <div class="facts">
      <div class="fact">
        <p class="fact-label">{{ t("league.factSource") }}</p>
        <a
          class="fact-value fact-value--link"
          :href="`https://${domain}.wikipedia.org`"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ domain }}<span class="fact-suffix">.wikipedia.org</span>
        </a>
      </div>

      <div class="fact">
        <p class="fact-label">{{ t("league.factTeams") }}</p>
        <p class="fact-value">{{ teamCount }}</p>
      </div>

      <div class="fact">
        <p class="fact-label">{{ t("league.factStart") }}</p>
        <p class="fact-value">{{ formatDate(league?.startDate) }}</p>
      </div>

      <div class="fact">
        <p class="fact-label">{{ t("league.factEnd") }}</p>
        <p class="fact-value">{{ formatDate(league?.endDate) }}</p>
      </div>
    </div>

    <!-- The run: how much season is left is the one number that changes every
         day, so it gets a line of its own and a bar to read at a glance. A
         finished season has nothing left to fill, so it states its length and
         drops the bar rather than showing one pinned at 100%. -->
    <div class="run" :class="`run--${phase ?? 'upcoming'}`">
      <div class="run-head">
        <span class="run-headline">{{ runHeadline }}</span>
        <span v-if="phase === 'active'" class="run-detail">
          {{ t("league.runDay", { day: dayOfSeason, total: totalDays }) }}
        </span>
      </div>
      <div
        v-if="phase !== 'ended'"
        class="run-track"
        role="progressbar"
        :aria-label="t('league.runProgressLabel')"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(progress * 100)"
      >
        <div class="run-fill" :style="{ width: `${progress * 100}%` }" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Temporal } from "@js-temporal/polyfill";
import { useI18n } from "vue-i18n";
import { useLeagueCalendar } from "@/composables/useLeagueCalendar";
import type { LeagueDTO } from "../../../../dto/leagueDTO";

const props = defineProps<{
  league: LeagueDTO | undefined;
  teamCount: number;
}>();

const { t, locale } = useI18n();

const { phase, totalDays, dayOfSeason, daysLeft, daysToStart, progress } =
  useLeagueCalendar(() => props.league);

const domain = computed(() => props.league?.domain ?? "en");

/**
 * Rendered on the UTC calendar, matching `useLeagueCalendar`. Formatting the
 * instant in the viewer's zone would put "Ends 29 Feb" next to a run that
 * counts the season as ending on the 28th — the same date disagreeing with
 * itself one line apart.
 */
function formatDate(instant: Temporal.Instant | undefined): string {
  if (!instant) return "—";
  return instant
    .toZonedDateTimeISO("UTC")
    .toPlainDate()
    .toLocaleString(locale.value, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
}

const runHeadline = computed(() => {
  switch (phase.value) {
    case "upcoming":
      return t(
        "league.runUpcoming",
        { days: daysToStart.value },
        daysToStart.value
      );
    case "ended":
      return t("league.runEnded", { days: totalDays.value }, totalDays.value);
    case "active":
      // The last day has no days left to count; "0 days left" reads as a bug on
      // the one day the league is most worth watching.
      return daysLeft.value === 0
        ? t("league.runFinalDay")
        : t("league.runLeft", { days: daysLeft.value }, daysLeft.value);
    default:
      return "—";
  }
});
</script>

<style scoped>
.factsheet {
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background, var(--ion-background-color));
  padding: 1rem 1.125rem;
  margin-bottom: 1.25rem;
}

/* ── Facts ─────────────────────────────────────── */
.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.875rem 1.25rem;
}

@media (min-width: 640px) {
  .facts {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.fact {
  min-width: 0;
}

.fact-label {
  margin: 0 0 2px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}

.fact-value {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--ion-text-color);
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .fact-value {
    font-size: 1.1875rem;
  }
}

.fact-value--link {
  display: block;
  text-decoration: none;
  color: var(--ion-color-primary);
}

.fact-value--link:hover {
  text-decoration: underline;
}

/* The host is the fact; the suffix is only there to make it a real address. */
.fact-suffix {
  font-weight: 500;
  color: var(--ion-color-medium);
}

/* ── Run ───────────────────────────────────────── */
.run {
  margin-top: 1.125rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--ion-border-color);
}

.run-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

/* No bar follows, so the headline needs no gap under it. */
.run--ended .run-head {
  margin-bottom: 0;
}

.run-headline {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.run--ended .run-headline {
  color: var(--ion-color-medium);
}

.run-detail {
  font-size: 0.78rem;
  color: var(--ion-color-medium);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.run-track {
  height: 6px;
  border-radius: 999px;
  background: var(--ion-background-color-step-100);
  overflow: hidden;
}

.run-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--ion-color-primary);
  transition: width 0.4s ease;
}

.run--upcoming .run-fill {
  background: var(--ion-color-medium);
}
</style>
