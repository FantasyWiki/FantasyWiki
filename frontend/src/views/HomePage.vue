<template>
  <nav-bar>
    <!-- Sections are revealed top to bottom once the fonts have settled, so the
         reflow that used to run down the page in the open is now hidden behind
         a deliberate entrance. See useFontsReady. -->
    <div class="home-reveal" :class="{ 'home-reveal--visible': isReady }">
      <hero-section class="ion-margin-vertical"></hero-section>
      <how-it-works></how-it-works>
      <app-feature></app-feature>
      <leaderboard-preview></leaderboard-preview>
      <CTA-section></CTA-section>
    </div>
  </nav-bar>
</template>

<script setup lang="ts">
import HeroSection from "@/components/homePage/HeroSection.vue";
import NavBar from "@/layout/NavBar.vue";
import HowItWorks from "@/components/homePage/HowItWorks.vue";
import AppFeature from "@/components/homePage/AppFeature.vue";
import LeaderboardPreview from "@/components/homePage/LeaderboardPreview.vue";
import CTASection from "@/components/homePage/CTASection.vue";
import { useFontsReady } from "@/composables/useFontsReady";

const { isReady } = useFontsReady();
</script>
<style scoped>
ion-margin-vertical {
  --ion-margin: 24px;
}

/* Every section starts hidden and slides up into place. The stagger is what
   gives the reveal its top-to-bottom direction. */
.home-reveal > * {
  opacity: 0;
  transform: translateY(1.25rem);
}

.home-reveal--visible > * {
  opacity: 1;
  transform: none;
  transition:
    opacity 0.5s ease-out,
    transform 0.5s ease-out;
}

.home-reveal--visible > *:nth-child(2) {
  transition-delay: 90ms;
}

.home-reveal--visible > *:nth-child(3) {
  transition-delay: 180ms;
}

.home-reveal--visible > *:nth-child(4) {
  transition-delay: 270ms;
}

.home-reveal--visible > *:nth-child(5) {
  transition-delay: 360ms;
}

/* Motion is the garnish, never the gate: with it suppressed the sections are
   simply present, and the font swap is the only thing left to notice. */
@media (prefers-reduced-motion: reduce) {
  .home-reveal > *,
  .home-reveal--visible > * {
    opacity: 1;
    transform: none;
    transition: none;
    transition-delay: 0s;
  }
}
</style>
