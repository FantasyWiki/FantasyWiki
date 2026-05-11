<template>
  <div class="detail-section actions-section">
    <ion-button
      v-if="model.showBuy"
      expand="block"
      color="primary"
      :disabled="model.buyDisabled"
      @click="emit('buy')"
    >
      Buy
    </ion-button>

    <template v-if="model.showContractActions && selectedContract">
      <ion-button
        expand="block"
        color="primary"
        class="action-primary"
        @click="emit('renew', selectedContract)"
      >
        <ion-icon slot="start" :icon="refreshOutline" class="action-icon" />
        Renew Contract
      </ion-button>

      <ion-button
        expand="block"
        fill="outline"
        class="action-secondary"
        @click="emit('swap', selectedContract)"
      >
        <ion-icon
          slot="start"
          :icon="swapHorizontalOutline"
          class="action-icon"
        />
        Swap Article
      </ion-button>
    </template>

    <ion-button
      expand="block"
      fill="clear"
      color="medium"
      @click="emit('close')"
    >
      Close
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { IonButton, IonIcon } from "@ionic/vue";
import { refreshOutline, swapHorizontalOutline } from "ionicons/icons";
import type { ContractDTO } from "../../../../dto/contractDTO";
import type { ArticleDetailModel } from "@/components/articleDetail/articleDetailModel";

interface Props {
  model: ArticleDetailModel;
  selectedContract: ContractDTO | null;
}

defineProps<Props>();

const emit = defineEmits<{
  close: [];
  buy: [];
  renew: [contract: ContractDTO];
  swap: [contract: ContractDTO];
}>();
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
