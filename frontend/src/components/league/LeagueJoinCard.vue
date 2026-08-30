<template>
  <!-- Absent for a member, and absent while we still do not know whether they
       are one: a card that offers to let a player into a league they already
       play would flash on every load of their own league page. -->
  <section v-if="show" class="join" :aria-label="t('joinLeague.ctaLabel')">
    <div class="join-text">
      <p class="join-label">{{ t("joinLeague.ctaLabel") }}</p>
      <p class="join-hint">{{ hint }}</p>
    </div>

    <ion-button size="small" :router-link="target" class="join-button">
      <ion-icon
        aria-hidden="true"
        slot="start"
        :icon="isPrivate ? keyOutline : enterOutline"
      />
      {{ isPrivate ? t("joinLeague.ctaPrivate") : t("joinLeague.ctaPublic") }}
    </ion-button>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonButton, IonIcon } from "@ionic/vue";
import { enterOutline, keyOutline } from "ionicons/icons";
import { Temporal } from "@js-temporal/polyfill";
import { useI18n } from "vue-i18n";
import { LeagueVisibility } from "../../../../model/enums";
import { isLeagueInactive } from "../../../../model/league";
import type { LeagueDTO } from "../../../../dto/leagueDTO";

/**
 * The way *into* a league from the page that describes it.
 *
 * This page is where the featured shelf already leads, and joining needs a team
 * name, so the offer belongs beside the facts a player is deciding on rather
 * than on the card they clicked to get here — league-visibility.md is explicit
 * that seeing a league and entering it are two different acts, and this is the
 * seam between them.
 *
 * Where it *sends* them depends on how the league is entered, and getting that
 * wrong is the bug this component exists to avoid: a private league's page is
 * readable by anyone with the id, so a single "join" button would march a
 * non-member into the naming form and out the other side with a 403. A public
 * league goes straight to the form; a private one goes to the code page, which
 * is the only door it has.
 */
const props = defineProps<{
  league: LeagueDTO | undefined;
  /** The player's team in this league, or null when they have none. */
  myTeamId: string | null;
  /** True while the team lookup is still in flight. */
  isPending: boolean;
}>();

const { t } = useI18n();

const isPrivate = computed(
  () => props.league?.visibility === LeagueVisibility.PRIVATE
);

const isInactive = computed(
  () => !!props.league && isLeagueInactive(props.league, Temporal.Now.instant())
);

// An ended league is still worth reading — its standings and its winner are the
// point of visiting it — but there is no longer a way in, so the offer goes
// rather than being shown broken.
const show = computed(
  () =>
    !!props.league &&
    !props.isPending &&
    props.myTeamId === null &&
    !isInactive.value
);

const target = computed(() =>
  isPrivate.value
    ? "/leagues/join"
    : `/leagues/${props.league?.id}/team-creation`
);

const hint = computed(() =>
  isPrivate.value ? t("joinLeague.ctaHintPrivate") : t("joinLeague.ctaHint")
);
</script>

<style scoped>
/* Reads as a sibling of the invite card above it — the same dashed, quiet
   frame — because both are asides to the league rather than facts about it. */
.join {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  border: 1px dashed var(--ion-border-color);
  border-radius: 12px;
  padding: 0.75rem 1.125rem;
  margin-bottom: 1.25rem;
}

.join-text {
  min-width: 0;
}

.join-label {
  margin: 0 0 2px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}

.join-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--ion-color-medium);
}

.join-button {
  margin-left: auto;
  flex-shrink: 0;
}
</style>
