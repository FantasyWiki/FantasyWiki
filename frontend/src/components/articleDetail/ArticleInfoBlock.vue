<template>
  <div class="detail-section">
    <div class="summary-layout">
      <img
        class="summary-thumbnail"
        :src="thumbnailUrl"
        :alt="`${model.article.title} thumbnail`"
      />
      <div class="summary-text">
        <p class="section-label ion-no-margin">Wikipedia Extract</p>
        <p v-if="isLoadingSummary" class="summary-content ion-no-margin">
          Loading summary...
        </p>
        <p v-else class="summary-content ion-no-margin">
          {{ summaryText }}
        </p>
      </div>
    </div>

    <ion-grid class="ion-no-padding info-grid">
      <ion-row>
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">Current Price</p>
            </ion-text>
            <p class="info-value ion-no-margin">
              {{ model.currentPrice }} credits
            </p>
          </div>
        </ion-col>
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">Availability</p>
            </ion-text>
            <p class="info-value ion-no-margin">{{ availabilityText }}</p>
            <p v-if="model.ownerTeamName" class="owner-team ion-no-margin">
              {{ model.ownerTeamName }}
            </p>
          </div>
        </ion-col>
      </ion-row>
      <ion-row v-if="model.purchasePrice !== undefined">
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">Purchase Price</p>
            </ion-text>
            <p class="info-value ion-no-margin">
              {{ model.purchasePrice }} credits
            </p>
          </div>
        </ion-col>
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">Value Tracking</p>
            </ion-text>
            <p class="info-value ion-no-margin">
              {{ valueDelta >= 0 ? "+" : "" }}{{ valueDelta }} credits
            </p>
          </div>
        </ion-col>
      </ion-row>
    </ion-grid>

    <ion-text v-if="model.buyDisabledReason" color="medium">
      <p class="buy-hint ion-no-margin">{{ model.buyDisabledReason }}</p>
    </ion-text>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonCol, IonGrid, IonRow, IonText } from "@ionic/vue";
import type { ArticleDetailModel } from "@/components/articleDetail/articleDetailModel";

interface Props {
  model: ArticleDetailModel;
  summaryExtract?: string;
  summaryThumbnailUrl?: string;
  isLoadingSummary: boolean;
}

const props = defineProps<Props>();

const thumbnailUrl = computed(() => {
  return props.summaryThumbnailUrl ?? "/article-placeholder.svg";
});

const summaryText = computed(() => {
  if (props.summaryExtract && props.summaryExtract.trim().length > 0) {
    return props.summaryExtract;
  }
  return "Summary unavailable.";
});

const availabilityText = computed(() => {
  switch (props.model.availability) {
    case "free-agent":
      return "Free Agent";
    case "owned-by-viewer":
      return "Owned by your team";
    case "owned-by-other":
      return "Already Owned";
    default:
      return "Free Agent";
  }
});

const valueDelta = computed(() => {
  if (props.model.purchasePrice === undefined) return 0;
  return props.model.currentPrice - props.model.purchasePrice;
});
</script>

<style scoped>
.summary-layout {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.summary-thumbnail {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 0.5rem;
  border: 1px solid var(--ion-border-color);
}

.summary-text {
  min-width: 0;
}

.summary-content {
  margin-top: 0.4rem;
  line-height: 1.4;
}

.info-grid {
  margin-top: 0.25rem;
}

.info-box {
  background: var(--ion-background-color-step-50);
  border: 1px solid var(--ion-border-color);
  border-radius: 0.625rem;
  padding: 0.625rem 0.75rem;
  margin-bottom: 0.5rem;
}

.section-label,
.info-label {
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-top: 0.2rem;
}

.owner-team {
  margin-top: 0.15rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.buy-hint {
  margin-top: 0.15rem;
  font-size: 0.8rem;
}
</style>
