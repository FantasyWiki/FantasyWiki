<template>
  <ion-app>
    <ion-router-outlet id="router-outlet"></ion-router-outlet>
    <!-- The tour narrates real pages, so it lives above the outlet rather than
         inside any one view: it has to survive the navigation it triggers. -->
    <tour-dock />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { IonApp, IonRouterOutlet } from "@ionic/vue";
import TourDock from "@/components/onboarding/TourDock.vue";
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
