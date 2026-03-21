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
          {{ selectedContract?.article.name ?? "Article Detail" }}
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
          <div>
            <ion-text color="medium">
              <p class="section-label ion-no-margin">Yesterday's Points</p>
            </ion-text>
            <h2 class="highlight-value ion-no-margin">
              {{ selectedContract.yesterdayPoints }}
            </h2>
          </div>
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
                  :class="{ 'text-danger': selectedContract.expiresIn <= 3 }"
                >
                  {{ selectedContract.expiresIn }} days
                </p>
              </div>
            </ion-col>
          </ion-row>
        </ion-grid>

        <!-- Expiry warning chip -->
        <ion-chip
          v-if="selectedContract.expiresIn <= 3"
          color="danger"
          outline
          class="expiry-warning-chip"
        >
          <ion-icon :icon="warningOutline" />
          <ion-label>
            Contract expires
            {{
              selectedContract.expiresIn <= 1
                ? "tomorrow"
                : `in ${selectedContract.expiresIn} days`
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

      <!-- 4. Linked trade proposal ────────────────  -->
      <template v-if="linkedProposal">
        <ion-item-divider class="section-divider" />

        <div class="detail-section">
          <h3 class="section-title">
            <ion-icon :icon="swapHorizontalOutline" />
            Pending Trade Proposal
          </h3>

          <div class="trade-proposal-box">
            <!-- From user -->
            <div class="trade-meta-row">
              <ion-text color="medium">
                <span class="trade-meta-label">From</span>
              </ion-text>
              <span class="trade-meta-value">{{
                linkedProposal.fromUser
              }}</span>
            </div>

            <!-- What they offer -->
            <div class="trade-offer-row">
              <ion-text color="medium">
                <p class="info-label ion-no-margin">They offer:</p>
              </ion-text>
              <div class="trade-badges">
                <ion-chip
                  v-if="linkedProposal.offeredArticle"
                  color="primary"
                  outline
                  class="trade-chip"
                >
                  <ion-label>{{
                    linkedProposal.offeredArticle.title
                  }}</ion-label>
                </ion-chip>
                <ion-chip
                  v-if="linkedProposal.offeredCredits"
                  color="primary"
                  outline
                  class="trade-chip"
                >
                  <ion-icon :icon="cashOutline" />
                  <ion-label
                    >{{ linkedProposal.offeredCredits }} credits</ion-label
                  >
                </ion-chip>
              </div>
            </div>

            <!-- Accept / Decline -->
            <div class="trade-actions">
              <ion-button
                expand="block"
                color="primary"
                fill="solid"
                @click="emit('acceptTrade', linkedProposal)"
              >
                <ion-icon slot="start" :icon="checkmarkOutline" />
                Accept Trade
              </ion-button>
              <ion-button
                expand="block"
                color="danger"
                fill="outline"
                @click="emit('rejectTrade', linkedProposal)"
              >
                <ion-icon slot="start" :icon="closeOutline" />
                Decline
              </ion-button>
            </div>
          </div>
        </div>
      </template>

      <!-- 5. Chemistry links (optional) ──────────  -->
      <template v-if="chemistryLinks && chemistryLinks.length > 0">
        <ion-item-divider class="section-divider" />

        <div class="detail-section">
          <h3 class="section-title">
            <ion-icon :icon="linkOutline" />
            Chemistry Links
          </h3>

          <ion-list lines="none" class="chemistry-list">
            <ion-item
              v-for="link in chemistryLinks"
              :key="link.articleName"
              class="chemistry-item"
              :detail="false"
            >
              <div class="chemistry-row">
                <!-- Coloured dot -->
                <div
                  class="chemistry-dot"
                  :style="{ background: getChemistryColor(link.chemistry) }"
                />
                <span class="chemistry-name">{{ link.articleName }}</span>
                <div class="chemistry-label-group">
                  <span
                    class="chemistry-label"
                    :style="{ color: getChemistryColor(link.chemistry) }"
                  >
                    {{ getChemistryLabel(link.chemistry).label }}
                  </span>
                  <ion-text color="medium">
                    <span class="chemistry-bonus">
                      {{ getChemistryLabel(link.chemistry).description }}
                    </span>
                  </ion-text>
                </div>
              </div>
            </ion-item>
          </ion-list>
        </div>
      </template>

      <ion-item-divider class="section-divider" />

      <!-- 6. Actions ──────────────────────────────  -->
      <div class="detail-section actions-section">
        <!-- Renew — only shown when contract is close to expiry -->
        <ion-button
          v-if="selectedContract.expiresIn <= 3"
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
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonModal,
  IonRow,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import {
  calendarOutline,
  cashOutline,
  checkmarkOutline,
  closeOutline,
  linkOutline,
  refreshOutline,
  swapHorizontalOutline,
  timeOutline,
  trendingDownOutline,
  trendingUpOutline,
  warningOutline,
} from "ionicons/icons";
import type { Contract } from "@/types/models";

// ── Chemistry types (self-contained so the modal ──
// ── can be used outside the Team page too)       ──
export type ChemistryLevel = "green" | "yellow" | "orange" | "red";

export interface ChemistryLink {
  articleName: string;
  chemistry: ChemistryLevel;
}

// ── Trade proposal (subset – only fields needed here)
export interface TradeProposalRef {
  id: number;
  fromUser: string;
  offeredArticle?: { title: string; basePrice: number };
  offeredCredits?: number;
  requestedArticle: { title: string; basePrice: number };
}

// ── Props ─────────────────────────────────────────
interface Props {
  /** The contract to display. Pass null to unmount content. */
  selectedContract: Contract | null;
  /** Controls modal visibility. */
  isOpen: boolean;
  /**
   * Optional incoming trade proposal linked to this contract.
   * When provided the "Pending Trade Proposal" section is shown.
   */
  linkedProposal?: TradeProposalRef | null;
  /**
   * Optional chemistry links for formation articles.
   * When provided the "Chemistry Links" section is shown.
   */
  chemistryLinks?: ChemistryLink[];
}

const props = defineProps<Props>();

// ── Emits ─────────────────────────────────────────
const emit = defineEmits<{
  /** Modal dismissed / Close button tapped */
  close: [];
  /** Renew Contract button tapped */
  renew: [contract: Contract];
  /** Swap Article button tapped */
  swap: [contract: Contract];
  /** Accept trade proposal */
  acceptTrade: [proposal: TradeProposalRef];
  /** Reject trade proposal */
  rejectTrade: [proposal: TradeProposalRef];
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

function getChemistryColor(level: ChemistryLevel): string {
  switch (level) {
    case "green":
      return "var(--ion-color-primary)";
    case "yellow":
      return "var(--ion-color-warning)";
    case "orange":
      return "#f97316";
    case "red":
      return "var(--ion-color-danger)";
  }
}

function getChemistryLabel(level: ChemistryLevel): {
  label: string;
  description: string;
} {
  switch (level) {
    case "green":
      return { label: "Excellent", description: "+20% bonus" };
    case "yellow":
      return { label: "Good", description: "+10% bonus" };
    case "orange":
      return { label: "Weak", description: "+5% bonus" };
    case "red":
      return { label: "Poor", description: "No bonus" };
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
  font-family: var(--font-family-headings);
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

.highlight-value {
  font-family: var(--font-family-headings);
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--ion-color-primary);
  line-height: 1;
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
  font-family: var(--font-family-headings);
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

/* ── Trade proposal box ──────────────────────── */
.trade-proposal-box {
  background: rgba(var(--ion-color-primary-rgb), 0.05);
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.2);
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.trade-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.trade-meta-label {
  font-size: 0.78rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.trade-meta-value {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--ion-color-dark);
}

.trade-offer-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.trade-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.trade-chip {
  height: 1.75rem;
  font-size: 0.78rem;
  margin: 0;
}

.trade-chip ion-icon {
  font-size: 0.85rem;
  margin-right: 4px;
}

.trade-actions {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-top: 0.25rem;
}

.trade-actions ion-button {
  --border-radius: 0.5rem;
  margin: 0;
}

/* ── Chemistry list ──────────────────────────── */
.chemistry-list {
  padding: 0;
  border-radius: 0.625rem;
  overflow: hidden;
  border: 1px solid var(--ion-border-color);
}

.chemistry-item {
  --background: var(--ion-background-color);
  --padding-start: 0.75rem;
  --padding-end: 0.75rem;
  --inner-padding-end: 0;
  --min-height: 2.75rem;
  --border-color: var(--ion-border-color);
}

.chemistry-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0;
}

.chemistry-dot {
  width: 0.625rem;
  height: 0.625rem;
  min-width: 0.625rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.chemistry-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--ion-color-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chemistry-label-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.chemistry-label {
  font-size: 0.78rem;
  font-weight: 600;
}

.chemistry-bonus {
  font-size: 0.7rem;
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

/* ── Dark mode ───────────────────────────────── */
.ion-palette-dark .current-value,
.ion-palette-dark .info-value,
.ion-palette-dark .trade-meta-value,
.ion-palette-dark .chemistry-name,
.ion-palette-dark .section-title {
  color: var(--ion-color-light);
}

.ion-palette-dark .highlight-section {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
}

.ion-palette-dark .info-box {
  background: var(--ion-background-color-step-100);
}
</style>
