<template>
  <ion-card class="needed-attention-card">
    <ion-card-header>
      <div class="attention-header">
        <div class="header-left">
          <div class="icon-wrapper">
            <ion-icon :icon="alertCircleOutline" color="warning" />
          </div>
          <div>
            <ion-card-title>Attention Needed</ion-card-title>
            <ion-card-subtitle>
              <span v-if="props.urgentContract.length > 0">
                {{ props.urgentContract.length }} contract{{
                  props.urgentContract.length !== 1 ? "s" : ""
                }}
                requiring action
              </span>
              <span v-else>All contracts are healthy</span>
            </ion-card-subtitle>
          </div>
        </div>

        <ion-button
          v-if="props.onBuyArticles"
          fill="outline"
          size="small"
          color="primary"
          @click="props.onBuyArticles"
        >
          <ion-icon slot="start" :icon="addOutline" />
          Buy More
        </ion-button>
      </div>
    </ion-card-header>

    <ion-card-content class="ion-no-padding">
      <!-- Empty state -->
      <div v-if="props.urgentContract.length === 0" class="empty-state">
        <ion-icon
          :icon="checkmarkCircleOutline"
          color="success"
          class="empty-icon"
        />
        <ion-text color="medium">
          <p class="ion-no-margin">No contracts need attention right now</p>
        </ion-text>
      </div>

      <!-- Sliding list -->
      <!--
        urgentContract is already filtered by the parent (TeamDashboard).
        This component just renders what it receives — no filtering here.
      -->
      <ion-list v-else lines="none" class="attention-list">
        <ion-item-sliding
          v-for="contract in props.urgentContract"
          :key="contract.id"
        >
          <ion-item-options side="start">
            <ion-item-option color="primary" @click="onRenew(contract)">
              <ion-icon slot="top" :icon="refreshOutline" />
              Renew
            </ion-item-option>
          </ion-item-options>

          <ion-item
            class="attention-item"
            :class="{ 'attention-item--critical': contract.expiresIn <= 1 }"
            button
            :detail="false"
            @click="openDetail(contract)"
          >
            <div class="item-row">
              <div class="item-info">
                <div class="item-name-row">
                  <span class="item-name">{{ contract.article.name }}</span>
                  <ion-badge
                    :color="getTierColor(contract.tier)"
                    class="tier-badge"
                  >
                    {{ contract.tier }}
                  </ion-badge>
                </div>
                <div class="item-badges">
                  <ion-chip
                    v-if="contract.expiresIn <= 3"
                    :color="contract.expiresIn <= 1 ? 'danger' : 'warning'"
                    class="expiry-chip"
                    outline
                  >
                    <ion-icon :icon="timeOutline" />
                    <ion-label>{{ contract.expiresIn }}d left</ion-label>
                  </ion-chip>
                </div>
              </div>

              <div class="item-stats">
                <span class="item-points"
                  >{{ contract.yesterdayPoints }} pts</span
                >
                <div class="item-trend item-trend--up">
                  <ion-icon :icon="trendingUpOutline" />
                  <span>+5%</span>
                </div>
              </div>

              <ion-icon
                :icon="alertCircleOutline"
                class="item-chevron"
                color="medium"
              />
            </div>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option color="danger" @click="onDismiss(/*contract*/)">
              <ion-icon slot="top" :icon="closeOutline" />
              Dismiss
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>
    </ion-card-content>
  </ion-card>

  <ArticleDetail
    v-if="selectedContract"
    :selectedContract="selectedContract"
    :isOpen="isModalOpen"
    @close="closeDetail"
  />
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonText,
} from "@ionic/vue";
import {
  addOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  closeOutline,
  refreshOutline,
  swapHorizontalOutline,
  timeOutline,
  trendingUpOutline,
} from "ionicons/icons";
import ArticleDetail from "@/modules/ArticleDetail.vue";
import { useNotifications } from "@/stores/useNotifications";
import { ContractDTO } from "../../../../dto/contractDTO";

// ── Props ──────────────────────────────────────────────────────────────────
// urgentContract is pre-filtered by the parent. This component does not
// filter — it renders what it receives. Single responsibility.
interface Props {
  urgentContract: ContractDTO[];
  onBuyArticles?: () => void;
}

const props = defineProps<Props>();

// ── Trade offer detection ──────────────────────────────────────────────────
// hasTradeOffer checks the current-league notification list from the
// global notifications query. No store dependency needed.
const { hasTradeOffer } = useNotifications();

// ── Local modal state ──────────────────────────────────────────────────────
const selectedContract = ref<ContractDTO | null>(null);
const isModalOpen = ref(false);

function openDetail(contract: ContractDTO) {
  selectedContract.value = contract;
  isModalOpen.value = true;
}

function closeDetail() {
  isModalOpen.value = false;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getTierColor(tier: string): string {
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

function onRenew(contract: ContractDTO) {
  // TODO: call renewal API via useMutation when the endpoint is ready
  console.log("Renew contract", contract.id);
}

function onDismiss(/*contract: Contract*/) {
  // TODO: call archive/dismiss API via useMutation when the endpoint is ready
}
</script>

<style scoped>
.needed-attention-card {
  --background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  border-radius: 0.875rem;
  box-shadow: 0 2px 8px var(--ion-box-shadow-color);
  margin: 0 0 1rem 0;
}

.attention-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-wrapper {
  width: 2.5rem;
  height: 2.5rem;
  min-width: 2.5rem;
  border-radius: 0.5rem;
  background: rgba(var(--ion-color-warning-rgb), 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-wrapper ion-icon {
  font-size: 1.25rem;
}

ion-card-title {
  font-size: 1.1rem;
  margin-bottom: 2px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 1rem;
  gap: 0.75rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
}

.attention-list {
  padding: 0.25rem 0 0.5rem;
}

.attention-item {
  --background: var(--ion-background-color);
  --border-radius: 0.5rem;
  --padding-start: 1rem;
  --padding-end: 0.75rem;
  --inner-padding-end: 0;
  --min-height: 4rem;
  margin: 0.25rem 0.5rem;
  border: 1px solid var(--ion-border-color);
  border-radius: 0.5rem;
  transition: background 0.15s ease;
}

.attention-item--critical {
  border-color: rgba(var(--ion-color-danger-rgb), 0.4);
  --background: rgba(var(--ion-color-danger-rgb), 0.04);
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 0;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-name-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.item-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--ion-text-color);
}

.tier-badge {
  font-size: 0.65rem;
  height: 1.15rem;
  padding: 0 6px;
}

.item-badges {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.expiry-chip,
.trade-chip {
  height: 1.4rem;
  font-size: 0.7rem;
  margin: 0;
}
.expiry-chip ion-icon,
.trade-chip ion-icon {
  font-size: 0.75rem;
  margin-right: 3px;
}

.item-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.item-points {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--ion-text-color);
}

.item-trend {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.75rem;
  font-weight: 600;
}
.item-trend ion-icon {
  font-size: 0.8rem;
}
.item-trend--up {
  color: var(--ion-color-success);
}
.item-trend--down {
  color: var(--ion-color-danger);
}

.item-chevron {
  font-size: 1rem;
  flex-shrink: 0;
}

/* ion-text-color already adapts in dark mode — no override needed */
</style>
