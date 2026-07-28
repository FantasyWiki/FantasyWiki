<template>
  <form class="team-form" @submit.prevent="handleSubmit">
    <p class="form-league">
      <span class="league-icon" aria-hidden="true">{{ league.icon }}</span>
      <span>
        {{ t("views.teamCreation.joining") }}
        <strong>{{ league.title }}</strong>
      </span>
    </p>

    <label class="form-label" for="team-name">
      {{ t("views.teamCreation.nameLabel") }}
    </label>

    <ion-item
      class="team-input-item"
      lines="none"
      :color="error ? 'danger' : ''"
    >
      <ion-input
        id="team-name"
        v-model="teamName"
        :placeholder="t('views.teamCreation.placeholder')"
        :maxlength="MAX_NAME"
        autofocus
        @ionInput="error = ''"
      />
    </ion-item>

    <div class="input-footer">
      <ion-text :color="error ? 'danger' : 'medium'" class="helper-text">
        {{ error || t("views.teamCreation.helper") }}
      </ion-text>
      <ion-text color="medium" class="char-count">
        {{ teamName.length }}/{{ MAX_NAME }}
      </ion-text>
    </div>

    <ion-button
      expand="block"
      type="submit"
      color="primary"
      :disabled="isSubmitting || !teamName.trim()"
      class="submit-button"
    >
      <ion-icon v-if="!isSubmitting" :icon="sparklesOutline" slot="start" />
      {{
        isSubmitting
          ? t("views.teamCreation.creating")
          : t("views.teamCreation.submit")
      }}
    </ion-button>
  </form>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { IonItem, IonInput, IonButton, IonIcon, IonText } from "@ionic/vue";
import { sparklesOutline } from "ionicons/icons";
import { useI18n } from "vue-i18n";
import api from "@/services/api";
import { useToast } from "@/composables/useToast";
import { LeagueDTO } from "../../../dto/leagueDTO";
import { TeamDTO } from "../../../dto/teamDTO";

/**
 * The team-name form only — no page chrome, no league resolution, no
 * post-submit navigation. Creating a team happens once per league a player
 * enters, so the league is a prop rather than something this component looks
 * up: the host decides *which* league is being joined (the Global League on
 * signup, a chosen one when joining a further league) and what happens once
 * the team exists (on the first run, that decision is what starts the tour).
 */
const props = defineProps<{ league: LeagueDTO }>();
const emit = defineEmits<{ created: [team: TeamDTO] }>();

const MIN_NAME = 3;
const MAX_NAME = 30;

const { t } = useI18n();
const { showSuccess } = useToast();

const teamName = ref("");
const isSubmitting = ref(false);
const error = ref("");

const handleSubmit = async () => {
  const trimmed = teamName.value.trim();

  if (trimmed.length < MIN_NAME) {
    error.value = t("views.teamCreation.tooShort", { min: MIN_NAME });
    return;
  }

  if (trimmed.length > MAX_NAME) {
    error.value = t("views.teamCreation.tooLong", { max: MAX_NAME });
    return;
  }

  error.value = "";
  isSubmitting.value = true;

  let team: TeamDTO;
  try {
    team = await api.leagues.createMyTeam(props.league.id, trimmed);
  } catch (err) {
    isSubmitting.value = false;
    error.value =
      err instanceof Error ? err.message : t("views.teamCreation.failed");
    return;
  }

  isSubmitting.value = false;

  await showSuccess(
    t("views.teamCreation.created", {
      name: trimmed,
      league: props.league.title,
    })
  );

  emit("created", team);
};
</script>

<style scoped>
.team-form {
  display: flex;
  flex-direction: column;
}

.form-league {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1.25rem;
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

.league-icon {
  font-size: 1.25rem;
}

.form-label {
  margin-bottom: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

.team-input-item {
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  --padding-start: 12px;
  --background: var(--ion-background-color);
}

.team-input-item:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.16);
}

.team-input-item[color="danger"] {
  border-color: var(--ion-color-danger);
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  margin-top: 0.4rem;
  padding: 0 2px;
}

.helper-text,
.char-count {
  font-size: 0.75rem;
}

.char-count {
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.submit-button {
  margin-top: 1.5rem;
}
</style>
