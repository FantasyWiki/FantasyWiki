<template>
  <section id="how-it-works" class="ion-padding-vertical bg-secondary">
    <ion-grid>
      <ion-row>
        <ion-col size="12">
          <div class="ion-text-center ion-margin-bottom">
            <h2 class="title ion-margin-bottom">
              How Fantasy<span class="text-primary">Wiki</span> Works
            </h2>
            <p class="subtitle ion-margin-bottom">
              Join thousands of players competing in the ultimate knowledge-based fantasy game.
            </p>
          </div>
        </ion-col>
      </ion-row>

      <ion-row>
        <ion-col v-for="(step, index) in steps" :key="step.title" size="6" size-lg="3">
          <ion-card class="step-card">
            <div class="step-number ion-display-flex ion-align-items-center ion-justify-content-center">
              {{ index + 1 }}
            </div>

            <ion-card-content>
              <div
                :class="['icon-wrapper ion-margin-bottom ion-display-flex ion-align-items-center ion-justify-content-center', step.colorClass]">
                <ion-icon :icon="step.icon" size="large"></ion-icon>
              </div>

              <h3 class="step-title ion-margin-bottom">{{ step.title }}</h3>
              <p class="step-description">
                {{ step.description }}
              </p>
            </ion-card-content>
          </ion-card>

          <div v-if="index < steps.length - 1" class="arrow-wrapper ion-display-none ion-display-lg-flex">
            <ion-icon :icon="arrowForward" size="large"></ion-icon>
          </div>
        </ion-col>
      </ion-row>
    </ion-grid>
  </section>
</template>

<script setup lang="ts">
import { IonGrid, IonRow, IonCol, IonCard, IonCardContent, IonIcon } from '@ionic/vue';
import { search, cart, trendingUp, trophy, arrowForward } from 'ionicons/icons';

const steps = [
  {
    icon: search,
    title: "Search Articles",
    description: "Explore millions of Wikipedia articles. Find trending topics, hidden gems, or your favorite subjects.",
    colorClass: "bg-primary",
  },
  {
    icon: cart,
    title: "Build Your Portfolio",
    description: "Buy articles with your 1,000 starting credits. Choose contract durations from 3 to 90 days.",
    colorClass: "bg-gold",
  },
  {
    icon: trendingUp,
    title: "Earn Points Daily",
    description: "Score points based on real Wikipedia pageviews. Trending articles = more points!",
    colorClass: "bg-accent",
  },
  {
    icon: trophy,
    title: "Compete & Win",
    description: "Climb the leaderboard, join weekly tournaments, and earn bonus rewards.",
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

.title {
  font-size: clamp(1.875rem, 4vw, 2.25rem);
  font-family: serif;
  font-weight: bold;
  color: var(--ion-color-dark);
}

.text-primary {
  color: var(--ion-color-primary);
}

.subtitle {
  font-size: 1.125rem;
  color: var(--ion-color-medium);
  max-width: 42rem;
}

.step-card {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 0.75rem;
  transition: all 0.3s ease;
  height: 100%;
}

.step-card:hover {
  border-color: rgba(var(--ion-color-primary-rgb), 0.5);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.step-number {
  position: absolute;
  top: -0.75rem;
  left: -0.75rem;
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
  font-family: serif;
  font-weight: bold;
  font-size: 1.125rem;
  color: var(--ion-color-dark);
}

.step-description {
  color: var(--ion-color-medium);
  font-size: 0.875rem;
  line-height: 1.625;
}

.arrow-wrapper {
  position: absolute;
  top: 50%;
  right: -0.75rem;
  transform: translateY(-50%);
  z-index: 10;
  color: rgba(var(--ion-color-medium-rgb), 0.5);
}
</style>
