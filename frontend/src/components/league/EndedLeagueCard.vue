<template>
  <league-card :league="league">
    <template #footer>
      <span v-if="winnerName || isLoading" class="meta-item winner">
        <ion-icon :icon="trophyOutline" aria-hidden="true" />
        {{ isLoading ? "…" : t("leagues.winner", { name: winnerName }) }}
      </span>
    </template>
  </league-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonIcon } from "@ionic/vue";
import { trophyOutline } from "ionicons/icons";
import { useI18n } from "vue-i18n";
import LeagueCard from "@/components/league/LeagueCard.vue";
import { useLeaderboard } from "@/composables/useLeaderboard";
import type { LeagueDTO } from "../../../../dto/leagueDTO";

const props = defineProps<{ league: LeagueDTO }>();

const { t } = useI18n();

/**
 * One leaderboard request per card rather than a single batched call — there
 * is no endpoint for "winners of these N leagues" (LeagueDTO deliberately
 * carries no roster, see its own comment). This stays eager rather than
 * lazy on purpose: the set behind it is the player's own ended leagues,
 * already bounded by how many leagues a friends-sized group plays — the same
 * small count the enrolled grid above renders without any lazy-load story.
 */
const { leaderboard, isLoading } = useLeaderboard(() => props.league.id);

const winnerName = computed(
  () => leaderboard.value.find((entry) => entry.rank === 1)?.team.name
);
</script>
