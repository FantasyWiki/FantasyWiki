<template>
  <ion-item-group
    class="ion-display-flex ion-justify-content-center ion-flex-no-wrap ion-padding-vertical"
  >
    <section
      v-for="(stat, i) in stats"
      v-bind:key="i"
      class="ion-padding-horizontal"
      :class="i !== stats.length - 1 ? 'border-right' : ''"
    >
      <ion-text color="primary" class="ion-no-margin ion-text-center">
        {{ stat.title }}
      </ion-text>
      <p class="ion-no-margin">{{ stat.description }}</p>
    </section>
  </ion-item-group>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { IonItemGroup, IonText } from "@ionic/vue";

const { t } = useI18n();

const stats = computed(() => [
  { title: "50K+", description: t("home.stats.articlesDrafted") },
  { title: "1M+", description: t("home.stats.pointsEarned") },
  { title: "10K+", description: t("home.stats.activeUsers") },
]);
</script>

<style scoped>
.border-right {
  border-right: 1px solid var(--ion-color-light-shade);
}

ion-text {
  font-size: 1.875rem;
  line-height: 2.25rem;
  font-weight: bold;
}
</style>
