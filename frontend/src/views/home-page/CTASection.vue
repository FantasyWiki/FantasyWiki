<template>
  <section class="ion-padding-vertical">
    <div class="container ion-padding">
      <div class="cta-card ion-padding">
        <!-- Pattern Overlay -->
        <div class="pattern-overlay"></div>

        <div class="cta-content ion-text-center">
          <ion-chip class="cta-badge" color="light">
            <ion-icon :icon="sparklesOutline" />
            <ion-label>Start Playing Today</ion-label>
          </ion-chip>

          <h2 class="cta-title ion-margin-top ion-margin-bottom">
            Ready to Build Your Knowledge Empire?
          </h2>

          <p class="cta-description ion-margin-bottom">
            Join thousands of players already competing in the world's first
            Wikipedia-based fantasy game. Start with 1,000 free credits.
          </p>

          <div class="cta-buttons ion-margin-bottom">
            <ion-button size="large" color="light">
              Create Free Account
              <ion-icon slot="end" :icon="arrowForward" />
            </ion-button>
            <ion-button size="large" fill="outline" color="light">
              Watch Demo
            </ion-button>
          </div>

          <p class="cta-footer">
            No credit card required • Free to play • Win real rewards
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { IonButton, IonChip, IonIcon, IonLabel } from '@ionic/vue';
import { sparklesOutline, arrowForward } from 'ionicons/icons';
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
}

.cta-card {
  position: relative;
  border-radius: 1.5rem;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  overflow: hidden;
  padding: 3rem;
}

@media (min-width: 768px) {
  .cta-card {
    padding: 4rem;
  }
}

.pattern-overlay {
  position: absolute;
  inset: 0;
  opacity: 0.1;
  background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E");
}

.cta-content {
  position: relative;
  max-width: 48rem;
  margin: 0 auto;
}

.cta-badge {
  --background: rgba(255, 255, 255, 0.2);
  --color: var(--ion-color-primary-contrast);
}

.cta-title {
  font-size: clamp(1.875rem, 5vw, 3rem);
  font-weight: bold;
  color: var(--ion-color-primary-contrast);
  line-height: 1.2;
}

.cta-description {
  font-size: clamp(1rem, 2vw, 1.25rem);
  color: rgba(255, 255, 255, 0.8);
}

.cta-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: center;
}

@media (min-width: 576px) {
  .cta-buttons {
    flex-direction: row;
  }
}

.cta-buttons ion-button {
  --padding-start: 2rem;
  --padding-end: 2rem;
}

.cta-buttons ion-button[fill="outline"] {
  --border-color: rgba(255, 255, 255, 0.3);
}

.cta-footer {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
}
</style>
