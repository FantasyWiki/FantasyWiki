<template>
  <ion-card class="bench-card">
    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <ion-card-header class="bench-header">
      <div class="bench-header-row">
        <ion-card-title class="bench-title">Bench</ion-card-title>
        <ion-note class="bench-count">
          {{ articles.length }}
          {{ articles.length === 1 ? "article" : "articles" }}
        </ion-note>
      </div>
    </ion-card-header>

    <!-- ── Content ─────────────────────────────────────────────────────── -->
    <ion-card-content class="bench-content">
      <!-- Empty state -->
      <div v-if="articles.length === 0" class="bench-empty">
        <ion-icon :icon="bookOutline" class="bench-empty-icon" />
        <p class="bench-empty-title">No articles on the bench</p>
        <p class="bench-empty-hint">
          Purchase articles from the market to add them here
        </p>
      </div>

      <!-- Horizontally scrollable list -->
      <div v-else class="bench-scroll">
        <ArticleNode
          v-for="article in articles"
          :key="article.id"
          :article="article"
          :swap-mode="swapMode && article.id !== swapSource?.id"
          :selected="article.id === swapSource?.id"
          class="bench-node"
          @click="$emit('articleClick', article)"
          @swap="(fromId, toId) => $emit('swap', fromId, toId)"
        />
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonNote,
  IonIcon,
} from "@ionic/vue";
import { bookOutline } from "ionicons/icons";
import type { Contract } from "@/types/team";
import ArticleNode from "./ArticleNode.vue";

defineProps<{
  /** Bench article list from teamStore.benchContracts */
  articles: Contract[];
  /** When true, ArticleNodes pulse as valid swap targets */
  swapMode?: boolean;
  /** The article currently selected as swap source */
  swapSource?: Contract | null;
}>();

defineEmits<{
  /** User clicked an article tile */
  articleClick: [article: Contract];
  /** User drag-dropped or tapped a swap target */
  swap: [fromId: number, toId: number];
}>();
</script>

<style scoped>
/* ── Card shell ─────────────────────────────────────────────────────────── */
.bench-card {
  margin: 0;
  --background: var(--ion-background-color);
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.bench-header {
  padding-bottom: 4px;
}

.bench-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bench-title {
  font-size: 1rem;
  font-weight: 700;
}

.bench-count {
  font-size: 12px;
}

/* ── Scrollable strip ───────────────────────────────────────────────────── */
.bench-content {
  padding-top: 8px !important;
  padding-bottom: 12px !important;
}

.bench-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
  /* Momentum scrolling on iOS */
  -webkit-overflow-scrolling: touch;
  /* Hide scrollbar while keeping functionality */
  scrollbar-width: none;
}

.bench-scroll::-webkit-scrollbar {
  display: none;
}

/* Fixed width so tiles don't compress on narrow viewports */
.bench-node {
  flex: 0 0 76px;
  width: 76px;
}

/* ── Empty state ────────────────────────────────────────────────────────── */
.bench-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0 8px;
  text-align: center;
  color: var(--ion-color-medium);
}

.bench-empty-icon {
  font-size: 2rem;
  margin-bottom: 8px;
  opacity: 0.5;
}

.bench-empty-title {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 4px;
}

.bench-empty-hint {
  font-size: 12px;
  margin: 0;
  opacity: 0.7;
}
</style>
