import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { Temporal } from "@js-temporal/polyfill";
import type { LeagueDTO } from "../../../dto/leagueDTO";

export type LeaguePhase = "upcoming" | "active" | "ended";

/**
 * Seasons are counted in UTC calendar days, not in elapsed hours.
 *
 * A league's start and end are stored as instants on UTC day boundaries, and
 * scoring itself runs per UTC date (see the scoring cron), so the season a
 * player is being shown has to be measured on the same calendar the points are.
 * Elapsed-hours arithmetic also drags in rounding: 10 days plus a few
 * milliseconds is "day 11", and `ceil` on a float is a fragile way to say so.
 */
function utcDay(instant: Temporal.Instant): Temporal.PlainDate {
  return instant.toZonedDateTimeISO("UTC").toPlainDate();
}

function daysBetween(from: Temporal.PlainDate, to: Temporal.PlainDate): number {
  return from.until(to).days;
}

/**
 * Where a league sits in its own calendar. Derived rather than stored: a
 * `status` column would be a second truth to keep in step with the clock, and
 * it would be wrong for as long as nobody wrote to it.
 *
 * Split out of the page because two surfaces read it — the factsheet renders the
 * run, and the page decides whether the season is over and a podium is due.
 */
export function useLeagueCalendar(
  league: MaybeRefOrGetter<LeagueDTO | undefined>
) {
  const resolved = computed(() => toValue(league));

  const days = computed(() => {
    const lg = resolved.value;
    if (!lg) return null;
    return {
      start: utcDay(lg.startDate),
      end: utcDay(lg.endDate),
      today: Temporal.Now.plainDateISO("UTC"),
    };
  });

  const phase = computed<LeaguePhase | null>(() => {
    const d = days.value;
    if (!d) return null;
    if (Temporal.PlainDate.compare(d.today, d.start) < 0) return "upcoming";
    if (Temporal.PlainDate.compare(d.today, d.end) > 0) return "ended";
    return "active";
  });

  /** Length of the season in days, counting both the first and the last. */
  const totalDays = computed(() => {
    const d = days.value;
    return d ? Math.max(1, daysBetween(d.start, d.end) + 1) : 0;
  });

  /** Which day of the season today is: the opening day is day 1, not day 0. */
  const dayOfSeason = computed(() => {
    const d = days.value;
    if (!d || phase.value === "upcoming") return 0;
    return Math.min(daysBetween(d.start, d.today) + 1, totalDays.value);
  });

  /** Days of play still to come, the last day included. */
  const daysLeft = computed(() => {
    const d = days.value;
    if (!d || phase.value === "ended") return 0;
    return Math.max(0, daysBetween(d.today, d.end));
  });

  /** Days until kick-off; 0 once the league is running. */
  const daysToStart = computed(() => {
    const d = days.value;
    if (!d || phase.value !== "upcoming") return 0;
    return Math.max(0, daysBetween(d.today, d.start));
  });

  /** Fraction of the season already run, 0–1. */
  const progress = computed(() => {
    if (phase.value === "ended") return 1;
    if (phase.value !== "active") return 0;
    return Math.min(1, dayOfSeason.value / totalDays.value);
  });

  return {
    phase,
    totalDays,
    dayOfSeason,
    daysLeft,
    daysToStart,
    progress,
  };
}
