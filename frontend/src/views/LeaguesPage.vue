<template>
  <nav-bar>
    <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
      <ion-refresher-content />
    </ion-refresher>

    <div class="page-container">
      <!-- Hero ─────────────────────────────────────── -->
      <header class="hero">
        <h1 class="hero-title">
          <!-- The same trophy the NavBar marks this section with, so the page
               and the way into it are recognisably the same place. -->
          <ion-icon
            :icon="trophyOutline"
            class="hero-icon"
            aria-hidden="true"
          />
          {{ t("leagues.title") }}
        </h1>
        <p class="hero-subtitle">{{ t("leagues.subtitle") }}</p>
      </header>

      <!-- The two ways into a further league. Creating one works; entering an
           invitation code (#7) does not yet, so that button still states what
           is coming rather than leading somewhere that does not exist. -->
      <div class="actions">
        <ion-button fill="outline" disabled>
          <ion-icon slot="start" :icon="keyOutline" />
          {{ t("leagues.joinPrivate") }}
        </ion-button>
        <ion-button router-link="/leagues/new">
          <ion-icon slot="start" :icon="addOutline" />
          {{ t("leagues.createNew") }}
        </ion-button>
      </div>
      <p class="actions-note">{{ t("leagues.actionsNote") }}</p>

      <!-- Enrolled leagues ─────────────────────────── -->
      <!-- Four states, not two. `availableLeagues` reads empty before the first
           fetch, after a failed one, and for a player who genuinely has no
           league — telling those apart is what keeps a 500 from being announced
           as "you are not in any league yet". -->
      <div v-if="isLoading" class="league-grid" :aria-busy="true">
        <div v-for="i in 3" :key="i" class="skeleton-card">
          <ion-skeleton-text :animated="true" class="skeleton-line" />
        </div>
      </div>

      <ion-card v-else-if="error" color="danger" class="state-card">
        <ion-card-content>
          <div class="error-row">
            <ion-icon :icon="alertCircleOutline" />
            <div>
              <p class="ion-no-margin error-title">
                {{ t("leagues.errorTitle") }}
              </p>
              <p class="error-detail">{{ error }}</p>
              <ion-button
                fill="outline"
                color="light"
                size="small"
                @click="leagueStore.fetchLeagues()"
              >
                <ion-icon slot="start" :icon="refreshOutline" />
                {{ t("leagues.retry") }}
              </ion-button>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <page-reveal v-else>
        <!-- Named, because this grid and the public leagues further down look
             alike but mean opposite things: these are the leagues the player
             already fields a team in. It rides with the grid rather than
             standing above the whole block, so it never captions an error or
             an empty state — both of which say the opposite of "you're
             playing". -->
        <template v-if="leagues.length">
          <div class="section-head">
            <ion-icon :icon="flagOutline" class="section-icon mine" />
            <h2 class="section-title">{{ t("leagues.mineTitle") }}</h2>
          </div>
          <!-- `mine-grid` marks this as the enrolled set: the featured shelf
               below renders the same card, so "a league card exists" stopped
               being enough to say which grid it is in. -->
          <div class="league-grid mine-grid">
            <league-card
              v-for="league in leagues"
              :key="league.id"
              :league="league"
            />
          </div>
        </template>

        <p v-else class="empty-state">{{ t("leagues.empty") }}</p>

        <!-- Featured public leagues ────────────────── -->
        <section class="featured">
          <div class="section-head">
            <ion-icon :icon="starOutline" class="section-icon" />
            <h2 class="section-title">{{ t("leagues.featuredTitle") }}</h2>
          </div>
          <!-- Leagues the player already plays are dropped here rather than by
               the query: the endpoint answers the same list for everyone, and
               which leagues are mine is a question the store already holds. -->
          <div v-if="featuredLeagues.length" class="league-grid">
            <league-card
              v-for="league in featuredLeagues"
              :key="league.id"
              :league="league"
            />
          </div>
          <p v-else class="featured-placeholder">
            {{ t("leagues.featuredPlaceholder") }}
          </p>
        </section>
      </page-reveal>
    </div>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
} from "@ionic/vue";
import {
  addOutline,
  alertCircleOutline,
  flagOutline,
  keyOutline,
  refreshOutline,
  starOutline,
  trophyOutline,
} from "ionicons/icons";
import { useI18n } from "vue-i18n";

import NavBar from "@/layout/NavBar.vue";
import PageReveal from "@/components/PageReveal.vue";
import LeagueCard from "@/components/league/LeagueCard.vue";
import { useLeagueStore } from "@/stores/league";
import { usePublicLeagues } from "@/composables/usePublicLeagues";

const { t } = useI18n();
const leagueStore = useLeagueStore();

const leagues = computed(() => leagueStore.availableLeagues);
const error = computed(() => leagueStore.error);

const { publicLeagues } = usePublicLeagues();

/**
 * The public leagues worth offering: the ones the player is not already in.
 * Without the filter the Global League — which every player is enrolled in —
 * would head a shelf captioned as somewhere new to go.
 */
const featuredLeagues = computed(() => {
  const mine = new Set(leagues.value.map((l) => l.id));
  return publicLeagues.value.filter((l) => !mine.has(l.id));
});

/**
 * Only a *first* load gets the skeleton. A refetch keeps the list on screen and
 * lets the refresher spinner carry the news, rather than blanking a page the
 * player is reading.
 */
const isLoading = computed(
  () => leagueStore.isLoading && !leagueStore.hasLoaded
);

// The NavBar populates the store on mount, but this page is reachable as a cold
// deep link, where nothing has fetched yet.
onMounted(() => {
  if (!leagueStore.hasLoaded) leagueStore.fetchLeagues();
});

async function handleRefresh(event: CustomEvent) {
  await leagueStore.fetchLeagues();
  (event.target as HTMLIonRefresherElement).complete();
}
</script>

<style scoped>
.page-container {
  max-width: 1000px;
  margin: 0 auto;
}

@media (min-width: 1024px) {
  .page-container {
    padding-left: 2rem;
    padding-right: 2rem;
  }
}

/* ── Hero ──────────────────────────────────────── */
.hero {
  text-align: center;
  margin-bottom: 1.5rem;
}

.hero-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0 0 0.5rem;
  font-family: var(--font-family-headings);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.hero-icon {
  font-size: 1.6rem;
  color: var(--ion-color-wiki-gold);
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .hero-icon {
    font-size: 2rem;
  }
}

@media (min-width: 768px) {
  .hero-title {
    font-size: 2.25rem;
  }
}

.hero-subtitle {
  margin: 0 auto;
  max-width: 28rem;
  color: var(--ion-color-medium);
}

/* ── Actions ───────────────────────────────────── */
.actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

@media (min-width: 576px) {
  .actions {
    flex-direction: row;
    justify-content: center;
    gap: 0.75rem;
  }
}

.actions-note {
  margin: 0 0 1.5rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

/* ── League grid ───────────────────────────────── */
.league-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

@media (min-width: 576px) {
  .league-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 992px) {
  .league-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.skeleton-card {
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 1.5rem 1rem;
}

.skeleton-line {
  width: 70%;
  height: 1rem;
  margin: 0;
}

.empty-state {
  margin: 0;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ion-color-medium);
  border: 1px dashed var(--ion-border-color);
  border-radius: 12px;
}

/* ── Featured ──────────────────────────────────── */
.featured {
  margin-top: 2.5rem;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}

.section-icon {
  font-size: 1.15rem;
  color: var(--ion-color-wiki-gold);
}

/* Primary, not gold: the gold star is what marks the featured leagues, and two
   gold headings would stop telling the sections apart. */
.section-icon.mine {
  color: var(--ion-color-primary);
}

.section-title {
  margin: 0;
  font-family: var(--font-family-headings);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.featured-placeholder {
  margin: 0;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ion-color-medium);
  border: 1px dashed var(--ion-border-color);
  border-radius: 12px;
}

/* ── Error ─────────────────────────────────────── */
.state-card {
  margin-top: 0;
}

.error-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.error-row ion-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.error-title {
  font-weight: 600;
  margin: 0 0 4px;
}

.error-detail {
  font-size: 13px;
  opacity: 0.85;
  margin: 0 0 8px;
}
</style>
