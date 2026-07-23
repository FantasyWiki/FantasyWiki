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

    <ion-content class="ion-padding detail-content">
      <ArticleDescriptionBlock
        v-if="detailModel"
        :model="detailModel"
        :summary-extract="summary?.extract"
        :summary-thumbnail-url="summary?.thumbnailUrl"
        :is-loading-summary="isLoadingSummary"
      />

      <ArticleStatsBlock
        v-if="detailModel"
        :model="detailModel"
        :week-views="views?.weekViews"
        :previous-week-views="views?.previousWeekViews"
        :is-loading-views="isLoadingViews"
      />

      <BuyTierPicker
        v-if="freeAgent"
        :options="freeAgent.tierOptions"
        :selected-tier="selectedTier"
        :viewer-credits="freeAgent.viewerCredits"
        :is-loading-views="isLoadingViews"
        @update:selected-tier="selectedTier = $event"
      />
      <ContractDetailsBlock
        v-else-if="ownedByViewer"
        :tier="ownedByViewer.tier"
        :expires-in="ownedByViewer.expiresIn"
        :renewal-elected="ownedByViewer.renewalElected"
        :renewal-incremental-cost="ownedByViewer.renewalIncrementalCost"
      />
      <LockedByOtherBlock
        v-else-if="ownedByOther"
        :tier="ownedByOther.tier"
        :unlock-in="ownedByOther.unlockIn"
        :owner-team-name="ownedByOther.ownerTeamName"
      />

      <ion-item-divider class="section-divider" />

      <ArticleActions
        v-if="ownershipContextStatus === 'ready'"
        :model="detailModel"
        :contract="contract"
        :selected-tier="selectedTier"
        :is-loading-views="isLoadingViews"
        :is-submitting="isSubmitting"
        :can-swap="!!onSwap"
        :can-request-trade="!!onRequestTrade"
        @buy="handleBuy"
        @sell="handleSell"
        @renew="handleRenew"
        @cancel-renewal="handleCancelRenewal"
        @swap="(c) => onSwap?.(c)"
        @request-trade="(contractId) => onRequestTrade?.(contractId)"
        @close="emit('close')"
      />
      <div v-else class="detail-section ownership-state">
        <ion-text color="medium">
          <p class="ownership-state__title ion-no-margin">
            {{
              ownershipContextStatus === "loading"
                ? $t("articleDetail.ownership.resolving")
                : $t("articleDetail.ownership.unableToDetermine")
            }}
          </p>
          <p class="ownership-state__subtitle ion-no-margin">
            {{
              ownershipContextStatus === "loading"
                ? $t("articleDetail.ownership.resolvingSubtitle")
                : $t("articleDetail.ownership.refreshTryAgain")
            }}
          </p>
        </ion-text>
        <ion-button
          v-if="ownershipContextStatus === 'error'"
          fill="outline"
          size="small"
          @click="retryOwnership()"
        >
          {{ $t("articleDetail.ownership.retryCheck") }}
        </ion-button>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from "vue";
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
import { ArticleDTO } from "../../../dto/articleDTO";
import { ContractDTO } from "../../../dto/contractDTO";
import { useArticleOwnership } from "@/composables/useArticleOwnership";
import { useBackButtonDismiss } from "@/composables/useBackButtonDismiss";
import ArticleDescriptionBlock from "@/components/articleDetail/ArticleDescriptionBlock.vue";
import ArticleStatsBlock from "@/components/articleDetail/ArticleStatsBlock.vue";
import ContractDetailsBlock from "@/components/articleDetail/ContractDetailsBlock.vue";
import BuyTierPicker from "@/components/articleDetail/BuyTierPicker.vue";
import LockedByOtherBlock from "@/components/articleDetail/LockedByOtherBlock.vue";
import ArticleActions from "@/components/articleDetail/ArticleActions.vue";
import { useArticleSummary } from "@/composables/useArticleSummary";
import { useArticleViews } from "@/composables/useArticleViews";
import { useContractActions } from "@/composables/useContractActions";
import { useLeagueStore } from "@/stores/league";
import type { ContractTier } from "@/types/articleDetail";

interface Props {
  article: ArticleDTO;
  contract: ContractDTO | null;
  isOpen: boolean;
  /**
   * Host-specific actions, declared as callback props rather than emits.
   *
   * Buy/sell/renew are the same everywhere, so this modal owns them (see
   * useContractActions). Swap is different in kind: it puts the *team page*
   * into swap mode, so no other host can implement it, and requesting a trade
   * needs a page that can show another team's contract. An emit no host listens
   * to is silently dropped by Vue, which is how the sell and renew buttons ended
   * up rendering on pages where they did nothing. As callback props these render
   * only where a handler was supplied (`v-if` on the prop below), so a dead
   * button is impossible to ship. Vue routes `@swap="fn"` into the `onSwap` prop
   * as well, so hosts may bind either way.
   */
  onSwap?: (contract: ContractDTO) => void;
  onRequestTrade?: (contractId: string) => void;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

// Owned here rather than by each host: all four drive `is-open` from local
// state, so the back button behaves the same everywhere for free.
useBackButtonDismiss(toRef(props, "isOpen"), () => emit("close"));

const selectedTier = ref<ContractTier>("MEDIUM");

const leagueStore = useLeagueStore();
const { buyContract, sellContract, renewContract, cancelRenewal } =
  useContractActions();

// Guards against a double submit while a mutation is in flight — every action
// button is disabled off this, so a second tap can't fire a second sell.
const isSubmitting = ref(false);

/** Runs a contract mutation against the active league and closes on success. */
async function runAction(action: (leagueId: string) => Promise<boolean>) {
  const leagueId = leagueStore.currentLeague?.id;
  if (!leagueId || isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    if (await action(leagueId)) emit("close");
  } finally {
    isSubmitting.value = false;
  }
}

const handleBuy = (tier: ContractTier) =>
  runAction((leagueId) => buyContract(leagueId, props.article.id, tier));

const handleSell = (contractId: string) =>
  runAction((leagueId) => sellContract(leagueId, contractId));

const handleRenew = (contract: ContractDTO) =>
  runAction((leagueId) => renewContract(leagueId, contract.id));

const handleCancelRenewal = (contract: ContractDTO) =>
  runAction((leagueId) => cancelRenewal(leagueId, contract.id));

const summarySource = computed(() => ({
  title: props.article.title,
  domain: props.article.domain,
}));

const { summary, isLoading: isLoadingSummary } =
  useArticleSummary(summarySource);
const { views, isLoading: isLoadingViews } = useArticleViews(summarySource);

// Neither ArticleDTO nor ContractDTO carry pageview data (see useArticleViews),
// so the same live 30-day average feeding the stats block also feeds pricing.
const averageViews30d = computed(() => views.value?.averageViews30d ?? 0);

const {
  status: ownershipContextStatus,
  detail: detailModel,
  retry: retryOwnership,
} = useArticleOwnership(
  toRef(props, "article"),
  toRef(props, "contract"),
  averageViews30d
);

const freeAgent = computed(() =>
  detailModel.value?.availability === "free-agent" ? detailModel.value : null
);
const ownedByViewer = computed(() =>
  detailModel.value?.availability === "owned-by-viewer"
    ? detailModel.value
    : null
);
const ownedByOther = computed(() =>
  detailModel.value?.availability === "owned-by-other"
    ? detailModel.value
    : null
);
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
