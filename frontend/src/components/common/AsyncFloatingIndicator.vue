<template>
  <transition name="fade-up">
    <div v-if="asyncIndicator.isVisible" class="async-indicator">
      <ion-spinner name="crescent" class="async-indicator__spinner" />
      <span>{{ asyncIndicator.label }}</span>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { IonSpinner } from "@ionic/vue";
import { useAsyncIndicator } from "@/composables/useAsyncIndicator";

const asyncIndicator = useAsyncIndicator();
</script>

<style scoped>
.async-indicator {
  position: fixed;
  bottom: calc(64px + var(--ion-safe-area-bottom, 0px) + 8px);
  right: 16px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 1;
  pointer-events: none;
  z-index: 999;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
}

.async-indicator__spinner {
  width: 14px;
  height: 14px;
}

.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 180ms ease;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
