<template>
  <section class="section-panel stats-section">
    <div class="section-head">
      <h3 class="section-title">
        <ion-icon :icon="statsChartOutline" />
        {{ $t("articleDetail.stats.title") }}
      </h3>
    </div>

    <ion-grid class="ion-no-padding">
      <ion-row>
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">
                {{ $t("articleDetail.stats.currentPrice") }}
              </p>
            </ion-text>
            <p class="info-value ion-no-margin">
              {{
                $t("articleDetail.stats.credits", { count: model.currentPrice })
              }}
            </p>
          </div>
        </ion-col>
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">
                {{ $t("articleDetail.stats.availability") }}
              </p>
            </ion-text>
            <p class="info-value ion-no-margin">
              {{ availabilityValue }}
            </p>
          </div>
        </ion-col>
      </ion-row>

      <ion-row v-if="model.purchasePrice !== undefined">
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">
                {{ $t("articleDetail.stats.purchasePrice") }}
              </p>
            </ion-text>
            <p class="info-value ion-no-margin">
              {{
                $t("articleDetail.stats.credits", {
                  count: model.purchasePrice,
                })
              }}
            </p>
          </div>
        </ion-col>
        <ion-col size="6">
          <div class="info-box">
            <ion-text color="medium">
              <p class="info-label ion-no-margin">
                {{ $t("articleDetail.stats.valueTracking") }}
                <ion-icon
                  :icon="
                    valueDelta >= 0 ? trendingUpOutline : trendingDownOutline
                  "
                  :color="valueDelta >= 0 ? 'success' : 'danger'"
                ></ion-icon>
              </p>
            </ion-text>

            <p class="info-value ion-no-margin">
              <ion-label :color="valueDelta >= 0 ? 'success' : 'danger'"
                >{{ valueDelta >= 0 ? "+ " : ""
                }}{{ percentageDelta.toFixed(2) }} %
              </ion-label>
            </p>
          </div>
        </ion-col>
      </ion-row>
    </ion-grid>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  IonCol,
  IonGrid,
  IonIcon,
  IonLabel,
  IonRow,
  IonText,
} from "@ionic/vue";
import {
  statsChartOutline,
  trendingDownOutline,
  trendingUpOutline,
} from "ionicons/icons";
import type { ArticleDetail } from "@/types/articleDetail";

interface Props {
  model: ArticleDetail;
}

const props = defineProps<Props>();
const { t } = useI18n();

const availabilityValue = computed(() => {
  switch (props.model.availability) {
    case "free-agent":
      return t("articleDetail.stats.freeAgent");
    case "owned-by-viewer":
    case "owned-by-other":
      return props.model.ownerTeamName
        ? t("articleDetail.stats.ownedBy", { name: props.model.ownerTeamName })
        : t("articleDetail.stats.owned");
    default:
      return t("articleDetail.stats.freeAgent");
  }
});

const valueDelta = computed(() => {
  if (props.model.purchasePrice === undefined) return 0;
  return props.model.currentPrice - props.model.purchasePrice;
});

const percentageDelta = computed(() => {
  if (props.model.purchasePrice === undefined) return 0;
  return (valueDelta.value / props.model.purchasePrice) * 100;
});
</script>

<style scoped src="./articleDetailShared.css"></style>

<style scoped>
.stats-section {
  margin-bottom: 1rem;
}

.info-box {
  min-height: 86px;
}

.owner-team {
  margin-top: 0.15rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}
</style>
