<template>
  <div class="detail-section actions-section">
    <ion-button
      v-if="model?.availability === 'free-agent'"
      expand="block"
      color="primary"
      :disabled="buyDisabled"
      @click="emit('buy', selectedTier)"
    >
      {{ $t("articleDetail.actions.buy") }}
    </ion-button>

    <template v-if="model?.availability === 'owned-by-viewer' && contract">
      <ion-button
        expand="block"
        color="primary"
        class="action-primary"
        @click="emit('renew', contract)"
      >
        <ion-icon slot="start" :icon="refreshOutline" class="action-icon" />
        {{ $t("articleDetail.actions.renewContract") }}
      </ion-button>

      <ion-button
        expand="block"
        fill="outline"
        class="action-secondary"
        @click="emit('swap', contract)"
      >
        <ion-icon
          slot="start"
          :icon="swapHorizontalOutline"
          class="action-icon"
        />
        {{ $t("articleDetail.actions.swapArticle") }}
      </ion-button>

      <ion-button
        expand="block"
        fill="outline"
        color="danger"
        class="action-secondary"
        @click="emit('sell', model.contractId)"
      >
        <ion-icon slot="start" :icon="cashOutline" class="action-icon" />
        {{ $t("articleDetail.actions.sell") }}
      </ion-button>
    </template>

    <ion-button
      v-if="model?.availability === 'owned-by-other'"
      expand="block"
      color="primary"
      class="action-primary"
      @click="emit('requestTrade', model.contractId)"
    >
      <ion-icon
        slot="start"
        :icon="swapHorizontalOutline"
        class="action-icon"
      />
      {{ $t("articleDetail.actions.requestTrade") }}
    </ion-button>

    <ion-button
      expand="block"
      fill="clear"
      color="medium"
      @click="emit('close')"
    >
      {{ $t("common.close") }}
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonButton, IonIcon } from "@ionic/vue";
import {
  cashOutline,
  refreshOutline,
  swapHorizontalOutline,
} from "ionicons/icons";
import type { ContractDTO } from "../../../../dto/contractDTO";
import type { ArticleDetail, ContractTier } from "@/types/articleDetail";

interface Props {
  model: ArticleDetail | null;
  contract: ContractDTO | null;
  selectedTier: ContractTier;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  buy: [tier: ContractTier];
  sell: [contractId: string];
  requestTrade: [contractId: string];
  renew: [contract: ContractDTO];
  swap: [contract: ContractDTO];
}>();

const buyDisabled = computed(() => {
  if (props.model?.availability !== "free-agent") return true;
  const option = props.model.tierOptions.find(
    (o) => o.tier === props.selectedTier
  );
  return !option || option.price > props.model.viewerCredits;
});
</script>

<style scoped>
.actions-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 1.2rem;
  padding-top: 0.15rem;
}

.actions-section ion-button {
  --border-radius: 0.75rem;
  min-height: 44px;
  margin: 0;
}

.action-primary {
  --box-shadow: 0 8px 20px rgba(var(--ion-color-primary-rgb), 0.22);
}

.action-secondary {
  --border-width: 1px;
}

.action-icon {
  font-size: 0.95rem;
}

@media (max-width: 576px) {
  .actions-section {
    gap: 0.4rem;
    padding-bottom: calc(var(--ion-safe-area-bottom, 0px) + 0.45rem);
  }

  .actions-section ion-button {
    min-height: 40px;
    font-size: 0.9rem;
    --padding-top: 0.45rem;
    --padding-bottom: 0.45rem;
  }

  .action-icon {
    font-size: 0.78rem;
  }
}
</style>
