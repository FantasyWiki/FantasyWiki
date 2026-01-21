<template>
  <ion-card class="ion-padding">
    <ion-card-header class="ion-no-padding ion-margin-bottom">
      <div class="ion-display-flex ion-justify-content-between">
        <ion-card-title class="ion-text-start">
          🔥 Trending Today
        </ion-card-title>
        <ion-text>
          Most searched
        </ion-text>
      </div>
    </ion-card-header>
    <ion-card-content class="ion-text-center ion-no-padding">
      <ion-list class="ion-no-padding">
        <ion-item v-for="n in 4" :key="n" class="ion-margin-bottom ion-no-padding">
          <ion-badge class="ion-margin ion-padding">
            <ion-icon :icon="trendingUpOutline" aria-label="Going up"></ion-icon>
          </ion-badge>
          <ion-label class="ion-text-start ion-padding-horizontal">
            <h3 class="ion-no-margin">Article Title {{ n }}</h3>
            <p class="ion-display-flex ion-align-items-center">
              <ion-icon :icon="eyeOutline" aria-hidden="true" class="eye-icon ion-margin-end"></ion-icon>
              Avg: 98.5K/day
            </p>
          </ion-label>
          <ion-note slot="end" color="dark" class="ion-text-end">
            <ion-text class="views ion-display-block">145.2K</ion-text>
            <ion-text color="primary" class="ion-display-block">+47%</ion-text>
          </ion-note>
        </ion-item>
      </ion-list>
      <div class="top-border ion-padding-top">
        Updated in real-time from Wikipedia
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonText,
  IonBadge,
  IonNote,
  IonIcon
} from '@ionic/vue';
import { eyeOutline, trendingUpOutline } from 'ionicons/icons';
</script>

<style scoped>
ion-card {
  border-radius: 1rem;
  /* There is no way to do this in Ionic */
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

ion-item ion-badge {
  --ion-margin: 0.5rem;
  --ion-padding: 0.5rem;
  --background: var(--ion-background-color-step-500);
}

ion-badge ion-icon {
  font-size: 1.3rem;
}

ion-text.views {
  font-weight: bold;
  font-size: 0.875rem;
  line-height: 1.25rem;
}

ion-label {
  --ion-padding: 8px;
}

.eye-icon {
  font-size: 1rem;
  --ion-margin: 4px;
}

div.top-border {
  border-top: 1px solid var(--ion-border-color);
  --ion-padding: 16px;
}
</style>
