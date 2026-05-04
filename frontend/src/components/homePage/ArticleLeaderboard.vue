<template>
  <ion-card class="ion-padding">
    <ion-card-header class="ion-no-padding ion-margin-bottom">
      <div class="ion-display-flex ion-justify-content-between">
        <ion-card-title class="ion-text-start">
          🔥 Trending Today
        </ion-card-title>
        <ion-text> Most viewed </ion-text>
      </div>
    </ion-card-header>
    <ion-card-content class="ion-text-center ion-no-padding">
      <div v-if="isLoading" class="ion-padding loading-message">
        <ion-skeleton-text animated class="loading-line"></ion-skeleton-text>
        <ion-skeleton-text animated class="loading-line"></ion-skeleton-text>
      </div>
      <ion-list v-else-if="entries.length > 0" class="ion-no-padding">
        <ion-item
          v-for="entry in entries"
          :key="entry.canonicalTitle"
          class="ion-margin-bottom ion-no-padding"
        >
          <ion-badge class="ion-margin ion-padding">
            <ion-icon
              :icon="trendingUpOutline"
              aria-label="Going up"
            ></ion-icon>
          </ion-badge>
          <ion-label class="ion-text-start ion-padding-horizontal">
            <a
              class="article-link"
              :href="entry.articleUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <h3 class="ion-no-margin">
                #{{ entry.filteredRank }} {{ entry.displayTitle }}
              </h3>
            </a>
            <p class="ion-display-flex ion-align-items-center">
              <ion-icon
                :icon="eyeOutline"
                aria-hidden="true"
                class="eye-icon ion-margin-end"
              ></ion-icon>
              Avg: {{ formatCompactViews(entry.averageViews30d)
              }}<template v-if="entry.averageViews30d !== undefined"
                >/day</template
              >
            </p>
          </ion-label>
          <ion-note slot="end" color="dark" class="ion-text-end">
            <ion-text class="views ion-display-block">
              {{ formatCompactViews(entry.dailyViews) }}
            </ion-text>
          </ion-note>
        </ion-item>
      </ion-list>
      <div v-else-if="hasError" class="ion-padding unavailable-message">
        Top article data unavailable right now.
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSkeletonText,
  IonList,
  IonItem,
  IonLabel,
  IonText,
  IonBadge,
  IonNote,
  IonIcon,
} from "@ionic/vue";
import { eyeOutline, trendingUpOutline } from "ionicons/icons";
import { createWikimediaClient } from "@/services/wikimediaClient";
import type { TopReadEntry } from "../../../../model/wikimedia";

const emit = defineEmits<{
  volumeResolved: [volume: number];
}>();

const entries = ref<TopReadEntry[]>([]);
const isLoading = ref(true);
const hasError = ref(false);
const wikimediaClient = createWikimediaClient();

function formatCompactViews(value: number | undefined): string {
  if (value === undefined) {
    return "N/A";
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toFixed(0);
}

onMounted(async () => {
  isLoading.value = true;
  hasError.value = false;
  try {
    const topRead = await wikimediaClient.pageviews.getTopReadList("en", 5);
    entries.value = topRead.entries;
    emit("volumeResolved", topRead.filteredSnapshotVolume);
  } catch {
    entries.value = [];
    hasError.value = true;
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
ion-card {
  border-radius: 1rem;
  /* There is no way to do this in Ionic */
  --ion-padding: 1.5rem;
}

ion-card-title {
  --ion-margin: 1rem;
}

ion-card-header ion-text {
  font-weight: 500;
}

ion-item {
  --border-style: none;
  --background: var(--ion-background-color);
  --border-radius: 0.5rem;
}

h3 {
  font-weight: 500;
  line-height: 1.25rem;
}

.article-link {
  color: inherit;
  text-decoration: none;
}

ion-item ion-badge {
  --ion-margin: 0.5rem;
  --ion-padding: 0.5rem;
  --background: var(--ion-background-color-step-500);
}

ion-badge ion-icon {
  font-size: 1.3rem;
}

ion-text.views {
  font-weight: bold;
  font-size: 0.875rem;
  line-height: 1.25rem;
}

ion-label {
  --ion-padding: 8px;
}

.eye-icon {
  font-size: 1rem;
  --ion-margin: 4px;
}

.unavailable-message {
  color: var(--ion-color-medium);
}

.loading-message {
  display: grid;
  gap: 0.75rem;
}

.loading-line {
  width: 90%;
  height: 1.2rem;
  margin: 0 auto;
}
</style>
