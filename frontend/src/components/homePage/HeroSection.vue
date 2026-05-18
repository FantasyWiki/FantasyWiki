<template>
  <ion-grid
    class="home-section-container ion-padding-horizontal ion-margin-horizontal"
  >
    <ion-row>
      <ion-col size="12" size-lg="6" class="ion-text-center">
        <ion-chip
          color="primary"
          class="ion-display-inline-flex ion-justify-content-evenly"
        >
          <ion-icon :icon="flashOutline" aria-hidden="true"></ion-icon>
          <div>Fantasy Sports meets Wikipedia</div>
        </ion-chip>
        <h1 class="ion-text-center">
          Build Your <strong>Knowledge Empire</strong>
        </h1>
        <p class="ion-padding-horizontal ion-text-center">
          Draft Wikipedia articles, earn points from real search trends, and
          compete in weekly tournaments. The ultimate fantasy game for the
          curious mind.
        </p>
        <ion-button
          class="ion-text-capitalize ion-padding-horizontal"
          size="large"
        >
          <ion-text>Get Started</ion-text>
          <ion-icon slot="end" :icon="arrowForwardOutline"></ion-icon>
        </ion-button>
        <p class="ion-text-center">
          Start with 1,000 credits • No credit card required
        </p>
        <app-stats></app-stats>
      </ion-col>
      <ion-col size="12" size-lg="6" class="ion-no-padding">
        <article-leaderboard></article-leaderboard>
      </ion-col>
    </ion-row>
  </ion-grid>
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
} from "@ionic/vue";
import { arrowForwardOutline, flashOutline } from "ionicons/icons";
import AppStats from "./AppStats.vue";
import ArticleLeaderboard from "./ArticleLeaderboard.vue";
</script>

<style scoped src="src/components/homePage/home-page.css"></style>
