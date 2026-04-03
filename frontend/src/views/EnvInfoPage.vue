<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Environment Info</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-card>
        <ion-card-header>
          <ion-card-title>Environment Variables</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item>
              <ion-label>
                <h3>VITE_WORKERS_CI_BRANCH</h3>
                <p>{{ workersCiBranch || "(not set)" }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>VITE_BACKEND_URL</h3>
                <p>{{ backendUrl || "(not set)" }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>Resolved Backend URL</h3>
                <p>{{ resolvedBackendUrl }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
} from "@ionic/vue";
import { resolveBackendUrl } from "@/services/api";

const workersCiBranch = import.meta.env.VITE_WORKERS_CI_BRANCH;
const backendUrl = import.meta.env.VITE_BACKEND_URL;
const resolvedBackendUrl = resolveBackendUrl();
</script>

<style scoped>
ion-card {
  margin: 16px 0;
}

ion-item {
  --padding-start: 0;
}

h3 {
  font-weight: 600;
  margin-bottom: 4px;
}

p {
  color: var(--ion-color-medium);
  word-break: break-all;
}
</style>
