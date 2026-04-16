<template>
  <ion-card class="dashboard-card">
    <ion-card-header>
      <div class="dashboard-header">
        <div class="header-left">
          <div class="icon-wrapper">
            <ion-icon :icon="layersOutline" color="primary" />
          </div>
          <div>
            <ion-card-title>Team Formation</ion-card-title>
            <ion-card-subtitle>
              <span>{{ props.formation.schema }}</span>
            </ion-card-subtitle>
          </div>
        </div>

        <ion-button
          fill="outline"
          size="small"
          color="primary"
          router-link="/team"
        >
          Manage
          <ion-icon slot="end" :icon="arrowForwardOutline" />
        </ion-button>
      </div>
    </ion-card-header>

    <ion-card-content class="ion-padding">
      <team-formation :formation="props.formation" :swap-mode="false" />
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
  IonIcon,
} from "@ionic/vue";
import {
  arrowForwardOutline,
  layersOutline,
} from "ionicons/icons";
import ArticleDetail from "@/components/ArticleDetail.vue";
import { ContractDTO } from "../../../../dto/contractDTO";
import { formatDuration } from "@/types/models";
import {DraftFormationDTO, FormationDTO} from "../../../../dto/formationDTO";
import TeamFormation from "@/components/formation/TeamFormation.vue";

// ── Props ──────────────────────────────────────────────────────────────────
// urgentContract is pre-filtered by the parent. This component does not
// filter — it renders what it receives. Single responsibility.
interface Props {
  formation: DraftFormationDTO;
}

const props = defineProps<Props>();

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
</script>

<style scoped>
.dashboard-card {
  --background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  border-radius: 0.875rem;
  box-shadow: 0 2px 8px var(--ion-box-shadow-color);
  margin: 0 0 1rem 0;
}

.dashboard-header {
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
  background: rgba(var(--ion-color-secondary-rgb), 0.15);
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
.expiry-chip ion-icon,
.trade-chip ion-icon {
  font-size: 0.75rem;
  margin-right: 3px;
}

.item-trend ion-icon {
  font-size: 0.8rem;
}

.item-chevron {
  font-size: 1rem;
  flex-shrink: 0;
}

/* ion-text-color already adapts in dark mode — no override needed */
</style>
