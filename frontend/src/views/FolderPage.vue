<template>
  <ion-page>
    <ion-section>
      <h1>Build Your <strong>Knowledge Empire</strong></h1>
      <ion-content>
        Draft Wikipedia articles, earn points from real search trends, and compete in weekly tournaments. The ultimate fantasy game for the curious mind.
      </ion-content>
    </ion-section>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
</script>

<style scoped>
ion-section {
  text-align: center;
}

h1 {
  font-size: xx-large;
  font-family: 'Libre Baskerville', serif;
  font-weight: bold;
  color: black;
}

strong {
  color: var(--ion-color-primary);
}
</style>
