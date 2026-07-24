<template>
  <nav-bar>
    <!-- Sections are revealed top to bottom once the fonts have settled, so the
         reflow that used to run down the page in the open is now hidden behind
         a deliberate entrance. This is the atypical PageReveal caller: the
         content is always present, so it gates on the font signal rather than
         the mount default every other page uses. See useFontsReady. -->
    <page-reveal :when="isReady">
      <hero-section class="ion-margin-vertical"></hero-section>
      <how-it-works></how-it-works>
      <app-feature></app-feature>
      <leaderboard-preview></leaderboard-preview>
      <CTA-section></CTA-section>
    </page-reveal>
  </nav-bar>
</template>

<script setup lang="ts">
import HeroSection from "@/components/homePage/HeroSection.vue";
import NavBar from "@/layout/NavBar.vue";
import HowItWorks from "@/components/homePage/HowItWorks.vue";
import AppFeature from "@/components/homePage/AppFeature.vue";
import LeaderboardPreview from "@/components/homePage/LeaderboardPreview.vue";
import CTASection from "@/components/homePage/CTASection.vue";
import PageReveal from "@/components/PageReveal.vue";
import { useFontsReady } from "@/composables/useFontsReady";

const { isReady } = useFontsReady();
</script>
<style scoped>
ion-margin-vertical {
  --ion-margin: 24px;
}
</style>
