<template>
  <!-- Absent, not empty. A player the invite policy does not cover gets no
       card at all — a disabled or explanatory one would tell them a code
       exists, which is the thing the endpoint's 404 exists to avoid. -->
  <section v-if="code" class="invite" :aria-label="t('league.inviteLabel')">
    <div class="invite-text">
      <p class="invite-label">{{ t("league.inviteLabel") }}</p>
      <p class="invite-hint">{{ t("league.inviteHint") }}</p>
    </div>

    <div class="invite-code-row">
      <code class="invite-code">{{ code }}</code>
      <ion-button
        fill="clear"
        size="small"
        :aria-label="t('league.inviteCopy')"
        @click="copy"
      >
        <ion-icon
          slot="icon-only"
          :icon="copied ? checkmarkOutline : copyOutline"
        />
      </ion-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { IonButton, IonIcon } from "@ionic/vue";
import { checkmarkOutline, copyOutline } from "ionicons/icons";
import { useI18n } from "vue-i18n";
import { useInvitationCode } from "@/composables/useInvitationCode";
import type { LeagueDTO } from "../../../../dto/leagueDTO";

const props = defineProps<{
  leagueId: string | undefined;
  league: LeagueDTO | undefined;
}>();

const { t } = useI18n();
const { code } = useInvitationCode(
  () => props.leagueId,
  () => props.league
);

const copied = ref(false);

async function copy() {
  if (!code.value) return;
  await navigator.clipboard.writeText(code.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}
</script>

<style scoped>
/* Deliberately quieter than the factsheet above it: this is a tool for the
   handful of players who can invite, not one of the league's facts. */
.invite {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  border: 1px dashed var(--ion-border-color);
  border-radius: 12px;
  padding: 0.75rem 1.125rem;
  margin-bottom: 1.25rem;
}

.invite-text {
  min-width: 0;
}

.invite-label {
  margin: 0 0 2px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}

.invite-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--ion-color-medium);
}

.invite-code-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
}

.invite-code {
  font-family: var(--font-family-monospace, monospace);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  /* The trailing letter-space would otherwise sit between code and button. */
  margin-right: -0.2em;
  color: var(--ion-color-wiki-gold);
}
</style>
