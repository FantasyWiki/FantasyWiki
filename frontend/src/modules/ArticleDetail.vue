<template>
  <ion-modal :is-open="isOpen" @didDismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <!-- Contract has article.name, not name directly -->
        <ion-title>{{ selectedContract?.article.name }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="emit('close')">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content v-if="selectedContract" class="ion-padding">
      <!-- Points & Value -->
      <div class="detail-section highlight-section">
        <div class="detail-row">
          <div>
            <ion-text color="medium">
              <p class="detail-label">Yesterday's Points</p>
            </ion-text>
            <h2 class="detail-value primary">
              {{ selectedContract.yesterdayPoints }}
            </h2>
          </div>
          <div class="text-right">
            <ion-text color="medium">
              <p class="detail-label">Current Value</p>
            </ion-text>
            <p class="detail-value">
              {{ selectedContract.currentPrice }} credits
            </p>
          </div>
        </div>
      </div>

      <ion-item-divider />

      <!-- Contract Details -->
      <div class="detail-section">
        <h3 class="section-title">
          <ion-icon :icon="timeOutline" />
          Contract Details
        </h3>
        <ion-grid class="ion-no-padding">
          <ion-row>
            <ion-col size="6">
              <div class="info-box">
                <ion-text color="medium">
                  <p class="info-label">Tier</p>
                </ion-text>
                <p class="info-value">{{ selectedContract.tier }}</p>
              </div>
            </ion-col>
            <ion-col size="6">
              <div class="info-box">
                <ion-text color="medium">
                  <p class="info-label">
                    <ion-icon :icon="calendarOutline" />
                    Expires
                  </p>
                </ion-text>
                <p
                  class="info-value"
                  :class="selectedContract.expiresIn <= 3 ? 'text-danger' : ''"
                >
                  {{ selectedContract.expiresIn }} days
                </p>
              </div>
            </ion-col>
          </ion-row>
        </ion-grid>
      </div>

      <ion-item-divider />

      <!-- Value Tracking -->
      <div class="detail-section">
        <h3 class="section-title">
          <ion-icon :icon="cashOutline" />
          Value Tracking
        </h3>
        <ion-grid class="ion-no-padding">
          <ion-row>
            <ion-col size="6">
              <div class="info-box">
                <ion-text color="medium">
                  <p class="info-label">Purchase Price</p>
                </ion-text>
                <p class="info-value">
                  {{ selectedContract.purchasePrice }} credits
                </p>
              </div>
            </ion-col>
            <ion-col size="6">
              <div class="info-box">
                <ion-text color="medium">
                  <p class="info-label">Current Value</p>
                </ion-text>
                <p class="info-value">
                  {{ selectedContract.currentPrice }} credits
                </p>
              </div>
            </ion-col>
          </ion-row>
        </ion-grid>

        <div
          class="value-change"
          :class="valueChange >= 0 ? 'positive' : 'negative'"
        >
          <ion-icon
            :icon="valueChange >= 0 ? trendingUpOutline : trendingDownOutline"
          />
          <span
            >{{ valueChange >= 0 ? "+" : "" }}{{ valueChange }} credits ({{
              valueChangePercent
            }}%)</span
          >
        </div>
      </div>

      <ion-item-divider />

      <!-- Actions -->
      <div class="detail-section">
        <ion-button
          v-if="selectedContract.expiresIn <= 3"
          expand="block"
          color="primary"
          class="ion-margin-bottom"
        >
          <ion-icon slot="start" :icon="refreshOutline" />
          Renew Contract
        </ion-button>
        <ion-button expand="block" fill="clear" @click="emit('close')">
          Close
        </ion-button>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { Contract } from "@/types/models";
import {
  calendarOutline,
  cashOutline,
  closeOutline,
  refreshOutline,
  timeOutline,
  trendingDownOutline,
  trendingUpOutline,
} from "ionicons/icons";
import {
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItemDivider,
  IonModal,
  IonRow,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import { computed } from "vue";

// Props definition
const props = defineProps<{
  selectedContract: Contract | null;
  isOpen: boolean;
}>();

// Emits definition
const emit = defineEmits<{
  close: [];
}>();

// Fixed computed - don't use .value on props
const valueChange = computed(() => {
  if (!props.selectedContract) return 0;
  return (
    props.selectedContract.currentPrice - props.selectedContract.purchasePrice
  );
});

const valueChangePercent = computed(() => {
  if (!props.selectedContract) return "0";
  const change = valueChange.value;
  return ((change / props.selectedContract.purchasePrice) * 100).toFixed(1);
});
</script>

<style scoped>
/* Your styles here */
</style>
