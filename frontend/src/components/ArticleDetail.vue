<template>
  <ion-modal
    :is-open="isOpen"
    @did-dismiss="emit('close')"
    :initial-breakpoint="0.92"
    :breakpoints="[0, 0.92, 1]"
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
            <ion-icon :icon="closeOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content v-if="selectedContract && detailModel" class="ion-padding">
      <ArticleInfoBlock
        :model="detailModel"
        :summary-extract="summary?.extract"
        :summary-thumbnail-url="summary?.thumbnailUrl"
        :is-loading-summary="isLoadingSummary"
      />

      <ion-item-divider class="section-divider" />

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
        :model="detailModel"
        :selected-contract="selectedContract"
        @buy="emit('buy')"
        @renew="(contract) => emit('renew', contract)"
        @swap="(contract) => emit('swap', contract)"
        @close="emit('close')"
      />
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  IonBadge,
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
import { closeOutline, timeOutline } from "ionicons/icons";
import { ContractDTO } from "../../../dto/contractDTO";
import type { Enums } from "../../../dto/enums";
import { useAppStore } from "@/stores/app";
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

const appStore = useAppStore();
const leagueStore = useLeagueStore();

const viewerTeam = computed(() => {
  const viewerId = appStore.currentUser?.sub;
  if (!viewerId) return null;
  return (
    leagueStore.currentLeague?.teams.find(
      (team) => team.player.id === viewerId
    ) ?? null
  );
});

const detailModel = computed(() => {
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
    viewerTeamId: viewerTeam.value?.id,
    viewerCredits: viewerTeam.value?.credits,
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
</style>
