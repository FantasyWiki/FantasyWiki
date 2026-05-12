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

    <ion-content v-if="selectedContract" class="ion-padding detail-content">
      <ArticleDescriptionBlock
        v-if="detailModel"
        :model="detailModel"
        :summary-extract="summary?.extract"
        :summary-thumbnail-url="summary?.thumbnailUrl"
        :is-loading-summary="isLoadingSummary"
      />

      <ArticleStatsBlock v-if="detailModel" :model="detailModel" />

      <ContractDetailsBlock
        v-if="selectedContract"
        :selected-contract="selectedContract"
      />

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
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItemDivider,
  IonModal,
  IonText,
  IonToolbar,
} from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import { ContractDTO } from "../../../dto/contractDTO";
import type { Enums } from "../../../dto/enums";
import { useLeagueStore } from "@/stores/league";
import { buildArticleDetail } from "@/types/articleDetail";
import ArticleDescriptionBlock from "@/components/articleDetail/ArticleDescriptionBlock.vue";
import ArticleStatsBlock from "@/components/articleDetail/ArticleStatsBlock.vue";
import ContractDetailsBlock from "@/components/articleDetail/ContractDetailsBlock.vue";
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
  return buildArticleDetail({
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

.close-icon {
  font-size: 1.2rem;
}

.section-divider {
  --background: var(--ion-border-color);
  --padding-start: 0;
  min-height: 1px;
  margin: 0.5rem 0;
}

@media (max-width: 576px) {
  .close-icon {
    font-size: 1rem;
  }
}

@media (min-width: 992px) {
  .article-detail-modal {
    --backdrop-opacity: 0.82;
  }
}
</style>
