<template>
  <section class="section-panel contract-section">
    <div class="section-head">
      <h3 class="section-title">
        <ion-icon :icon="timeOutline" />
        Contract Details
      </h3>
      <ion-chip
        class="urgency-chip"
        :class="{
          'urgency-chip--critical': expiryDays <= 1,
          'urgency-chip--warning': expiryDays > 1 && expiryDays <= 3,
        }"
      >
        {{ expiryLabel }}
      </ion-chip>
    </div>

    <ion-grid class="ion-no-padding">
      <ion-row>
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">Tier</p>
            </ion-text>
            <p class="info-value ion-no-margin">
              {{ selectedContract.tier }}
            </p>
          </div>
        </ion-col>
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">Expires in</p>
            </ion-text>
            <p class="info-value ion-no-margin">
              {{ formatDuration(selectedContract.expiresIn) }}
            </p>
          </div>
        </ion-col>
      </ion-row>
    </ion-grid>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonChip, IonCol, IonGrid, IonIcon, IonRow, IonText } from "@ionic/vue";
import { timeOutline } from "ionicons/icons";
import { ContractDTO } from "../../../../dto/contractDTO";
import { formatDuration } from "@/types/models";

interface Props {
  selectedContract: ContractDTO;
}

const props = defineProps<Props>();

const expiryDays = computed(() => {
  return Math.max(
    0,
    Math.floor(props.selectedContract.expiresIn.total("days"))
  );
});

const expiryLabel = computed(() => {
  if (expiryDays.value <= 1) return "Urgent";
  if (expiryDays.value <= 3) return "Renew soon";
  return "Healthy";
});
</script>

<style scoped src="./articleDetailShared.css"></style>

<style scoped>
.contract-section {
  margin-bottom: 1rem;
}

.urgency-chip {
  --background: rgba(var(--ion-color-success-rgb), 0.12);
  --color: var(--ion-color-success-shade);
  font-weight: 600;
}

.urgency-chip--warning {
  --background: rgba(var(--ion-color-warning-rgb), 0.18);
  --color: var(--ion-color-warning-shade);
}

.urgency-chip--critical {
  --background: rgba(var(--ion-color-danger-rgb), 0.18);
  --color: var(--ion-color-danger-shade);
}

@media (max-width: 576px) {
  .urgency-chip {
    font-size: 0.68rem;
    height: 1.45rem;
  }
}
</style>
