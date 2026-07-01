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
            <p class="error-title">{{ t("views.teamPage.failedToLoad") }}</p>
            <p class="error-detail">{{ error?.message }}</p>
            <ion-button
              fill="outline"
              color="light"
              size="small"
              @click="refetch()"
            >
              <ion-icon slot="start" :icon="refreshOutline" />
              {{ t("views.teamPage.retry") }}
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
          <ion-button
            fill="clear"
            size="small"
            class="back-btn"
            @click="router.back()"
          >
            <ion-icon slot="icon-only" :icon="arrowBackOutline" />
          </ion-button>
          <h2 class="page-title">{{ t("views.teamPage.title") }}</h2>
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
            {{ t("views.teamPage.save") }}
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

    <!-- ── Article detail modal ──────────────────────────────────────── -->
    <ArticleDetail
      v-if="selectedContract"
      :contract="selectedContract"
      :article="selectedContract.article"
      :is-open="isDetailOpen"
      @close="closeDetail"
      @swap="enterSwapMode"
    />
  </nav-bar>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from "vue";
import { useRouter } from "vue-router";
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
} from "@ionic/vue";
import {
  alertCircleOutline,
  arrowBackOutline,
  refreshOutline,
} from "ionicons/icons";

import NavBar from "@/layout/NavBar.vue";
import FormationSelector from "@/components/formation/FormationSelector.vue";
import TeamFormation from "@/components/formation/TeamFormation.vue";
import BenchSection from "@/components/formation/BenchSection.vue";
import ArticleDetail from "@/components/ArticleDetail.vue";

import { useTeamLineup } from "@/composables/useTeamLineup";
import { useLeagueStore } from "@/stores/league";
import { useToast } from "@/composables/useToast";
import { FORMATIONS } from "@/types/pitch";
import type { Schema, Position } from "@/../../dto/formationDTO";
import type { ContractDTO } from "@/../../dto/contractDTO";
import { useI18n } from "vue-i18n";

const router = useRouter();

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
const { t } = useI18n();
const { showPersistent } = useToast();

// ── Persistent save-state indicator ──────────────────────────────────────
// watchEffect re-runs whenever isDirty/isSaving change and calls onCleanup
// before each re-run and on unmount — this avoids the async-watcher race
// where a new invocation fires before the previous showPersistent resolves.
watchEffect((onCleanup) => {
  const dirty = isDirty.value;
  const saving = isSaving.value;

  if (!dirty && !saving) return;

  const message = saving
    ? t("views.teamPage.saving")
    : t("views.teamPage.unsavedChanges");
  const color: "primary" | "medium" = saving ? "primary" : "medium";

  let dismiss: (() => Promise<void>) | null = null;
  let stale = false;

  showPersistent(message, color).then((fn) => {
    if (stale) {
      void fn();
      return;
    }
    dismiss = fn;
  });

  onCleanup(() => {
    stale = true;
    void dismiss?.();
  });
});

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
.back-btn {
  --padding-start: 0;
  --padding-end: 4px;
  margin-inline-end: 4px;
}

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
</style>
