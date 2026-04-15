<template>
  <nav-bar>
    <hero-section class="ion-margin-vertical"></hero-section>
    <how-it-works></how-it-works>
    <app-feature></app-feature>
    <leaderboard-preview></leaderboard-preview>
    <CTA-section></CTA-section>
  </nav-bar>
</template>

<script setup lang="ts">
import HeroSection from "@/components/homePage/HeroSection.vue";
import NavBar from "@/layout/NavBar.vue";
import HowItWorks from "@/components/homePage/HowItWorks.vue";
import AppFeature from "@/components/homePage/AppFeature.vue";
import LeaderboardPreview from "@/components/homePage/LeaderboardPreview.vue";
import CTASection from "@/components/homePage/CTASection.vue";
</script>
<style scoped>
ion-margin-vertical {
  --ion-margin: 24px;
}
</style>
