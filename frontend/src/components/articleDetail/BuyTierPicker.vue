<template>
  <section class="section-panel buy-section">
    <div class="section-head">
      <h3 class="section-title">
        <ion-icon :icon="cartOutline" />
        {{ $t("articleDetail.buy.title") }}
      </h3>
    </div>

    <ion-text color="medium">
      <p class="tier-label ion-no-margin">
        {{ $t("articleDetail.buy.selectTier") }}
      </p>
    </ion-text>

    <ion-segment
      class="tier-segment"
      :value="selectedTier"
      @ionChange="
        emit(
          'update:selectedTier',
          ($event.target as HTMLIonSegmentElement).value as ContractTier
        )
      "
    >
      <ion-segment-button
        v-for="option in options"
        :key="option.tier"
        :value="option.tier"
      >
        <ion-label>{{ tierLabel(option.tier) }}</ion-label>
      </ion-segment-button>
    </ion-segment>

    <div class="info-box price-box">
      <ion-text color="medium">
        <p class="info-label ion-no-margin">
          {{ $t("articleDetail.buy.price") }}
        </p>
      </ion-text>
      <ion-spinner v-if="isLoadingViews" name="dots" />
      <p v-else class="info-value ion-no-margin">
        {{ $t("articleDetail.stats.credits", { count: selectedPrice ?? 0 }) }}
      </p>
      <ion-text v-if="!isLoadingViews && notEnoughCredits" color="danger">
        <p class="not-enough ion-no-margin">
          {{ $t("articleDetail.buy.notEnoughCredits") }}
        </p>
      </ion-text>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
} from "@ionic/vue";
import { cartOutline } from "ionicons/icons";
import type { ContractTier, TierPriceOption } from "@/types/articleDetail";

interface Props {
  options: TierPriceOption[];
  selectedTier: ContractTier;
  viewerCredits: number;
  /** True while the live views fetch is in flight — options are floor-priced/wrong until it resolves. */
  isLoadingViews?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:selectedTier": [tier: ContractTier];
}>();
const { t } = useI18n();

const selectedPrice = computed(
  () => props.options.find((o) => o.tier === props.selectedTier)?.price
);

const notEnoughCredits = computed(
  () =>
    selectedPrice.value !== undefined &&
    selectedPrice.value > props.viewerCredits
);

function tierLabel(tier: ContractTier): string {
  switch (tier) {
    case "SHORT":
      return t("articleDetail.buy.tierShort");
    case "MEDIUM":
      return t("articleDetail.buy.tierMedium");
    case "LONG":
      return t("articleDetail.buy.tierLong");
  }
}
</script>

<style scoped src="./articleDetailShared.css"></style>

<style scoped>
.buy-section {
  margin-bottom: 1rem;
}

.tier-label {
  font-size: 0.75rem;
  margin-bottom: 0.4rem;
}

.tier-segment {
  margin-bottom: 0.5rem;
}

.price-box {
  min-height: 68px;
}

.not-enough {
  font-size: 0.78rem;
  font-weight: 600;
  margin-top: 0.3rem;
}
</style>
