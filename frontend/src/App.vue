<template>
  <ion-app>
    <ion-router-outlet id="router-outlet"></ion-router-outlet>
  </ion-app>
</template>

<script setup lang="ts">
import { ref, provide, onMounted } from "vue";
import { IonApp, IonRouterOutlet } from "@ionic/vue";

// Global state that can be accessed by all components
const isDark = ref(false);
const isLoggedIn = ref(false);

// Provide global state to all child components
provide("isDark", isDark);
provide("isLoggedIn", isLoggedIn);

// Initialize theme on mount
onMounted(() => {
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

  if (savedTheme) {
    isDark.value = savedTheme === "dark";
  } else {
    isDark.value = prefersDark.matches;
  }

  document.body.classList.toggle("ion-palette-dark", isDark.value);

  // Listen for system theme changes
  prefersDark.addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) {
      isDark.value = e.matches;
      document.body.classList.toggle("ion-palette-dark", e.matches);
    }
  });
});
</script>

<style></style>
