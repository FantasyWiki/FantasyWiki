<template>
  <ion-card class="owned-articles-card">
    <ion-card-header>
      <div class="header-content">
        <div class="header-info">
          <div class="icon-wrapper">
            <ion-icon :icon="alertCircleOutline" color="warning" />
          </div>
          <div>
            <ion-card-title>Attention Needed</ion-card-title>
            <ion-card-subtitle>
              {{ urgentArticles.length }} contract{{
                urgentArticles.length !== 1 ? "s" : ""
              }}
              requiring action
            </ion-card-subtitle>
          </div>
        </div>
        <ion-button
          v-if="onBuyArticles"
          @click="handleBuyClick"
          fill="outline"
          size="small"
          color="primary"
        >
          <ion-icon slot="start" :icon="addOutline" />
          Buy More
        </ion-button>
      </div>
    </ion-card-header>

    <ion-card-content>
      <!-- Empty State -->
      <div v-if="urgentArticles.length === 0" class="empty-state">
        <ion-icon :icon="documentTextOutline" />
        <ion-text color="medium">
          <p>No contracts need attention right now</p>
        </ion-text>
      </div>

      <!-- Articles List -->
      <ion-list v-else lines="none" class="articles-list">
        <ion-item
          v-for="contract in urgentArticles"
          :key="contract.id"
          @click="openModal(contract)"
          button
          @detail="false"
          class="article-item"
        >
          <div class="article-content">
            <div class="article-info">
              <div class="article-header">
                <span class="article-name">{{ contract.article }}</span>
                <ion-badge
                  :color="getTierColor(contract.tier)"
                  class="tier-badge"
                >
                  {{ contract.tier }}
                </ion-badge>
              </div>
              <div class="article-badges">
                <ion-badge
                  v-if="contract.expiresIn <= 3"
                  color="danger"
                  class="status-badge"
                >
                  <ion-icon :icon="timeOutline" />
                  {{ contract.expiresIn }}d left
                </ion-badge>
                <ion-badge
                  v-if="hasTradeProposal(contract)"
                  color="primary"
                  class="status-badge"
                >
                  <ion-icon :icon="swapHorizontalOutline" />
                  Trade Offer
                </ion-badge>
              </div>
            </div>
            <div class="article-stats">
              <span class="points">{{ contract.yesterdayPoints }} pts</span>
              <div
                class="change"
                :class="
                  contract.yesterdayPoints <= 100 ? 'positive' : 'negative'
                "
              >
                <ion-icon
                  :icon="
                    contract.yesterdayPoints <= 0
                      ? trendingUpOutline
                      : trendingDownOutline
                  "
                />
                <span
                  >{{ contract.yesterdayPoints <= 100 ? "+" : ""
                  }}{{ 5 }}%</span
                >
              </div>
            </div>
          </div>
        </ion-item>
      </ion-list>
    </ion-card-content>
  </ion-card>
  <ArticleDetail
    v-if="selectedContract"
    :selectedContract="selectedContract"
    :isOpen="isModalOpen"
    @close="closeModal"
  />
</template>

<script setup lang="ts">
import { useLeagueStore } from "@/stores/league";
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonList,
  IonText,
} from "@ionic/vue";
import {
  addOutline,
  alertCircleOutline,
  documentTextOutline,
  swapHorizontalOutline,
  timeOutline,
  trendingDownOutline,
  trendingUpOutline,
} from "ionicons/icons";
import ArticleDetail from "@/modules/ArticleDetail.vue";
import { computed, ref } from "vue";
import { Contract } from "@/types/models";

interface Props {
  urgentContract: Contract[];
  onBuyArticles?: () => void;
}

const isModalOpen = ref(false);

const props = defineProps<Props>();
const leagueStore = useLeagueStore();

const selectedContract = ref<Contract | null>(null);

function openModal(contract: Contract) {
  selectedContract.value = contract;
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
}

// const hasTradeProposal = (contract: Contract) => {
//   // Mock - replace with real logic
//   return false;
// };

const urgentArticles = computed(() => {
  if (leagueStore.currentLeague == null) {
    return [];
  }
  const league = leagueStore.currentLeague;
  return props.urgentContract.filter(
    (contract) => contract.leagueId === league.id && contract.expiresIn <= 3
  );
});

const getTierColor = (tier: string) => {
  switch (tier) {
    case "SHORT":
      return "warning";
    case "MEDIUM":
      return "primary";
    case "LONG":
      return "secondary";
    default:
      return "medium";
  }
};

const handleBuyClick = () => {
  if (props.onBuyArticles) {
    props.onBuyArticles();
  }
};
</script>

<style scoped>
.owned-articles-card {
  --background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--ion-color-warning-tint);
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-wrapper ion-icon {
  font-size: 20px;
}

ion-card-title {
  font-size: 1.25rem;
  margin-bottom: 4px;
}

ion-card-subtitle {
  font-size: 0.875rem;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-state ion-icon {
  font-size: 48px;
  color: var(--ion-color-medium);
  margin-bottom: 12px;
}

.articles-list {
  padding: 0;
}

.article-item {
  --background: var(--ion-background-color);
  --border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--ion-border-color);
}

.article-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.article-info {
  flex: 1;
}

.article-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.article-name {
  font-weight: 600;
  color: var(--ion-color-dark);
}

.tier-badge {
  font-size: 0.7rem;
  padding: 2px 6px;
}

.article-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.status-badge {
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
}

.status-badge ion-icon {
  font-size: 12px;
}

.article-stats {
  text-align: right;
}

.points {
  font-weight: 600;
  font-size: 1rem;
  color: var(--ion-color-dark);
  display: block;
  margin-bottom: 4px;
}

.change {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 0.875rem;
}

.change ion-icon {
  font-size: 14px;
}

.change.positive {
  color: var(--ion-color-success);
}

.change.negative {
  color: var(--ion-color-danger);
}

/* Modal Styles */

.section-title ion-icon {
  color: var(--ion-color-medium);
}

.info-label ion-icon {
  font-size: 12px;
}
</style>
