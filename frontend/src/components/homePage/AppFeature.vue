<template>
  <section class="ion-padding-vertical">
    <section class="ion-text-center ion-margin-bottom">
      <h2 class="title ion-margin-bottom">{{ $t("home.features.title") }}</h2>
      <p class="subtitle ion-margin-bottom">
        {{ $t("home.features.subtitle") }}
      </p>
    </section>

    <ion-grid class="home-section-container ion-padding">
      <ion-row>
        <ion-col
          v-for="(feature, index) in features"
          :key="feature.title"
          size="12"
          size-sm="6"
          size-lg="3"
        >
          <ion-card class="feature-card ion-padding">
            <ion-card-content class="ion-no-padding">
              <div
                :class="[
                  'icon-wrapper ion-margin-bottom ion-display-flex ion-align-items-center ion-justify-content-center',
                ]"
                :style="{ animationDelay: `${index * 50}ms` }"
              >
                <ion-icon :icon="feature.icon" size="large"></ion-icon>
              </div>

              <h3 class="feature-title ion-margin-bottom">
                {{ feature.title }}
              </h3>
              <p>{{ feature.description }}</p>
            </ion-card-content>
          </ion-card>
        </ion-col>
      </ion-row>
    </ion-grid>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonIcon,
} from "@ionic/vue";
import {
  timeOutline,
  flashOutline,
  shieldCheckmarkOutline,
  barChartOutline,
  peopleOutline,
  trophyOutline,
  linkOutline,
  calendarOutline,
} from "ionicons/icons";

const { t } = useI18n();

const features = computed(() => [
  {
    icon: timeOutline,
    title: t("home.features.liveMarkets.title"),
    description: t("home.features.liveMarkets.description"),
  },
  {
    icon: flashOutline,
    title: t("home.features.realTimeScoring.title"),
    description: t("home.features.realTimeScoring.description"),
  },
  {
    icon: linkOutline,
    title: t("home.features.chemistry.title"),
    description: t("home.features.chemistry.description"),
  },
  {
    icon: barChartOutline,
    title: t("home.features.dynamicPricing.title"),
    description: t("home.features.dynamicPricing.description"),
  },
  {
    icon: peopleOutline,
    title: t("home.features.privateLeagues.title"),
    description: t("home.features.privateLeagues.description"),
  },
  {
    icon: calendarOutline,
    title: t("home.features.weeklyTournaments.title"),
    description: t("home.features.weeklyTournaments.description"),
  },
  {
    icon: trophyOutline,
    title: t("home.features.powerTournaments.title"),
    description: t("home.features.powerTournaments.description"),
  },
  {
    icon: shieldCheckmarkOutline,
    title: t("home.features.fairPlay.title"),
    description: t("home.features.fairPlay.description"),
  },
]);
</script>

<style scoped src="src/components/homePage/home-page.css"></style>
<style scoped>
.feature-card {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 0.75rem;
  transition: all 0.3s ease;
  height: 100%;
}

.feature-card:hover {
  border-color: rgba(var(--ion-color-primary-rgb), 0.5);
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.icon-wrapper {
  height: 3rem;
  width: 3rem;
  border-radius: 0.5rem;
  background-color: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
  transition: all 0.3s ease;
}

.feature-card:hover .icon-wrapper {
  background-color: rgba(var(--ion-color-primary-rgb), 0.2);
  transform: scale(1.05);
}

ion-card {
  --ion-padding: 1.25rem;
  height: 100%;
}

.feature-title {
  font-weight: bold;
  font-size: 1.125rem;
}
</style>
