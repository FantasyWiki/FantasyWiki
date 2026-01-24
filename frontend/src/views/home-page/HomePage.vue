<template>
  <nav-bar>
    <hero-section></hero-section>
    <how-it-works></how-it-works>
    <app-feature></app-feature>
    <leaderboard-preview></leaderboard-preview>
    <CTA-section></CTA-section>
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
<style scoped></style>
