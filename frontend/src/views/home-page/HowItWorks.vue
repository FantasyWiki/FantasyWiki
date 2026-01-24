<template>
  <section id="how-it-works" class="ion-padding-vertical bg-secondary">
    <section class="ion-text-center ion-margin-bottom">
      <h2 class="title ion-margin-bottom">
        How Fantasy<strong>Wiki</strong> Works
      </h2>
      <p class="ion-margin-bottom">
        Join thousands of players competing in the ultimate knowledge-based
        fantasy game.
      </p>
    </section>

    <ion-grid>
      <ion-row>
        <ion-col
          v-for="(step, index) in steps"
          :key="step.title"
          size="12"
          size-md="6"
          size-lg="3"
        >
          <div
            class="step-number ion-display-flex ion-justify-content-center ion-align-items-center"
          >
            {{ index + 1 }}
          </div>
          <ion-card class="step-card ion-padding">
            <ion-card-content class="ion-no-padding">
              <div
                :class="[
                  'icon-wrapper ion-margin-bottom ion-display-flex ion-align-items-center ion-justify-content-center',
                  step.colorClass,
                ]"
              >
                <ion-icon :icon="step.icon" size="large"></ion-icon>
              </div>

              <h3 class="step-title ion-margin-bottom">{{ step.title }}</h3>
              <p>
                {{ step.description }}
              </p>
            </ion-card-content>
          </ion-card>
        </ion-col>
      </ion-row>
    </ion-grid>
  </section>
</template>

<script setup lang="ts">
import {
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonIcon,
} from "@ionic/vue";
import { search, cart, trendingUp, trophy } from "ionicons/icons";

const steps = [
  {
    icon: search,
    title: "Search Articles",
    description:
      "Explore millions of Wikipedia articles. Find trending topics, hidden gems, or your favorite subjects.",
    colorClass: "bg-primary",
  },
  {
    icon: cart,
    title: "Build Your Portfolio",
    description:
      "Buy articles with your 1,000 starting credits. Choose contract durations from 3 to 90 days.",
    colorClass: "bg-gold",
  },
  {
    icon: trendingUp,
    title: "Earn Points Daily",
    description:
      "Score points based on real Wikipedia pageviews. Trending articles = more points!",
    colorClass: "bg-accent",
  },
  {
    icon: trophy,
    title: "Compete & Win",
    description:
      "Climb the leaderboard, join weekly tournaments, and earn bonus rewards.",
    colorClass: "bg-primary",
  },
];
</script>

<style scoped>
#how-it-works {
  background: var(--ion-color-light);
}

.bg-secondary {
  background-color: rgba(var(--ion-color-secondary-rgb), 0.1);
}

h2 {
  font-size: clamp(1.875rem, 4vw, 2.25rem);
}

.step-card {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 0.75rem;
  transition: all 0.3s ease;
  height: 100%;
}

.step-card:hover {
  border-color: rgba(var(--ion-color-primary-rgb), 0.5);
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.step-number {
  position: absolute;
  height: 2rem;
  width: 2rem;
  border-radius: 50%;
  background-color: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-size: 0.875rem;
  font-weight: bold;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.icon-wrapper {
  height: 3.5rem;
  width: 3.5rem;
  border-radius: 0.75rem;
  transition: transform 0.3s ease;
}

.step-card:hover .icon-wrapper {
  transform: scale(1.1);
}

.bg-primary {
  background-color: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
}

.bg-gold {
  background-color: rgba(255, 193, 7, 0.2);
  color: #f5a623;
}

.bg-accent {
  background-color: rgba(var(--ion-color-tertiary-rgb), 0.2);
  color: var(--ion-color-tertiary);
}

.step-title {
  font-weight: bold;
  font-size: 1.125rem;
}

ion-card {
  --ion-padding: 1.5rem;
  height: 100%;
}
</style>
