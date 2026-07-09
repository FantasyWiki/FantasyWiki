<template>
  <div class="logout-card">
    <button class="dismiss-btn" @click="dismiss">
      <ion-icon :icon="closeOutline" />
    </button>

    <ion-avatar v-if="user?.picture" class="logout-avatar">
      <img :src="user.picture" alt="" referrerpolicy="no-referrer" />
    </ion-avatar>

    <ion-text class="logout-title">
      <h2>{{ $t("auth.logout.title") }}</h2>
    </ion-text>

    <ion-text color="medium" class="logout-message">
      <p>{{ $t("auth.logout.message", { name: user?.name ?? "" }) }}</p>
      <p class="logout-email">{{ user?.email }}</p>
    </ion-text>

    <ion-button
      expand="block"
      color="danger"
      class="logout-btn"
      @click="confirm"
    >
      {{ $t("auth.logout.confirm") }}
    </ion-button>
    <ion-button
      expand="block"
      fill="outline"
      class="logout-btn"
      @click="dismiss"
    >
      {{ $t("auth.logout.cancel") }}
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import {
  IonAvatar,
  IonButton,
  IonIcon,
  IonText,
  modalController,
} from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import { computed } from "vue";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
const user = computed(() => appStore.currentUser);

function dismiss() {
  modalController.dismiss(null, "cancel");
}

// The NavBar owns the actual logout: it reads this role from didDismiss so
// store mutation and navigation stay in the layout, like the login flow.
function confirm() {
  modalController.dismiss(null, "confirm");
}
</script>

<style scoped>
.logout-card {
  position: relative;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.dismiss-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ion-color-medium);
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logout-avatar {
  width: 4rem;
  height: 4rem;
}

.logout-title h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.logout-message {
  text-align: center;
  font-size: 0.95rem;
}

.logout-message p {
  margin: 0;
}

.logout-email {
  font-size: 0.8rem;
}

.logout-btn {
  width: 100%;
  --border-radius: 8px;
}
</style>
