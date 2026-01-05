<template>
  <ion-content class="ion-padding-horizontal ion-text-center">
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
  </ion-content>
</template>

<script setup lang="ts">
import { arrowForwardOutline } from 'ionicons/icons';
</script>

<style scoped></style>
