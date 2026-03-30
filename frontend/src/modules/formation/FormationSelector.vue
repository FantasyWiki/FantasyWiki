<template>
  <div class="formation-selector">
    <p class="formation-label">Formation</p>

    <ion-segment
      :value="currentFormation"
      scrollable
      @ionChange="onChange"
    >
      <ion-segment-button
        v-for="f in formations"
        :key="f"
        :value="f"
        class="formation-btn"
      >
        <ion-label>{{ f }}</ion-label>
      </ion-segment-button>
    </ion-segment>
  </div>
</template>

<script setup lang="ts">
import { IonSegment, IonSegmentButton, IonLabel } from "@ionic/vue";

defineProps<{
  /** All available formation IDs, e.g. ['4-3-3', '4-4-2', ...] */
  formations: string[];
  /** Currently active formation */
  currentFormation: string;
}>();

const emit = defineEmits<{
  /** Fires when the user selects a different formation */
  change: [formation: string];
}>();

function onChange(e: CustomEvent) {
  emit("change", e.detail.value as string);
}
</script>

<style scoped>
.formation-selector {
  margin-bottom: 16px;
}

.formation-label {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin: 0 0 6px 2px;
}

ion-segment {
  --background: var(--ion-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.formation-btn {
  --min-width: 72px;
  min-width: 72px;
}

ion-segment-button.segment-button-checked {
  --color-checked: var(--ion-color-primary);
  --indicator-color: var(--ion-color-primary);
  font-weight: 600;
}
</style>
