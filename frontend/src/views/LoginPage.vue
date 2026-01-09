<template>
  <div class="ion-display-flex ion-align-items-center ion-justify-content-center">
    <ion-card class="ion-padding-horizontal">
      <ion-card-header class="ion-text-center">
        <ion-card-title>
          <app-logo></app-logo>
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <h1>Welcome back</h1>
        <p>Sign in with your Google Account</p>
        <ion-button class="ion-text-capitalize" fill="outline" @click="router.push('/auth/google')">
          Continue with Google
        </ion-button>
      </ion-card-content>
    </ion-card>
  </div>
</template>

<script setup lang="ts">
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton } from '@ionic/vue';
import { useRouter } from 'vue-router';
import AppLogo from '@/views/AppLogo.vue';
const router = useRouter();
</script>

<style scoped>
div {
  height: 100%;
}

.ion-padding-horizontal {
  --ion-padding: 2rem;
}
</style>
