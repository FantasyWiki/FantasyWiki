<template>
  <nav-bar>
    <h1 class="ion-margin-horizontal">Build Your <strong>Knowledge Empire</strong></h1>
    <p class="ion-margin-horizontal ion-padding-horizontal">
      Draft Wikipedia articles, earn points from real search trends, and compete in weekly tournaments. The ultimate
      fantasy game for the curious mind.
    </p>
    <ion-item-group class="ion-margin-horizontal ion-padding-horizontal ion-display-flex ion-justify-content-center">
      <ion-searchbar :animated=true placeholder="Search articles... (e.g., Bitcoin, AI)"
        color="light ion-text-start"></ion-searchbar>
      <ion-button class="ion-text-nowrap ion-text-capitalize">
        Get Started
        <ion-icon slot="end" :icon="arrowForwardOutline"></ion-icon>
      </ion-button>
    </ion-item-group>
    <p>Start with 1,000 credits • No credit card required</p>
    <ion-item-group class="ion-display-flex ion-justify-content-center ion-flex-wrap ion-padding-vertical">
      <section v-for="(stat, i) in stats" v-bind:key="i" class="ion-padding-horizontal"
        :class="i !== stats.length - 1 ? 'border-right' : ''">
        <h2 class="ion-no-margin"><strong>{{ stat.title }}</strong></h2>
        <p class="ion-no-margin">{{ stat.description }}</p>
      </section>
    </ion-item-group>
    <ion-card>
      <ion-card-header>
        <ion-card-title class="ion-text-start">
          Top articles this week
        </ion-card-title>
      </ion-card-header>
      <ion-card-content class="ion-text-center">
        <ion-list>
          <ion-item v-for="n in 5" :key="n">
            <ion-label class="ion-text-start">
              <h3 class="ion-no-margin">Article Title {{ n }}</h3>
              <p class="ion-no-margin">Brief description of the article...</p>
            </ion-label>
            <ion-badge slot="end" color="primary">+{{ n * 100 }} pts</ion-badge>
          </ion-item>
        </ion-list>
      </ion-card-content>
    </ion-card>
  </nav-bar>
</template>

<script setup lang="ts">
import {
  IonItemGroup,
  IonSearchbar,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge
} from '@ionic/vue';
import { arrowForwardOutline } from 'ionicons/icons';
import NavBar from '@/layout/NavBar.vue';
const stats = [
  { title: '50K+', description: 'Articles drafted' },
  { title: '1M+', description: 'Points earned' },
  { title: '10K+', description: 'Active users' },
];
</script>
<style scoped>
ion-content {
  --ion-margin: 80px;
}

.border-right {
  border-right: 1px solid var(--ion-color-light-shade);
}
</style>
