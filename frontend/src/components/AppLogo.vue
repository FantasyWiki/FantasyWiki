<template>
  <!-- A button, not a div with a click handler: this is the app's home link,
       and a div is unreachable by keyboard and announced as nothing. -->
  <button
    type="button"
    class="logo-container"
    :aria-label="t('nav.home')"
    @click="router.push('/')"
  >
    <div class="logo-icon-wrapper">
      <ion-icon
        aria-hidden="true"
        :icon="bookOutline"
        color="primary"
        class="ion-hide"
      />
      <!-- Decorative: the button beside it already carries the name. -->
      <ion-img src="/logo.png" alt="" style="width: 40px; height: 40px" />
      <div class="logo-badge"></div>
    </div>
    <ion-text class="logo-text">
      Fantasy<span class="logo-accent">Wiki</span>
    </ion-text>
  </button>
</template>

<script setup lang="ts">
import { IonIcon, IonText, IonImg } from "@ionic/vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { bookOutline } from "ionicons/icons";

const router = useRouter();
const { t } = useI18n();
</script>

<style scoped>
.logo-container {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.2s ease;
  /* It is a <button> for the keyboard, and must not look like one. */
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
}

.logo-icon-wrapper:hover {
  transform: scale(1.05);
}

.logo-icon-wrapper {
  position: relative;
}

.logo-icon-wrapper ion-icon {
  font-size: 32px;
  transition: transform 0.2s ease;
}

.logo-container:hover .logo-icon-wrapper ion-icon {
  transform: scale(1.1);
}

.logo-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  background: var(--wiki-gold);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.logo-text {
  font-family: "Libre Baskerville", serif;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ion-color-dark);
}

.logo-accent {
  color: var(--ion-color-primary);
  font-family: "Libre Baskerville", serif;
}
</style>
