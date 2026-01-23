<template>
  <nav-bar>
    <ion-grid class="ion-padding-horizontal ion-margin-horizontal">
      <ion-row>
        <ion-col size="12" size-lg="6" class="ion-text-center">
          <ion-chip color="primary" class="ion-display-inline-flex ion-justify-content-evenly">
            <ion-icon :icon="flashOutline" aria-hidden="true"></ion-icon>
            <div>Fantasy Sports meets Wikipedia</div>
          </ion-chip>
          <h1 class="ion-text-center">Build Your <strong>Knowledge Empire</strong></h1>
          <p class="ion-padding-horizontal ion-text-center">
            Draft Wikipedia articles, earn points from real search trends, and compete in weekly tournaments. The
            ultimate
            fantasy game for the curious mind.
          </p>
          <ion-button class="ion-text-capitalize ion-padding-horizontal" size="large">
            <ion-text>Get Started</ion-text>
            <ion-icon slot="end" :icon="arrowForwardOutline"></ion-icon>
          </ion-button>
          <p class="ion-text-center">Start with 1,000 credits • No credit card required</p>
          <app-stats></app-stats>
        </ion-col>
        <ion-col size="12" size-lg="6" class="ion-no-padding">
          <article-leaderboard></article-leaderboard>
          <ion-chip class="top-right animate-float">📡 Live data</ion-chip>
          <ion-chip class="bottom-left animate-float">📊 Over 2 million views today</ion-chip>
        </ion-col>
      </ion-row>
    </ion-grid>
    <how-it-works></how-it-works>
  </nav-bar>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonText,
} from '@ionic/vue';
import { arrowForwardOutline, flashOutline } from 'ionicons/icons';
import NavBar from '@/layout/NavBar.vue';
import AppStats from './AppStats.vue';
import ArticleLeaderboard from './ArticleLeaderboard.vue';
import HowItWorks from './HowItWorks.vue';

</script>
<style scoped>
ion-grid {
  --ion-grid-padding: 5rem;
}

ion-button {
  font-size: 0.875rem;
  line-height: 1.25rem;
  --ion-padding: 2rem;
  --border-radius: 0.5rem;
}

ion-chip.top-right {
  position: absolute;
  top: -1rem;
  right: -1rem;
  --background: var(--ion-color-secondary);
}

ion-chip.bottom-left {
  position: absolute;
  bottom: -1rem;
  left: -1rem;
  --background: var(--ion-color-primary);
  --color: var(--ion-color-light);
}

ion-chip.animate-float {
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

</style>
