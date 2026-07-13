<template>
  <section class="section-panel contract-section">
    <div class="section-head">
      <h3 class="section-title">
        <ion-icon :icon="timeOutline" />
        {{ $t("articleDetail.contract.title") }}
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
                {{ $t("articleDetail.contract.expiresIn") }}
              </p>
            </ion-text>
            <p class="info-value ion-no-margin">
              {{ formatDuration(expiresIn) }}
            </p>
          </div>
        </ion-col>
      </ion-row>
    </ion-grid>

    <!-- The renew button disappears once renewal is elected (it can only be
         elected once), so the confirmation lives here instead — otherwise
         electing renewal would leave no trace anywhere in the modal. -->
    <template v-if="renewalElected">
      <p class="renewal-elected ion-no-margin">
        <ion-icon :icon="checkmarkCircleOutline" />
        {{ $t("articleDetail.contract.renewalElected") }}
      </p>
      <ion-text color="medium">
        <p class="renewal-charge ion-no-margin">{{ renewalChargeLabel }}</p>
      </ion-text>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Temporal } from "@js-temporal/polyfill";
import { IonChip, IonCol, IonGrid, IonIcon, IonRow, IonText } from "@ionic/vue";
import { checkmarkCircleOutline, timeOutline } from "ionicons/icons";
import { formatDuration } from "@/types/models";

interface Props {
  tier: string;
  expiresIn: Temporal.Duration;
  renewalElected?: boolean;
  /**
   * What the renewal will actually move on the balance at expiry — the *top-up*
   * to today's price, not the full renewal price, since the original stake is
   * already debited. Negative when the article got cheaper, which refunds.
   */
  renewalIncrementalCost?: number;
}

const props = defineProps<Props>();
const { t } = useI18n();

/**
 * The settlement sweep charges at expiry, not at election — so this is a
 * forecast off today's views, hence the "~". It moves with the article's price
 * until the sweep runs.
 */
const renewalChargeLabel = computed(() => {
  const cost = props.renewalIncrementalCost ?? 0;
  if (cost > 0) {
    return t("articleDetail.contract.renewalChargeAtExpiry", { amount: cost });
  }
  if (cost < 0) {
    return t("articleDetail.contract.renewalRefundAtExpiry", {
      amount: Math.abs(cost),
    });
  }
  return t("articleDetail.contract.renewalNoChargeAtExpiry");
});

const expiryDays = computed(() => {
  return Math.max(0, Math.floor(props.expiresIn.total("days")));
});

const expiryLabel = computed(() => {
  if (expiryDays.value <= 1) return t("articleDetail.contract.urgent");
  if (expiryDays.value <= 3) return t("articleDetail.contract.renewSoon");
  return t("articleDetail.contract.healthy");
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

.renewal-elected {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.6rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ion-color-success-shade);
}

.renewal-charge {
  margin-top: 0.15rem;
  font-size: 0.75rem;
}

@media (max-width: 576px) {
  .urgency-chip {
    font-size: 0.68rem;
    height: 1.45rem;
  }
}
</style>
