<template>
  <ion-app>
    <!-- MOBILE SIDE MENU -->
    <ion-menu content-id="main-content" type="overlay">
      <ion-header>
        <ion-toolbar>
          <ion-title>Menu</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>
          <ion-menu-toggle >
            <ion-item button router-link="/dashboard">
              <ion-icon slot="start" :icon="speedometerOutline" />
              <ion-label>Dashboard</ion-label>
            </ion-item>
            <ion-item button router-link="/how-it-works">
              <ion-icon slot="start" :icon="helpCircleOutline" />
              <ion-label>How It Works</ion-label>
            </ion-item>
            <ion-item button router-link="/leagues">
              <ion-icon slot="start" :icon="trophyOutline" />
              <ion-label>Leagues</ion-label>
            </ion-item>
            <ion-item button router-link="/community">
              <ion-icon slot="start" :icon="peopleOutline" />
              <ion-label>Community</ion-label>
            </ion-item>
          </ion-menu-toggle>
        </ion-list>
      </ion-content>
    </ion-menu>

    <!-- MAIN CONTENT AREA -->
    <div id="main-content" class="ion-page">

      <!-- FIXED NAVBAR (Overlay) -->
      <Navbar class="overlay-navbar" />

      <!-- ROUTER VIEW (Fills screen, starts at top:0) -->
      <ion-router-outlet id="router-outlet"></ion-router-outlet>

    </div>
  </ion-app>
</template>

<script setup lang="ts">
import {
  IonApp,
  IonRouterOutlet,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonMenuToggle
} from '@ionic/vue';
import {
  speedometerOutline,
  helpCircleOutline,
  trophyOutline,
  peopleOutline
} from 'ionicons/icons';
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
