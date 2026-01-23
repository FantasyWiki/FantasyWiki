<template>
  <section class="ion-padding-vertical">
    <div class="container ion-padding">
      <section class="ion-text-center ion-margin-bottom">
        <h2 class="title ion-margin-bottom">
          Powerful Features
        </h2>
        <p class="subtitle ion-margin-bottom">
          Everything you need for the ultimate fantasy knowledge experience.
        </p>
      </section>

      <ion-grid>
        <ion-row>
          <ion-col v-for="(feature, index) in features" :key="feature.title" size="12" size-sm="6" size-lg="3">
            <ion-card class="feature-card ion-padding">
              <ion-card-content class="ion-no-padding">
                <div 
                  :class="['icon-wrapper ion-margin-bottom ion-display-flex ion-align-items-center ion-justify-content-center']"
                  :style="{ animationDelay: `${index * 50}ms` }"
                >
                  <ion-icon :icon="feature.icon" size="large"></ion-icon>
                </div>

                <h3 class="feature-title ion-margin-bottom">{{ feature.title }}</h3>
                <p class="feature-description">
                  {{ feature.description }}
                </p>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>
  </section>
</template>

<script setup lang="ts">
import { IonGrid, IonRow, IonCol, IonCard, IonCardContent, IonIcon } from '@ionic/vue';
import { 
  timeOutline, 
  flashOutline, 
  shieldCheckmarkOutline, 
  barChartOutline, 
  peopleOutline, 
  trophyOutline,
  linkOutline,
  calendarOutline
} from 'ionicons/icons';

const features = [
  {
    icon: timeOutline,
    title: "24/7 Live Markets",
    description: "Buy, sell, and trade articles anytime. The market never sleeps.",
  },
  {
    icon: flashOutline,
    title: "Real-Time Scoring",
    description: "Points calculated daily from actual Wikipedia pageview data.",
  },
  {
    icon: linkOutline,
    title: "Chemistry Bonuses",
    description: "Link related articles for bonus multipliers, FIFA-style.",
  },
  {
    icon: barChartOutline,
    title: "Dynamic Pricing",
    description: "Article prices adjust based on trending topics and demand.",
  },
  {
    icon: peopleOutline,
    title: "Private Leagues",
    description: "Create private leagues and compete with friends.",
  },
  {
    icon: calendarOutline,
    title: "Weekly Tournaments",
    description: "Join automatic weekly competitions for bonus rewards.",
  },
  {
    icon: trophyOutline,
    title: "Power Tournaments",
    description: "Monthly elite competitions for the top performers.",
  },
  {
    icon: shieldCheckmarkOutline,
    title: "Fair Play",
    description: "Transparent scoring system based on public data.",
  },
];
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
}

h2 {
  font-size: clamp(1.875rem, 4vw, 2.25rem);
}

.subtitle {
  font-size: 1.125rem;
  color: var(--ion-color-medium);
  max-width: 42rem;
  margin: 0 auto;
}

.feature-card {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 0.75rem;
  transition: all 0.3s ease;
  height: 100%;
}

.feature-card:hover {
  border-color: rgba(var(--ion-color-primary-rgb), 0.5);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
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

.feature-description {
  color: var(--ion-color-medium);
  font-size: 0.875rem;
  line-height: 1.625;
}

ion-card {
  --ion-padding: 1.25rem;
  height: 100%;
}

@media (max-width: 576px) {
  ion-col {
    padding: 0.25rem;
  }
}
</style>
