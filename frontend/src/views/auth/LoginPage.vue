<template>
  <div class="login-card">
    <button class="dismiss-btn" @click="dismiss">
      <ion-icon :icon="closeOutline" />
    </button>

    <app-logo />

    <ion-text color="medium" class="login-subtitle">
      <p>{{ $t("auth.login.subtitle") }}</p>
    </ion-text>

    <div v-if="errorMessage" class="error-banner">
      <ion-icon :icon="alertCircleOutline" />
      {{ errorMessage }}
    </div>

    <ion-button expand="block" class="google-btn" @click="signInWithGoogle">
      <ion-icon :icon="logoGoogle" slot="start" />
      <ion-text>{{ $t("auth.login.signInGoogle") }}</ion-text>
    </ion-button>

    <ion-text color="medium" class="login-terms">
      <p>
        <i18n-t keypath="auth.login.termsPrefix" tag="span">
          <template #terms
            ><a href="#">{{ $t("auth.login.terms") }}</a></template
          >
          <template #privacy
            ><a href="#">{{ $t("auth.login.privacy") }}</a></template
          >
        </i18n-t>
      </p>
    </ion-text>
  </div>
</template>

<script setup lang="ts">
import { IonButton, IonText, IonIcon, modalController } from "@ionic/vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { alertCircleOutline, closeOutline, logoGoogle } from "ionicons/icons";
import { computed } from "vue";
import AppLogo from "@/components/AppLogo.vue";

const route = useRoute();
const { t } = useI18n();

const errorMessage = computed(() =>
  route.query.error === "auth_failed" ? t("auth.login.authFailed") : null
);

function dismiss() {
  modalController.dismiss();
}

function signInWithGoogle() {
  window.location.href = "/auth/google";
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
