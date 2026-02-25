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
import { IonItemGroup, IonText } from "@ionic/vue";
const stats = [
  { title: "50K+", description: "Articles drafted" },
  { title: "1M+", description: "Points earned" },
  { title: "10K+", description: "Active users" },
];
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
