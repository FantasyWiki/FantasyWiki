<template>
  <ion-card class="needed-attention-card td-card">
    <ion-card-header>
      <div class="attention-header td-header">
        <div class="header-left td-header-left">
          <div class="icon-wrapper td-header-icon td-header-icon--warning">
            <ion-icon :icon="alertCircleOutline" color="warning" />
          </div>
          <div>
            <ion-card-title class="td-card-title">{{
              $t("dashboard.neededAttention.title")
            }}</ion-card-title>
            <ion-card-subtitle>
              <span v-if="props.urgentContract.length > 0">
                {{
                  $t(
                    "dashboard.neededAttention.requiringAction",
                    { count: props.urgentContract.length },
                    props.urgentContract.length
                  )
                }}
              </span>
              <span v-else>{{
                $t("dashboard.neededAttention.allHealthy")
              }}</span>
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
          {{ $t("dashboard.neededAttention.buyMore") }}
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
          <p class="ion-no-margin">
            {{ $t("dashboard.neededAttention.noneNeedAttention") }}
          </p>
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
              {{ $t("dashboard.neededAttention.renew") }}
            </ion-item-option>
          </ion-item-options>

          <ion-item
            class="attention-item"
            :class="{
              'attention-item--critical': contract.expiresIn.total('days') <= 1,
            }"
            button
            :detail="false"
            @click="openDetail(contract)"
          >
            <div class="attention-row">
              <ion-icon :icon="alertCircleOutline" class="item-icon" />

              <ion-chip
                class="expiry-chip"
                :class="{
                  'expiry-chip--critical':
                    contract.expiresIn.total('days') <= 1,
                }"
                :disabled="true"
                style="opacity: 1"
              >
                <ion-icon :icon="timeOutline" color="ligth" />
                <ion-label>
                  {{
                    $t("dashboard.neededAttention.left", {
                      duration: formatDuration(contract.expiresIn),
                    })
                  }}
                </ion-label>
              </ion-chip>

              <h4 class="item-name">
                {{ contract.article.title }}
              </h4>

              <ion-badge
                :color="getTierColor(contract.tier)"
                class="tier-badge"
              >
                {{ contract.tier }}
              </ion-badge>
            </div>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option color="danger" @click="onDismiss(/*contract*/)">
              <ion-icon slot="top" :icon="closeOutline" />
              {{ $t("dashboard.neededAttention.dismiss") }}
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>
    </ion-card-content>
  </ion-card>

  <ArticleDetail
    v-if="selectedContract"
    :contract="selectedContract"
    :article="selectedContract.article"
    :isOpen="isModalOpen"
    @close="closeDetail"
    @renew="onRenew"
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
  timeOutline,
} from "ionicons/icons";
import ArticleDetail from "@/components/ArticleDetail.vue";
import { ContractDTO } from "../../../../dto/contractDTO";
import { formatDuration } from "@/types/models";
import { useLeagueStore } from "@/stores/league";
import { useRenewContract } from "@/composables/useRenewContract";

// ── Props ──────────────────────────────────────────────────────────────────
// urgentContract is pre-filtered by the parent. This component does not
// filter — it renders what it receives. Single responsibility.
interface Props {
  urgentContract: ContractDTO[];
  onBuyArticles?: () => void;
}

const props = defineProps<Props>();

const leagueStore = useLeagueStore();
const { renewContract } = useRenewContract();

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

async function onRenew(contract: ContractDTO) {
  const league = leagueStore.currentLeague;
  if (!league) return;
  await renewContract(league.id, contract.id);
  closeDetail();
}

function onDismiss(/*contract: Contract*/) {
  // TODO: call archive/dismiss API via useMutation when the endpoint is ready
}
</script>

<style scoped src="src/components/teamDashboard/team-dashboard.css"></style>

<style scoped>
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
  --background: rgba(var(--ion-color-warning-rgb), 0.04);
  --background-hover: rgba(var(--ion-color-warning-rgb), 0.12);
  --border-radius: 0.5rem;
  --padding-start: 1rem;
  --padding-end: 0.75rem;
  --inner-padding-start: 0;
  --inner-padding-end: 0;
  --min-height: 4rem;
  --inner-border-width: 0;

  margin: 0.25rem 0.5rem;
  border: 1px solid var(--ion-border-color);
  border-radius: 0.5rem;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.attention-item--critical {
  border-color: rgba(var(--ion-color-danger-rgb), 0.4);
  --background: rgba(var(--ion-color-danger-rgb), 0.04);
  --background-hover: rgba(var(--ion-color-danger-rgb), 0.12);
}

.attention-row {
  display: grid;
  grid-template-columns: 24px 120px minmax(0, 1fr) auto;
  grid-template-areas: "icon expiry title tier";
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-width: 0;
}

.item-icon {
  grid-area: icon;
  font-size: 1.2rem;
  justify-self: center;
}

.expiry-chip {
  grid-area: expiry;
  width: 120px;
  justify-content: center;
  margin: 0;
  white-space: nowrap;
  background: var(--ion-color-warning);
  color: var(--ion-color-light);
  height: 1.45rem;
  font-size: 0.72rem;
}

.expiry-chip--critical {
  background: var(--ion-color-danger);
  color: var(--ion-color-light);
}

.expiry-chip ion-icon {
  font-size: 0.78rem;
  margin-right: 3px;
}

.item-name {
  grid-area: title;
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-text-color);
  line-height: 1.25;
}

.tier-badge {
  grid-area: tier;
  justify-self: end;
  white-space: nowrap;
  font-size: 0.65rem;
  min-width: fit-content;
  height: 1.15rem;
  padding: 0 6px;
}

/* Mobile: remove icon column, keep same horizontal layout */
@media (max-width: 576px) {
  .attention-item {
    --padding-start: 0.75rem;
    --padding-end: 0.75rem;
  }

  .attention-row {
    grid-template-columns: 96px minmax(0, 1fr) auto;
    grid-template-areas: "expiry title tier";
    gap: 0.45rem;
  }

  .item-icon {
    display: none;
  }

  .expiry-chip {
    width: 96px;
    font-size: 0.68rem;
    height: 1.35rem;
  }

  .item-name {
    font-size: 0.95rem;
  }

  .tier-badge {
    font-size: 0.6rem;
    height: 1.05rem;
  }
}
.expiry-chip ion-icon {
  font-size: 0.75rem;
  margin-right: 3px;
}

/* ion-text-color already adapts in dark mode — no override needed */
</style>
