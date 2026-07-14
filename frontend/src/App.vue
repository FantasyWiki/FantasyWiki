<template>
  <ion-app>
    <ion-router-outlet id="router-outlet"></ion-router-outlet>
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { IonApp, IonRouterOutlet } from "@ionic/vue";
import { useAppStore } from "@/stores/app";

// The store applies the resolved theme when it is created; all we own here is
// the OS-preference listener, which lives as long as the app does.
const appStore = useAppStore();
let unfollowSystemTheme: (() => void) | undefined;

onMounted(() => {
  unfollowSystemTheme = appStore.followSystemTheme();
});

onUnmounted(() => unfollowSystemTheme?.());
</script>

<style></style>
