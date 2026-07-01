<template>
  <section class="section-panel locked-section">
    <div class="section-head">
      <h3 class="section-title">
        <ion-icon :icon="lockClosedOutline" />
        {{ $t("articleDetail.locked.title") }}
      </h3>
    </div>

    <ion-grid class="ion-no-padding">
      <ion-row>
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">
                {{ $t("articleDetail.contract.tier") }}
              </p>
            </ion-text>
            <p class="info-value ion-no-margin">
              {{ tier }}
            </p>
          </div>
        </ion-col>
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">
                {{ $t("articleDetail.locked.unlocksIn") }}
              </p>
            </ion-text>
            <p class="info-value ion-no-margin">
              {{ formatDuration(unlockIn) }}
            </p>
          </div>
        </ion-col>
      </ion-row>
    </ion-grid>

    <ion-text color="medium">
      <p class="held-by ion-no-margin">
        {{ $t("articleDetail.locked.heldBy", { name: ownerTeamName }) }}
      </p>
    </ion-text>
  </section>
</template>

<script setup lang="ts">
import { Temporal } from "@js-temporal/polyfill";
import { IonCol, IonGrid, IonIcon, IonRow, IonText } from "@ionic/vue";
import { lockClosedOutline } from "ionicons/icons";
import { formatDuration } from "@/types/models";

interface Props {
  tier: string;
  unlockIn: Temporal.Duration;
  ownerTeamName: string;
}

defineProps<Props>();
</script>

<style scoped src="./articleDetailShared.css"></style>

<style scoped>
.locked-section {
  margin-bottom: 1rem;
}

.held-by {
  font-size: 0.82rem;
  margin: 0.35rem 0.5rem 0;
}
</style>
