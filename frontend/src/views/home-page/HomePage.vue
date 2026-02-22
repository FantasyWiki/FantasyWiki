<template>
  <nav-bar>
    <hero-section class="ion-margin-vertical"></hero-section>
    <how-it-works></how-it-works>
    <app-feature></app-feature>
    <leaderboard-preview></leaderboard-preview>
    <cta-section></cta-section>
  </nav-bar>
</template>

<script setup lang="ts">
import HeroSection from "./HeroSection.vue";
import NavBar from "@/layout/NavBar.vue";
import HowItWorks from "./HowItWorks.vue";
import AppFeature from "./AppFeature.vue";
import LeaderboardPreview from "./LeaderboardPreview.vue";
import CTASection from "./CTASection.vue";
</script>
<style scoped>
ion-margin-vertical {
  --ion-margin: 24px;
}
</style>
