<template>
  <section class="ion-padding-vertical">
    <ion-grid>
      <ion-row class="ion-justify-content-center">
        <ion-col size="12" size-md="10" size-lg="8" size-xl="6">
          <div class="cta-card ion-padding">
            <!-- Pattern Overlay -->
            <div class="pattern-overlay"></div>

            <div class="cta-content ion-text-center">
              <ion-chip color="light">
                <ion-icon :icon="sparklesOutline" />
                <ion-label>Start Playing Today</ion-label>
              </ion-chip>

              <h2 class="cta-title ion-margin-top ion-margin-bottom">
                <ion-text color="light">
                  Ready to Build Your Knowledge Empire?
                </ion-text>
              </h2>

              <ion-text color="light" class="cta-description ion-margin-bottom">
                <p>
                  Join thousands of players already competing in the world's first
                  Wikipedia-based fantasy game. Start with 1,000 free credits.
                </p>
              </ion-text>

              <div class="ion-margin-bottom">
                <ion-button size="large" color="light">
                  Create Free Account
                  <ion-icon slot="end" :icon="arrowForward" />
                </ion-button>
              </div>

              <ion-text color="light" class="cta-footer">
                <p>
                  No credit card required • Free to play • Win real rewards
                </p>
              </ion-text>
            </div>
          </div>
        </ion-col>
      </ion-row>
    </ion-grid>
  </section>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonChip,
  IonIcon,
  IonLabel,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
} from "@ionic/vue";
import { sparklesOutline, arrowForward } from "ionicons/icons";
</script>

<style scoped>
.cta-card {
  position: relative;
  border-radius: 1.5rem;
  background: linear-gradient(
    135deg,
    var(--ion-color-primary),
    var(--ion-color-primary-shade)
  );
  overflow: hidden;
  --ion-padding: 3rem;
}

.pattern-overlay {
  position: absolute;
  inset: 0;
  opacity: 0.1;
  background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E");
}

.cta-content {
  position: relative;
}

.cta-title {
  font-size: clamp(1.875rem, 5vw, 3rem);
}

.cta-description {
  font-size: clamp(1rem, 2vw, 1.25rem);
}

.cta-footer {
  font-size: 0.875rem;
}
</style>
