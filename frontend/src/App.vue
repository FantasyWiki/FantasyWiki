<template>
  <ion-app>

      <!-- FIXED NAVBAR (Overlay) -->
      <Navbar class="overlay-navbar" />

      <!-- ROUTER VIEW (Fills screen, starts at top:0) -->
      <ion-router-outlet id="router-outlet"></ion-router-outlet>

  </ion-app>
</template>

<script setup lang="ts">
import {
  IonApp,
  IonRouterOutlet,

} from '@ionic/vue';

import Navbar from '@/layout/NavBar.vue';
</script>

<style>
/* GLOBAL STYLES */
:root {
  --ion-background-color: #0d1411;
  --ion-text-color: #ffffff;
}

body {
  background-color: var(--ion-background-color);
  margin: 0;
}

/* NAVBAR POSITIONING */
.overlay-navbar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1000; /* Ensures navbar stays on top of content */
  pointer-events: none; /* Let clicks pass through empty areas if needed, but child elements (buttons) will re-enable pointer-events */
}

/* Make sure navbar children (buttons/links) are clickable */
.overlay-navbar > * {
  pointer-events: auto;
}

/* CONTENT CONTAINER */
#router-outlet {
  height: 100%;
  width: 100%;
  /* Critical: No padding-top here so content starts behind the navbar */
}
</style>
