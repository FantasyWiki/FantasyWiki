<template>
  <!-- A button, not a card with a button in it: the whole tile is the target,
       which is what makes it work on a phone and keeps it tab-reachable. -->
  <button
    type="button"
    class="league-card"
    :class="{ 'league-card--active': isActive }"
    @click="router.push({ name: 'League', params: { leagueId: league.id } })"
  >
    <span class="icon-tile" aria-hidden="true">{{ league.icon }}</span>

    <span class="body">
      <span class="name-row">
        <span class="name">{{ league.title }}</span>
        <span v-if="isActive" class="active-badge">
          {{ t("leagues.active") }}
        </span>
      </span>

      <span class="meta">
        <span class="meta-item">
          <ion-icon :icon="peopleOutline" aria-hidden="true" />
          {{
            t(
              "leagues.participants",
              { count: league.teamCount },
              league.teamCount
            )
          }}
        </span>
        <span class="meta-item">
          <ion-icon :icon="globeOutline" aria-hidden="true" />
          {{ league.domain }}.wikipedia
        </span>
        <!-- Only private is worth saying. Marking every public league "public"
             would put a label on the unremarkable case and make the grid
             noisier without telling anyone anything. -->
        <span v-if="isPrivate" class="meta-item">
          <ion-icon :icon="lockClosedOutline" aria-hidden="true" />
          {{ t("leagues.private") }}
        </span>
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonIcon } from "@ionic/vue";
import { globeOutline, lockClosedOutline, peopleOutline } from "ionicons/icons";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useLeagueStore } from "@/stores/league";
import type { LeagueDTO } from "../../../../dto/leagueDTO";
import { LeagueVisibility } from "../../../../model/enums";

const props = defineProps<{ league: LeagueDTO }>();

const { t } = useI18n();
const router = useRouter();
const leagueStore = useLeagueStore();

// The league every other page is currently scoped to, marked so the grid and
// the NavBar switcher never disagree about which one is in play.
const isActive = computed(
  () => leagueStore.currentLeagueId === props.league.id
);

const isPrivate = computed(
  () => props.league.visibility === LeagueVisibility.PRIVATE
);
</script>

<style scoped>
.league-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  text-align: start;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-card-background, var(--ion-background-color));
  padding: 1rem;
  cursor: pointer;
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.league-card:hover {
  box-shadow: 0 2px 10px rgb(0 0 0 / 8%);
}

.league-card--active {
  border-color: var(--ion-color-primary);
  background: rgb(var(--ion-color-primary-rgb) / 5%);
}

.icon-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.5rem;
  width: 2.5rem;
  flex-shrink: 0;
  border-radius: 10px;
  background: rgb(var(--ion-color-primary-rgb) / 10%);
  font-size: 1.25rem;
  line-height: 1;
}

.body {
  display: block;
  min-width: 0;
  flex: 1;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.name {
  font-weight: 600;
  color: var(--ion-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-badge {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--ion-background-color-step-100);
  color: var(--ion-color-medium);
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 2px;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-item ion-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
}
</style>
