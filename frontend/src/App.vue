<template>
  <ion-app>
      <ion-router-outlet id="router-outlet"></ion-router-outlet>
  </ion-app>
</template>

<script setup lang="ts">
import {
  IonApp,
  IonRouterOutlet,
} from '@ionic/vue';

</script>

<style>
/* GLOBAL STYLES */
:root {
  --ion-background-color: #0d1411;
  --ion-text-color: #ffffff;
}

body {
  background-color: var(--ion-background-color);
}

</style>
