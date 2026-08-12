<template>
  <nav-bar>
    <page-reveal class="join-layout">
      <section class="join-panel">
        <h2 class="panel-title">{{ t("joinLeague.title") }}</h2>
        <p class="panel-hint">{{ t("joinLeague.hint") }}</p>

        <!-- Step 1: the code ─────────────────────────── -->
        <label class="field-label" for="invitation-code">
          {{ t("joinLeague.codeLabel") }}
        </label>

        <ion-item
          class="code-input-item"
          lines="none"
          :color="showFailure ? 'danger' : ''"
        >
          <!-- Autofocused, unlike the team-name field: this page exists for
               exactly one action and arrives with nothing else to read. An
               invitation link fills it in and the field is skipped entirely. -->
          <ion-input
            id="invitation-code"
            v-model="typed"
            autocapitalize="characters"
            autocorrect="off"
            :spellcheck="false"
            :maxlength="INVITATION_CODE_LENGTH + 2"
            :placeholder="t('joinLeague.codePlaceholder')"
            class="code-input"
          />
        </ion-item>

        <div class="input-footer">
          <ion-text :color="showFailure ? 'danger' : 'medium'" class="helper">
            {{ helperText }}
          </ion-text>
          <ion-spinner v-if="isFetching" name="dots" class="field-spinner" />
        </div>

        <!-- Step 2: what the code opened ──────────────── -->
        <!-- Only ever rendered for a league the server resolved. A preview
             built from anything the client guessed would be a way to walk a
             player into a join that cannot succeed. -->
        <template v-if="league">
          <div class="preview">
            <!-- The name, which the factsheet does not carry — on the league
                 page it lives in the page heading, and without it here the
                 preview would answer every question about the league except
                 which one it is. -->
            <h3 class="preview-name">
              <span class="preview-icon" aria-hidden="true">
                {{ league.icon }}
              </span>
              {{ league.title }}
            </h3>
            <league-factsheet :league="league" :team-count="league.teamCount" />
          </div>

          <!-- An ended league is previewed but not joinable — the same rule the
               backend refuses on, read here through the same function so the
               button and the server cannot disagree. Saying so beats a live
               button that answers 409. -->
          <ion-text v-if="isInactive" color="medium" class="ended-note">
            {{ t("joinLeague.ended") }}
          </ion-text>

          <team-creation-form
            v-else
            :league="league"
            :invitation-code="normalized"
            @created="handleCreated"
          />
        </template>
      </section>
    </page-reveal>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { IonInput, IonItem, IonSpinner, IonText } from "@ionic/vue";
import { Temporal } from "@js-temporal/polyfill";
import { useI18n } from "vue-i18n";

import NavBar from "@/layout/NavBar.vue";
import PageReveal from "@/components/PageReveal.vue";
import LeagueFactsheet from "@/components/league/LeagueFactsheet.vue";
import TeamCreationForm from "@/components/TeamCreationForm.vue";
import { useLeagueByCode } from "@/composables/useLeagueByCode";
import { useLeagueStore } from "@/stores/league";
import {
  INVITATION_CODE_LENGTH,
  isLeagueInactive,
} from "../../../model/league";

/**
 * Entering a league by invitation code — one page for the whole act, in two
 * steps that share a screen.
 *
 * Its own route rather than a modal on the league section, for two reasons that
 * point the same way. It is the landing site of an **invitation link**: a URL
 * has to name something, and `?code=` on a page whose only job is this is the
 * honest thing for it to name. And the second step is a form, not a
 * confirmation — the player has to see the league and then name a team in it,
 * which is more than a dialog should be asked to hold.
 *
 * The code stays in the query string rather than being swapped for the league
 * id once it resolves, so the URL a player was sent is the URL they can resend,
 * and a reload does not drop them back at an empty field.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const leagueStore = useLeagueStore();

// Seeded from the link, then owned by the field. Read once rather than watched:
// after the first render the input is the source of truth, and re-seeding on
// every route change would fight a player mid-type.
const typed = ref(typeof route.query.code === "string" ? route.query.code : "");

const { league, normalized, isWellFormed, isFetching, isError, isRateLimited } =
  useLeagueByCode(typed);

/**
 * Keeps the link shareable and the back button honest: the resolved code is
 * written back into the URL, so reloading the page or sending it on lands
 * somewhere that still works. `replace`, because typing a code is not a step in
 * a trail — `push` would make Back walk it character by character.
 */
watch(normalized, (code) => {
  const current = typeof route.query.code === "string" ? route.query.code : "";
  if (code === current) return;
  router.replace({ query: code ? { code } : {} });
});

const isInactive = computed(
  () => !!league.value && isLeagueInactive(league.value, Temporal.Now.instant())
);

// Nothing is said about a code still being typed. Complaining at character
// three would mark every code wrong on the way to being right.
const showFailure = computed(
  () => isWellFormed.value && !isFetching.value && isError.value
);

const helperText = computed(() => {
  if (isRateLimited.value) return t("joinLeague.rateLimited");
  // One message for every way a lookup can come back empty, because the server
  // draws no distinction either: telling someone their code is the right shape
  // but unused tells them their guessing is on track (ADR 0008).
  if (showFailure.value) return t("joinLeague.notFound");
  return t("joinLeague.codeHelper", { length: INVITATION_CODE_LENGTH });
});

async function handleCreated() {
  // The player was not a member a second ago, so the store the NavBar filled on
  // mount does not know this league yet — the dashboard would render its "no
  // league" card without this.
  await leagueStore.fetchLeagues();

  const joined =
    leagueStore.availableLeagues.find((lg) => lg.id === league.value?.id) ??
    league.value;
  if (joined) leagueStore.setCurrentLeague(joined);

  await router.push("/dashboard");
}
</script>

<style scoped>
.join-layout {
  max-width: 30rem;
  margin: 0 auto;
  padding: 2.5rem 0 2rem;
}

.join-panel {
  padding: 1.5rem;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  background: var(--ion-background-color-step-50);
}

.panel-title {
  margin: 0 0 0.35rem;
  font-family: var(--font-family-headings);
  font-size: 1.25rem;
  line-height: 1.3;
}

.panel-hint {
  margin: 0 0 1.5rem;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--ion-color-medium);
}

.field-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

.code-input-item {
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  --padding-start: 12px;
  --background: var(--ion-background-color);
}

.code-input-item:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.16);
}

.code-input-item[color="danger"] {
  border-color: var(--ion-color-danger);
}

/* Codes are read aloud and copied by eye, so they are set like the one on the
   invite card: monospaced, wide-tracked, upper-case. */
.code-input {
  font-family: var(--font-family-monospace, monospace);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  margin-top: 0.4rem;
  padding: 0 2px;
}

.helper {
  font-size: 0.75rem;
}

.field-spinner {
  flex-shrink: 0;
  height: 1rem;
}

.preview {
  margin-top: 1.75rem;
}

.preview-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.75rem;
  font-family: var(--font-family-headings);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.preview-icon {
  font-size: 1.35rem;
  line-height: 1;
  flex-shrink: 0;
}

.ended-note {
  display: block;
  font-size: 0.8125rem;
}
</style>
