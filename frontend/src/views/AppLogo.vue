<template>
  <div class="logo-container" @click="router.push('/')">
    <div class="logo-icon-wrapper">
      <ion-icon :icon="bookOutline" color="primary" class="ion-hide" />
      <ion-img src="/logo.png" style="width: 40px; height: 40px" />
      <div class="logo-badge"></div>
    </div>
    <ion-text class="logo-text ion-hide-sm-down">
      Fantasy<span class="logo-accent">Wiki</span>
    </ion-text>
  </div>
</template>

<script setup lang="ts">
import { IonIcon, IonText } from "@ionic/vue";
import { useRouter } from "vue-router";
import { bookOutline } from "ionicons/icons";

const router = useRouter();
</script>

<style scoped>
.logo-container {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.2s ease;
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
  color: var(--ion-text-color);
}

.logo-accent {
  color: var(--ion-color-primary);
  font-family: "Libre Baskerville", serif;
}
</style>
