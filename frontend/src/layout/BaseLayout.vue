<template>
  <ion-page>
    <!-- With this page go under the header that should be translucent -->
    <ion-content :fullscreen="true">

      <!-- Spacer for the beginning of the page -->
      <div class="header-spacer"></div>

      <!-- Here page content get injected -->
      <slot></slot>

    </ion-content>
  </ion-page>
</template>
/* TODO: Navbar height should be a global variable */
<style scoped>
.header-spacer {
  height: 90px; /* Navbar height + 20px  */
  width: 100%;
}
</style>

<script setup lang="ts">
import { IonPage, IonContent } from '@ionic/vue';
</script>
