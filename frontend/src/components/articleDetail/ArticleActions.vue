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
        @click="emit('renew', selectedContract)"
      >
        <ion-icon slot="start" :icon="refreshOutline" />
        Renew Contract
      </ion-button>

      <ion-button
        expand="block"
        fill="outline"
        @click="emit('swap', selectedContract)"
      >
        <ion-icon slot="start" :icon="swapHorizontalOutline" />
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
}

.actions-section ion-button {
  --border-radius: 0.625rem;
  margin: 0;
}
</style>
