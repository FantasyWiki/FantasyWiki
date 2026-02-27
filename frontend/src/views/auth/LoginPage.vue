<template>
  <div class="login-card">
    <button class="dismiss-btn" @click="dismiss">
      <ion-icon :icon="closeOutline" />
    </button>

    <app-logo />

    <ion-text color="medium" class="login-subtitle">
      <p>Sign in to manage your leagues and track your team.</p>
    </ion-text>

    <div v-if="errorMessage" class="error-banner">
      <ion-icon :icon="alertCircleOutline" />
      {{ errorMessage }}
    </div>

    <ion-button expand="block" class="google-btn" @click="signInWithGoogle">
      <ion-icon :icon="logoGoogle" slot="start" />
      <ion-text>Sign in with Google</ion-text>
    </ion-button>

    <ion-text color="medium" class="login-terms">
      <p>
        By signing in you agree to our
        <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
      </p>
    </ion-text>
  </div>
</template>

<script setup lang="ts">
import { IonButton, IonText, IonIcon, modalController } from "@ionic/vue";
import { useRoute } from "vue-router";
import { alertCircleOutline, closeOutline, logoGoogle } from "ionicons/icons";
import { computed } from "vue";
import AppLogo from "@/views/AppLogo.vue";

const route = useRoute();

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";

const errorMessage = computed(() =>
  route.query.error === "auth_failed"
    ? "Authentication failed. Please try again."
    : null
);

function dismiss() {
  modalController.dismiss();
}

function signInWithGoogle() {
  window.location.href = `${BACKEND_URL}/auth/google`;
}
</script>

<style scoped>
.login-card {
  position: relative;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.dismiss-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ion-color-medium);
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-subtitle {
  text-align: center;
  font-size: 0.95rem;
}

.login-subtitle p {
  margin: 0;
}

.error-banner {
  width: 100%;
  padding: 0.75rem 1rem;
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  border: 1px solid var(--ion-color-danger);
  border-radius: 8px;
  color: var(--ion-color-danger);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.google-btn {
  width: 100%;
  --border-radius: 8px;
  --padding-start: 1rem;
  --padding-end: 1rem;
  height: 48px;
}

.login-terms {
  text-align: center;
  font-size: 0.75rem;
}

.login-terms p {
  margin: 0;
}

.login-terms a {
  color: var(--ion-color-primary);
  text-decoration: none;
}
</style>
