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
          <ion-item-group class="ion-display-flex ion-justify-content-center ion-flex-no-wrap ion-padding-vertical">
            <section v-for="(stat, i) in stats" v-bind:key="i" class="ion-padding-horizontal"
              :class="i !== stats.length - 1 ? 'border-right' : ''">
              <h2 class="ion-no-margin ion-text-center"><strong>{{ stat.title }}</strong></h2>
              <p class="ion-no-margin">{{ stat.description }}</p>
            </section>
          </ion-item-group>
        </ion-col>
        <ion-col size="12" size-lg="6">
          <ion-card class="ion-padding">
            <ion-card-header class="ion-no-padding ion-margin-bottom">
              <div class="ion-display-flex ion-justify-content-between">
                <ion-card-title class="ion-text-start">
                  Top articles this week
                </ion-card-title>
                <ion-text color="secondary">
                  +12.5% today
                </ion-text>
              </div>
            </ion-card-header>
            <ion-card-content class="ion-text-center ion-no-padding">
              <ion-list>
                <ion-item v-for="n in 5" :key="n" class="ion-margin-bottom ion-no-padding">
                  <ion-badge class="ion-margin ion-padding">
                    <ion-icon :icon="trendingUpOutline"></ion-icon>
                  </ion-badge>
                  <ion-label class="ion-text-start">
                    <h3 class="ion-no-margin">Article Title {{ n }}</h3>
                    <p class="ion-no-margin">Brief description of the article...</p>
                  </ion-label>
                  <ion-badge slot="end" color="primary">+{{ n * 100 }} pts</ion-badge>
                </ion-item>
              </ion-list>
            </ion-card-content>
          </ion-card>
        </ion-col>
      </ion-row>
    </ion-grid>
  </nav-bar>
</template>

<script setup lang="ts">
import {
  IonItemGroup,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonText,
  IonBadge
} from '@ionic/vue';
import { arrowForwardOutline, flashOutline, trendingUpOutline } from 'ionicons/icons';
import NavBar from '@/layout/NavBar.vue';
const stats = [
  { title: '50K+', description: 'Articles drafted' },
  { title: '1M+', description: 'Points earned' },
  { title: '10K+', description: 'Active users' },
];
</script>
<style scoped>
.border-right {
  border-right: 1px solid var(--ion-color-light-shade);
}

ion-grid {
  --ion-grid-padding: 5rem;
}

ion-card {
  border-radius: 1rem; /* There is no way to do this in Ionic */
  --ion-padding: 1.5rem;
}

ion-card-title {
  font-weight: bold;
  --ion-margin: 1rem;
}

ion-card-header ion-text {
  font-weight: 500;
}

ion-item {
  --border-style: none;
  --background: var(--ion-background-color);
  --border-radius: 0.5rem;
}

ion-card ion-item ion-badge {
  --ion-margin: 0.5rem;
  --ion-padding: 0.5rem;
  --background: var(--ion-background-color-step-450);
}

ion-badge ion-icon {
  font-size: 1.3rem;
}

ion-button {
  font-size: 0.875rem;
  line-height: 1.25rem;
  --ion-padding: 2rem;
}

ion-button {
  --border-radius: 0.5rem;
}

</style>
