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
  IonIcon
} from '@ionic/vue';
import { trendingUpOutline } from 'ionicons/icons';
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
</style>
