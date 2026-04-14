<template>
  <ion-modal
    :is-open="isOpen"
    @did-dismiss="emit('close')"
    :initial-breakpoint="0.92"
    :breakpoints="[0, 0.92, 1]"
    handle-behavior="cycle"
    class="article-detail-modal"
  >
    <!-- ── Header ───────────────────────────────── -->
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title class="modal-title">
          {{ selectedContract?.article.title ?? "Article Detail" }}
        </ion-title>

        <!-- Tier badge next to title -->
        <ion-badge
          slot="end"
          :color="getTierColor(selectedContract?.tier)"
          class="tier-badge"
        >
          {{ selectedContract?.tier }}
        </ion-badge>

        <ion-buttons slot="end">
          <ion-button fill="clear" @click="emit('close')">
            <ion-icon :icon="closeOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <!-- ── Content ──────────────────────────────── -->
    <ion-content v-if="selectedContract" class="ion-padding">
      <!-- 1. Points & current value highlight ───── -->
      <div class="highlight-section">
        <div class="highlight-row">
          <div class="text-right">
            <ion-text color="medium">
              <p class="section-label ion-no-margin">Current Value</p>
            </ion-text>
            <p class="current-value ion-no-margin">
              {{ selectedContract.currentPrice }} credits
            </p>
          </div>
        </div>
      </div>

      <ion-item-divider class="section-divider" />

      <!-- 2. Contract details ─────────────────────  -->
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
                  <p class="info-label ion-no-margin">
                    <ion-icon :icon="calendarOutline" class="inline-icon" />
                    Expires in
                  </p>
                </ion-text>
                <p
                  class="info-value ion-no-margin"
                  :class="{
                    'text-danger':
                      selectedContract.expiresIn.total('days') <= 3,
                  }"
                >
                  {{ formatDuration(selectedContract.expiresIn) }}
                </p>
              </div>
            </ion-col>
          </ion-row>
        </ion-grid>

        <!-- Expiry warning chip -->
        <ion-chip
          v-if="selectedContract.expiresIn.total('days') <= 3"
          color="danger"
          outline
          class="expiry-warning-chip"
        >
          <ion-icon :icon="warningOutline" />
          <ion-label>
            Contract expires
            {{
              selectedContract.expiresIn.total("days") <= 1
                ? "tomorrow"
                : `in ${formatDuration(selectedContract.expiresIn)}ays`
            }}
            — consider renewing
          </ion-label>
        </ion-chip>
      </div>

      <ion-item-divider class="section-divider" />

      <!-- 3. Value tracking ───────────────────────  -->
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
                  <p class="info-label ion-no-margin">Purchase Price</p>
                </ion-text>
                <p class="info-value ion-no-margin">
                  {{ selectedContract.purchasePrice }} credits
                </p>
              </div>
            </ion-col>
            <ion-col size="6">
              <div class="info-box">
                <ion-text color="medium">
                  <p class="info-label ion-no-margin">Current Value</p>
                </ion-text>
                <p class="info-value ion-no-margin">
                  {{ selectedContract.currentPrice }} credits
                </p>
              </div>
            </ion-col>
          </ion-row>
        </ion-grid>

        <!-- Value change pill -->
        <div
          class="value-change-pill"
          :class="
            valueChange >= 0
              ? 'value-change-pill--up'
              : 'value-change-pill--down'
          "
        >
          <ion-icon
            :icon="valueChange >= 0 ? trendingUpOutline : trendingDownOutline"
          />
          <span>
            {{ valueChange >= 0 ? "+" : "" }}{{ valueChange }} credits ({{
              valueChange >= 0 ? "+" : ""
            }}{{ valueChangePercent }}%)
          </span>
        </div>
      </div>

      <ion-item-divider class="section-divider" />

      <!-- 4. Actions ──────────────────────────────  -->
      <div class="detail-section actions-section">
        <!-- Renew — only shown when contract is close to expiry -->
        <ion-button
          v-if="selectedContract.expiresIn.total('days') <= 3"
          expand="block"
          color="primary"
          fill="solid"
          @click="emit('renew', selectedContract)"
        >
          <ion-icon slot="start" :icon="refreshOutline" />
          Renew Contract
        </ion-button>

        <!-- Swap article -->
        <ion-button
          expand="block"
          fill="outline"
          @click="emit('swap', selectedContract)"
        >
          <ion-icon slot="start" :icon="swapHorizontalOutline" />
          Swap Article
        </ion-button>

        <!-- Close -->
        <ion-button
          expand="block"
          fill="clear"
          color="medium"
          @click="emit('close')"
        >
          Close
        </ion-button>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItemDivider,
  IonLabel,
  IonModal,
  IonRow,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import {
  calendarOutline,
  cashOutline,
  closeOutline,
  refreshOutline,
  swapHorizontalOutline,
  timeOutline,
  trendingDownOutline,
  trendingUpOutline,
  warningOutline,
} from "ionicons/icons";
import { ContractDTO } from "../../../dto/contractDTO";
import { formatDuration } from "@/types/models";

// ── Props ─────────────────────────────────────────
interface Props {
  /** The contract to display. Pass null to unmount content. */
  selectedContract: ContractDTO | null;
  /** Controls modal visibility. */
  isOpen: boolean;
}

const props = defineProps<Props>();

// ── Emits ─────────────────────────────────────────
const emit = defineEmits<{
  /** Modal dismissed / Close button tapped */
  close: [];
  /** Renew Contract button tapped */
  renew: [contract: ContractDTO];
  /** Swap Article button tapped */
  swap: [contract: ContractDTO];
}>();

// ── Computed ──────────────────────────────────────
const valueChange = computed(() => {
  if (!props.selectedContract) return 0;
  return (
    props.selectedContract.currentPrice - props.selectedContract.purchasePrice
  );
});

const valueChangePercent = computed(() => {
  if (!props.selectedContract || props.selectedContract.purchasePrice === 0)
    return "0.0";
  return (
    (valueChange.value / props.selectedContract.purchasePrice) *
    100
  ).toFixed(1);
});

// ── Helpers ───────────────────────────────────────
function getTierColor(tier?: string): string {
  switch (tier) {
    case "SHORT":
      return "warning";
    case "MEDIUM":
      return "primary";
    case "LONG":
      return "success";
    default:
      return "medium";
  }
}
</script>

<style scoped>
/* ── Modal shell ─────────────────────────────── */
.article-detail-modal {
  --border-radius: 1rem 1rem 0 0;
}

/* ── Toolbar ─────────────────────────────────── */
ion-toolbar {
  --background: var(--ion-background-color);
  --border-width: 0;
  padding-right: 0.25rem;
}

.modal-title {
  font-family: var(--font-family-headings), serif;
  font-size: 1.1rem;
  font-weight: 700;
  padding-inline-start: 1rem;
}

.tier-badge {
  font-size: 0.65rem;
  margin-right: 0.25rem;
  padding: 3px 8px;
  border-radius: 999px;
}

/* ── Highlight block ─────────────────────────── */
.highlight-section {
  background: rgba(var(--ion-color-primary-rgb), 0.06);
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  margin-bottom: 0.5rem;
}

.highlight-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.highlight-row .text-right {
  text-align: right;
}

.section-label {
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}

.current-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-top: 4px;
}

/* ── Section divider ─────────────────────────── */
.section-divider {
  --background: var(--ion-border-color);
  --padding-start: 0;
  min-height: 1px;
  margin: 0.5rem 0;
}

/* ── Generic detail section ──────────────────── */
.detail-section {
  padding: 0.75rem 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-family-headings), serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-color-dark);
  margin: 0 0 0.75rem 0;
}

.section-title ion-icon {
  font-size: 1rem;
  color: var(--ion-color-medium);
}

/* ── Info boxes (contract & value grid) ──────── */
.info-box {
  background: var(--ion-background-color-step-50);
  border: 1px solid var(--ion-border-color);
  border-radius: 0.625rem;
  padding: 0.625rem 0.75rem;
  margin-bottom: 0.5rem;
}

.info-label {
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.info-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.text-danger {
  color: var(--ion-color-danger) !important;
}

/* ── Expiry warning chip ─────────────────────── */
.expiry-warning-chip {
  width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 0.375rem 0 0;
  --background: transparent;
  font-size: 0.78rem;
  white-space: normal;
}

.expiry-warning-chip ion-label {
  white-space: normal;
  line-height: 1.4;
  padding: 0.25rem 0;
}

/* ── Value change pill ───────────────────────── */
.value-change-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  border-radius: 0.625rem;
  font-weight: 600;
  font-size: 0.9rem;
  margin-top: 0.375rem;
}

.value-change-pill ion-icon {
  font-size: 1rem;
}

.value-change-pill--up {
  background: rgba(var(--ion-color-success-rgb), 0.1);
  color: var(--ion-color-success);
}

.value-change-pill--down {
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  color: var(--ion-color-danger);
}

/* ── Actions section ─────────────────────────── */
.actions-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 1.5rem;
}

.actions-section ion-button {
  --border-radius: 0.625rem;
  margin: 0;
}

/* ── Inline icon utility ─────────────────────── */
.inline-icon {
  font-size: 0.8rem;
  vertical-align: middle;
  margin-right: 2px;
}
</style>
