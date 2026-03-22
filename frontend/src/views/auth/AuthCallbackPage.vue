<template>
  <ion-page>
    <ion-content class="ion-padding callback-content">
      <div class="callback-container">
        <template v-if="error">
          <ion-icon :icon="alertCircleOutline" class="callback-icon error" />
          <ion-text color="danger">
            <h2>Sign-in failed</h2>
            <p>{{ error }}</p>
          </ion-text>
          <ion-button @click="router.push('/home')">Try again</ion-button>
        </template>
        <template v-else>
          <ion-spinner name="crescent" class="callback-spinner" />
          <ion-text color="medium">
            <p>Signing you in…</p>
          </ion-text>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonContent,
  IonSpinner,
  IonText,
  IonButton,
  IonIcon,
} from "@ionic/vue";
import { useRoute, useRouter } from "vue-router";
import { alertCircleOutline } from "ionicons/icons";
import { ref, onMounted } from "vue";
import { useAppStore } from "@/stores/app";

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

const error = ref<string | null>(null);

onMounted(async () => {
  const token = route.query.token as string | undefined;

  if (!token) {
    error.value = "No authentication token received.";
    return;
  }

  appStore.setUser(token);

  if (!appStore.isAuthenticated) {
    error.value = "Token is invalid or has expired. Please sign in again.";
    return;
  }

  router.replace("/home");
});
</script>

<style scoped>
.callback-content {
  --background: var(--ion-background-color);
}

.callback-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 100%;
  text-align: center;
}

.callback-spinner {
  width: 48px;
  height: 48px;
  color: var(--ion-color-primary);
}

.callback-icon {
  font-size: 3rem;
}

.callback-icon.error {
  color: var(--ion-color-danger);
}
</style>
