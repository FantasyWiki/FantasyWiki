<template>
  <nav-bar>
    <!-- ── Pull-to-refresh ──────────────────────────────────────────────── -->
    <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
      <ion-refresher-content />
    </ion-refresher>

    <!-- ── Loading skeleton ────────────────────────────────────────────── -->
    <div v-if="isLoading" class="pitch-skeleton" aria-busy="true">
      <ion-skeleton-text :animated="true" class="skeleton-formation" />
      <ion-skeleton-text :animated="true" class="skeleton-pitch" />
      <ion-skeleton-text :animated="true" class="skeleton-bench" />
    </div>

    <!-- ── Error state ─────────────────────────────────────────────────── -->
    <ion-card v-else-if="isError" color="danger" class="error-card">
      <ion-card-content>
        <div class="error-row">
          <ion-icon :icon="alertCircleOutline" />
          <div>
            <p class="error-title">Failed to load team</p>
            <p class="error-detail">{{ error?.message }}</p>
            <ion-button
              fill="outline"
              color="light"
              size="small"
              @click="refetch()"
            >
              <ion-icon slot="start" :icon="refreshOutline" />
              Retry
            </ion-button>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- ── Main content ────────────────────────────────────────────────── -->
    <template v-else>
      <!-- Page heading -->
      <div class="page-heading">
        <div class="heading-left">
          <h2 class="page-title">Team Management</h2>
          <ion-badge v-if="currentLeague" color="primary" class="league-badge">
            {{ currentLeague.icon }} {{ currentLeague.title }}
          </ion-badge>
        </div>
        <transition name="fade-up">
          <ion-button
            v-if="isDirty && !isSaving"
            fill="outline"
            size="small"
            @click="saveTeam()"
          >
            Save
          </ion-button>
        </transition>
      </div>

      <!-- Formation selector -->
      <FormationSelector
        :formations="formationIds"
        :current-schema="schema"
        @change="onSchemaChange"
      />

      <!-- Pitch -->
      <TeamFormation
        :formation="draftFormation"
        :swap-mode="swapMode"
        :swap-source="swapSource"
        @article-click="handleArticleClick"
        @swap="handleSwap"
        @move-to-empty="handleMoveToEmpty"
        @cancel-swap="cancelSwap"
      />

      <!-- Bench -->
      <BenchSection
        :articles="benchContracts"
        :swap-mode="swapMode"
        :swap-source="swapSource"
        @article-click="handleArticleClick"
        @swap="handleSwap"
      />
    </template>

    <!-- ── Floating save indicator ────────────────────────────────────── -->
    <transition name="fade-up">
      <div
        v-if="isDirty || isSaving"
        class="save-indicator"
        :class="{ 'save-indicator--saving': isSaving }"
      >
        <ion-spinner v-if="isSaving" name="crescent" class="save-spinner" />
        <span>{{ isSaving ? "Saving…" : "Unsaved changes" }}</span>
      </div>
    </transition>

    <!-- ── Article detail modal ──────────────────────────────────────── -->
    <ArticleDetail
      v-if="selectedContract"
      :selected-contract="selectedContract"
      :is-open="isDetailOpen"
      @close="closeDetail"
      @swap="enterSwapMode"
    />
  </nav-bar>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onIonViewWillLeave } from "@ionic/vue";
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonSpinner,
} from "@ionic/vue";
import { alertCircleOutline, refreshOutline } from "ionicons/icons";

import NavBar from "@/layout/NavBar.vue";
import FormationSelector from "@/components/formation/FormationSelector.vue";
import TeamFormation from "@/components/formation/TeamFormation.vue";
import BenchSection from "@/components/formation/BenchSection.vue";
import ArticleDetail from "@/components/ArticleDetail.vue";

import { useTeamLineup } from "@/stores/useTeamLineup";
import { useLeagueStore } from "@/stores/league";
import { FORMATIONS } from "@/types/pitch";
import type { Schema, Position } from "@/../../dto/formationDTO";
import type { ContractDTO } from "@/../../dto/contractDTO";

// ── Composable ────────────────────────────────────────────────────────────
const {
  isLoading,
  isError,
  error,
  refetch,
  benchContracts,
  schema,
  draftFormation,
  isDirty,
  isSaving,
  saveTeam,
  setSchema,
  swapSlots,
  moveToEmpty,
} = useTeamLineup();

const leagueStore = useLeagueStore();
const currentLeague = computed(() => leagueStore.currentLeague);
const formationIds = Object.keys(FORMATIONS) as Schema[];

// Save on Ionic back-button / tab switch
onIonViewWillLeave(() => {
  if (isDirty.value) saveTeam();
});

async function handleRefresh(event: CustomEvent) {
  await refetch();
  (event.target as HTMLIonRefresherElement).complete();
}

// ── Schema change ─────────────────────────────────────────────────────────
function onSchemaChange(newSchema: Schema) {
  setSchema(newSchema);
}

// ── Article detail dialog ─────────────────────────────────────────────────
const selectedContract = ref<ContractDTO | null>(null);
const isDetailOpen = ref(false);

function handleArticleClick(article: ContractDTO) {
  if (swapMode.value && swapSource.value) {
    handleSwap(swapSource.value.id, article.id);
    cancelSwap();
  } else if (swapMode.value) {
    enterSwapMode(article);
  } else {
    selectedContract.value = article;
    isDetailOpen.value = true;
  }
}

function closeDetail() {
  isDetailOpen.value = false;
}

// ── Swap logic ────────────────────────────────────────────────────────────
const swapMode = ref(false);
const swapSource = ref<ContractDTO | null>(null);

function enterSwapMode(article: ContractDTO) {
  swapMode.value = true;
  swapSource.value = article;
  isDetailOpen.value = false;
}

function cancelSwap() {
  swapMode.value = false;
  swapSource.value = null;
}

function handleSwap(fromId: string, toId: string) {
  const toPos =
    (
      Object.entries(draftFormation.value.formation) as [
        Position,
        ContractDTO,
      ][]
    ).find(([, c]) => c.id === toId)?.[0] ?? "bench";

  swapSlots(fromId, toPos, toId);
  cancelSwap();
}

function handleMoveToEmpty(posKey: string) {
  if (!swapSource.value) return;
  moveToEmpty(swapSource.value.id, posKey as Position);
  cancelSwap();
}
</script>

<style scoped>
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.heading-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  font-family: var(--font-family-headings);
}

.league-badge {
  font-size: 11px;
}

.pitch-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-formation {
  height: 44px;
  border-radius: 8px;
}

.skeleton-pitch {
  height: 480px;
  border-radius: 12px;
}

.skeleton-bench {
  height: 120px;
  border-radius: 12px;
}

.error-card {
  margin-top: 16px;
}

.error-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.error-row ion-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.error-title {
  font-weight: 600;
  margin: 0 0 4px;
}

.error-detail {
  font-size: 13px;
  color: var(--ion-color-light);
  margin: 0 0 8px;
  opacity: 0.85;
}

.save-indicator {
  position: fixed;
  bottom: calc(64px + var(--ion-safe-area-bottom, 0px) + 8px);
  right: 16px;
  background: var(--ion-color-dark);
  color: var(--ion-color-dark-contrast);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.88;
  pointer-events: none;
  z-index: 200;
}

.save-indicator--saving {
  background: var(--ion-color-primary);
  opacity: 1;
}

.save-spinner {
  width: 14px;
  height: 14px;
}
</style>
