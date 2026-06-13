<template>
  <nav-bar>
    <div class="team-creation-container">
      <ion-card class="team-card">
        <ion-card-header class="ion-text-center">
          <div class="league-icon-container">
            <span class="league-icon">{{ league.icon }}</span>
          </div>
          <ion-card-title>Create Your Team</ion-card-title>
          <p class="subtitle">
            You're joining <strong>{{ league.name }}</strong
            >. Choose a unique name for your team.
          </p>
        </ion-card-header>

        <ion-card-content>
          <form @submit.prevent="handleSubmit">
            <ion-label class="team-name-label">
              <ion-icon :icon="shieldOutline" color="primary"></ion-icon>
              Team Name
            </ion-label>

            <ion-item
              class="team-input-item"
              lines="none"
              :color="error ? 'danger' : ''"
            >
              <ion-input
                placeholder="e.g. The Wiki Wizards"
                v-model="teamName"
                :maxlength="30"
                @ionInput="error = ''"
                autofocus
              ></ion-input>
            </ion-item>

            <div class="input-footer">
              <ion-text
                :color="error ? 'danger' : 'medium'"
                class="helper-text"
              >
                {{ error || "Must be unique within the league" }}
              </ion-text>
              <ion-text color="medium" class="char-count">
                {{ teamName.length }}/30
              </ion-text>
            </div>

            <ion-button
              expand="block"
              type="submit"
              :disabled="isSubmitting || !teamName.trim()"
              class="submit-button"
            >
              <ion-icon
                :icon="sparklesOutline"
                slot="start"
                v-if="!isSubmitting"
              ></ion-icon>
              {{ isSubmitting ? "Creating..." : "Create Team & Start Playing" }}
            </ion-button>
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  </nav-bar>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonInput,
  IonButton,
  IonIcon,
  IonLabel,
  IonText,
  toastController,
} from "@ionic/vue";
import { shieldOutline, sparklesOutline } from "ionicons/icons";
import NavBar from "@/layout/NavBar.vue";

const router = useRouter();

// Mock league context for now
const league = ref({
  name: "Premier League",
  icon: "🌍",
});

const teamName = ref("");
const isSubmitting = ref(false);
const error = ref("");

const existingTeamNames = [
  "The Champions",
  "Wiki Warriors",
  "Page Turners",
  "Edit Masters",
];

const handleSubmit = async () => {
  const trimmed = teamName.value.trim();

  if (!trimmed) {
    error.value = "Team name is required.";
    return;
  }

  if (trimmed.length < 3) {
    error.value = "Team name must be at least 3 characters.";
    return;
  }

  if (trimmed.length > 30) {
    error.value = "Team name must be 30 characters or less.";
    return;
  }

  if (
    existingTeamNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())
  ) {
    error.value =
      "This team name is already taken in this league. Please choose another.";
    return;
  }

  error.value = "";
  isSubmitting.value = true;

  // Simulate network request
  await new Promise((r) => setTimeout(r, 800));
  isSubmitting.value = false;

  const toast = await toastController.create({
    message: `Team Created! 🎉 "${trimmed}" is ready to compete in ${league.value.name}.`,
    duration: 3000,
    color: "success",
    position: "bottom",
  });
  await toast.present();

  router.push("/dashboard");
};
</script>

<style scoped>
.team-creation-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
}

.team-card {
  width: 100%;
  max-width: 450px;
  box-shadow: none;
  border: 1px solid var(--ion-border-color);
  border-radius: 0.5rem;
}

.league-icon-container {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
}

.league-icon {
  font-size: 32px;
}

ion-card-title {
  font-size: 1.5rem;
  line-height: 2rem;
}

.subtitle {
  color: var(--ion-color-medium);
  font-size: 14px;
  margin-top: 8px;
}

.team-name-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.team-input-item {
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  --padding-start: 16px;
  margin-bottom: 8px;
}

.team-input-item:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 2px rgba(var(--ion-color-primary-rgb), 0.2);
}

.team-input-item[color="danger"] {
  border-color: var(--ion-color-danger);
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 0 4px;
}

.helper-text,
.char-count {
  font-size: 12px;
}

.submit-button {
  margin-top: 24px;
}
</style>
