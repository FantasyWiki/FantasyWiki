<template>
  <ion-modal
    :is-open="isOpen"
    @did-dismiss="emit('close')"
    :initial-breakpoint="1"
    :breakpoints="[0, 1]"
    handle-behavior="cycle"
    class="article-detail-modal"
  >
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title class="modal-title">
          {{ selectedContract?.article.title ?? "Article Detail" }}
        </ion-title>
        <ion-badge
          slot="end"
          :color="getTierColor(selectedContract?.tier)"
          class="tier-badge"
        >
          {{ selectedContract?.tier }}
        </ion-badge>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="emit('close')">
            <ion-icon
              :icon="closeOutline"
              slot="icon-only"
              class="close-icon"
            />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content
      v-if="selectedContract && detailModel"
      class="ion-padding detail-content"
    >
      <ArticleInfoBlock
        :model="detailModel"
        :summary-extract="summary?.extract"
        :summary-thumbnail-url="summary?.thumbnailUrl"
        :is-loading-summary="isLoadingSummary"
      />

      <ion-item-divider class="section-divider" />

      <div class="detail-section contract-section">
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
      </div>

      <ion-item-divider class="section-divider" />

      <ArticleActions
        v-if="ownershipContextStatus === 'ready'"
        :model="detailModel"
        :selected-contract="selectedContract"
        @buy="emit('buy')"
        @renew="(contract) => emit('renew', contract)"
        @swap="(contract) => emit('swap', contract)"
        @close="emit('close')"
      />
      <div v-else class="detail-section ownership-state">
        <ion-text color="medium">
          <p class="ownership-state__title ion-no-margin">
            {{
              ownershipContextStatus === "loading"
                ? "Resolving ownership..."
                : "Unable to determine ownership"
            }}
          </p>
          <p class="ownership-state__subtitle ion-no-margin">
            {{
              ownershipContextStatus === "loading"
                ? "Actions will appear when your team context is ready."
                : "Please refresh and try again."
            }}
          </p>
        </ion-text>
        <ion-button
          v-if="ownershipContextStatus === 'error'"
          fill="outline"
          size="small"
          @click="leagueStore.fetchCurrentTeamContext()"
        >
          Retry ownership check
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
  IonModal,
  IonRow,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import { closeOutline, timeOutline } from "ionicons/icons";
import { ContractDTO } from "../../../dto/contractDTO";
import type { Enums } from "../../../dto/enums";
import { useLeagueStore } from "@/stores/league";
import { formatDuration } from "@/types/models";
import { buildArticleDetailModel } from "@/components/articleDetail/articleDetailModel";
import ArticleInfoBlock from "@/components/articleDetail/ArticleInfoBlock.vue";
import ArticleActions from "@/components/articleDetail/ArticleActions.vue";
import { useArticleSummary } from "@/composables/useArticleSummary";

interface Props {
  selectedContract: ContractDTO | null;
  isOpen: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  buy: [];
  renew: [contract: ContractDTO];
  swap: [contract: ContractDTO];
}>();

const leagueStore = useLeagueStore();

const ownershipContextStatus = computed<"loading" | "ready" | "error">(() => {
  if (leagueStore.isTeamLoading) return "loading";
  if (leagueStore.teamError) return "error";
  if (!leagueStore.currentTeamId) return "loading";
  return "ready";
});

const detailModel = computed(() => {
  if (ownershipContextStatus.value !== "ready") return null;
  const contract = props.selectedContract;
  if (!contract) return null;
  return buildArticleDetailModel({
    article: contract.article,
    currentPrice: contract.currentPrice,
    purchasePrice: contract.purchasePrice,
    expiresIn: contract.expiresIn,
    tier: contract.tier,
    ownerTeamId: contract.team.id,
    ownerTeamName: contract.team.name,
    viewerTeamId: leagueStore.currentTeamId ?? undefined,
    viewerCredits: leagueStore.currentTeam?.credits,
  });
});

const summarySource = computed(() => {
  const contract = props.selectedContract;
  if (!contract) return null;
  return {
    title: contract.article.title,
    domain: contract.article.domain as Enums,
  };
});

const { summary, isLoading: isLoadingSummary } =
  useArticleSummary(summarySource);

const expiryDays = computed(() => {
  const contract = props.selectedContract;
  if (!contract) return 0;
  return Math.max(0, Math.floor(contract.expiresIn.total("days")));
});

const expiryLabel = computed(() => {
  if (expiryDays.value <= 1) return "Urgent";
  if (expiryDays.value <= 3) return "Renew soon";
  return "Healthy";
});

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
.article-detail-modal {
  --border-radius: 1rem 1rem 0 0;
}

.detail-content {
  --padding-bottom: calc(var(--ion-safe-area-bottom, 0px) + 1rem);
}

.ownership-state {
  border: 1px dashed var(--ion-border-color);
  border-radius: 0.75rem;
  padding: 0.75rem;
  display: grid;
  gap: 0.45rem;
}

.ownership-state__title {
  font-size: 0.9rem;
  font-weight: 600;
}

.ownership-state__subtitle {
  font-size: 0.8rem;
}

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

.close-icon {
  font-size: 1.2rem;
}

.section-divider {
  --background: var(--ion-border-color);
  --padding-start: 0;
  min-height: 1px;
  margin: 0.5rem 0;
}

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
  font-size: 0.95rem;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
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

.contract-section {
  background: rgba(var(--ion-color-primary-rgb), 0.03);
  border: 1px solid var(--ion-border-color);
  border-radius: 0.875rem;
  padding: 0.875rem;
}

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
}

.info-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-top: 0.2rem;
}

@media (max-width: 576px) {
  .modal-title {
    font-size: 1rem;
    padding-inline-start: 0.5rem;
  }

  .tier-badge {
    font-size: 0.58rem;
    padding: 2px 6px;
  }

  .close-icon {
    font-size: 1rem;
  }

  .contract-section {
    padding: 0.65rem;
  }

  .section-title {
    font-size: 0.86rem;
    gap: 0.38rem;
    margin-bottom: 0.55rem;
  }

  .section-title ion-icon {
    font-size: 0.8rem;
  }

  .urgency-chip {
    font-size: 0.68rem;
    height: 1.45rem;
  }
}
</style>
