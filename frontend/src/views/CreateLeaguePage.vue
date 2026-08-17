<template>
  <nav-bar>
    <div class="page-container">
      <!-- The form, until there is a league. ─────────── -->
      <template v-if="!created">
        <header class="hero">
          <h1 class="hero-title">
            <ion-icon
              :icon="trophyOutline"
              class="hero-icon"
              aria-hidden="true"
            />
            {{ t("createLeague.title") }}
          </h1>
          <p class="hero-subtitle">{{ t("createLeague.subtitle") }}</p>
        </header>

        <form class="card" @submit.prevent="handleSubmit">
          <!-- Badge ──────────────────────────────────── -->
          <fieldset class="field">
            <legend class="field-label">{{ t("createLeague.icon") }}</legend>
            <div class="icon-grid">
              <button
                v-for="option in LEAGUE_ICONS"
                :key="option"
                type="button"
                class="icon-option"
                :class="{ selected: icon === option }"
                :aria-pressed="icon === option"
                :aria-label="option"
                @click="icon = option"
              >
                {{ option }}
              </button>
            </div>
          </fieldset>

          <!-- Name ───────────────────────────────────── -->
          <div class="field">
            <label class="field-label" for="league-name">
              {{ t("createLeague.name") }}
            </label>
            <ion-item class="input-item" lines="none">
              <ion-input
                id="league-name"
                v-model="name"
                :placeholder="t('createLeague.namePlaceholder')"
                :maxlength="LEAGUE_NAME_MAX_LENGTH"
                @ionInput="error = ''"
              />
            </ion-item>
            <p class="field-hint">
              {{ name.trim().length }}/{{ LEAGUE_NAME_MAX_LENGTH }}
            </p>
          </div>

          <!-- Edition ────────────────────────────────── -->
          <!-- A search rather than a dropdown, because the offered set is now
               whatever Wikimedia's editions and their readership say it is
               (#531) rather than two hardcoded options. -->
          <div class="field">
            <label id="league-domain-label" class="field-label">
              {{ t("createLeague.domain") }}
            </label>
            <button
              id="league-domain"
              type="button"
              class="edition-button input-item"
              aria-labelledby="league-domain-label"
              @click="isEditionPickerOpen = true"
            >
              <span class="edition-names">
                <span class="edition-name">{{ selectedName }}</span>
                <span class="edition-domain">
                  {{ domain
                  }}<span class="edition-domain-suffix">.wikipedia</span>
                </span>
              </span>
              <span class="edition-change">
                {{ t("createLeague.domainChange") }}
              </span>
            </button>
            <p class="field-hint">{{ t("createLeague.domainHint") }}</p>
          </div>

          <!-- Length ─────────────────────────────────── -->
          <div class="field">
            <label class="field-label" for="league-duration">
              {{ t("createLeague.duration") }}
            </label>
            <ion-item class="input-item" lines="none">
              <ion-select
                id="league-duration"
                v-model="duration"
                interface="popover"
                :aria-label="t('createLeague.duration')"
              >
                <ion-select-option
                  v-for="option in DURATION_OPTIONS"
                  :key="option"
                  :value="option"
                >
                  {{ durationLabels[option] }}
                </ion-select-option>
              </ion-select>
            </ion-item>
            <p class="field-hint">
              {{ t("createLeague.endsOn", { date: endsOn }) }}
            </p>
          </div>

          <!-- Access ─────────────────────────────────── -->
          <fieldset class="field">
            <legend class="field-label">
              {{ t("createLeague.visibility") }}
            </legend>
            <ion-segment v-model="visibility">
              <ion-segment-button :value="LeagueVisibility.PUBLIC">
                <ion-label>{{ t("createLeague.public") }}</ion-label>
              </ion-segment-button>
              <ion-segment-button :value="LeagueVisibility.PRIVATE">
                <ion-label>{{ t("createLeague.private") }}</ion-label>
              </ion-segment-button>
            </ion-segment>
            <p class="field-hint">
              {{
                isPrivate
                  ? t("createLeague.privateHint")
                  : t("createLeague.publicHint")
              }}
            </p>
          </fieldset>

          <!-- Who may invite — only means anything for a private league, since
               a public one has no code to hand out. -->
          <div v-if="isPrivate" class="field">
            <label class="field-label" for="league-invite-policy">
              {{ t("createLeague.invitePolicy") }}
            </label>
            <ion-item class="input-item" lines="none">
              <ion-select
                id="league-invite-policy"
                v-model="invitePolicy"
                interface="popover"
                :aria-label="t('createLeague.invitePolicy')"
              >
                <ion-select-option :value="LeagueInvitePolicy.MEMBERS">
                  {{ t("createLeague.invitePolicyMembers") }}
                </ion-select-option>
                <ion-select-option :value="LeagueInvitePolicy.ADMIN">
                  {{ t("createLeague.invitePolicyAdmin") }}
                </ion-select-option>
              </ion-select>
            </ion-item>
          </div>

          <!-- Founding team ──────────────────────────── -->
          <!-- Not an afterthought: the league and this team are written
               together, so there is never a league its founder is not in. -->
          <div class="field team-field">
            <label class="field-label" for="team-name">
              {{ t("createLeague.teamName") }}
            </label>
            <ion-item class="input-item" lines="none">
              <ion-input
                id="team-name"
                v-model="teamName"
                :placeholder="t('createLeague.teamNamePlaceholder')"
                :maxlength="TEAM_NAME_MAX_LENGTH"
                @ionInput="error = ''"
              />
            </ion-item>
            <p class="field-hint">{{ t("createLeague.teamNameHint") }}</p>
          </div>

          <p v-if="error" class="form-error">{{ error }}</p>

          <ion-button
            expand="block"
            type="submit"
            :disabled="isSubmitting || !isComplete"
            class="submit-button"
          >
            {{
              isSubmitting
                ? t("createLeague.creating")
                : t("createLeague.submit")
            }}
          </ion-button>
        </form>
      </template>

      <!-- Once it exists. ───────────────────────────── -->
      <page-reveal v-else>
        <div class="card success">
          <div class="success-badge" aria-hidden="true">
            {{ created.icon }}
          </div>
          <h1 class="success-title">
            {{ t("createLeague.createdTitle", { name: created.title }) }}
          </h1>
          <p class="success-subtitle">
            {{ t("createLeague.createdSubtitle", { team: teamName.trim() }) }}
          </p>

          <!-- Only a private league has a code; a public one is joinable
               without one, so there is nothing to show and nothing to fetch. -->
          <div v-if="created.visibility === LeagueVisibility.PRIVATE">
            <p class="code-label">{{ t("createLeague.codeLabel") }}</p>
            <div v-if="inviteCode" class="code-row">
              <code class="code">{{ inviteCode }}</code>
              <ion-button
                fill="clear"
                size="small"
                :aria-label="t('createLeague.copy')"
                @click="copyCode"
              >
                <ion-icon
                  slot="icon-only"
                  :icon="copied ? checkmarkOutline : copyOutline"
                />
              </ion-button>
            </div>
            <p v-else class="code-pending">
              {{ t("createLeague.codePending") }}
            </p>
            <p class="code-hint">{{ t("createLeague.codeHint") }}</p>
          </div>

          <div class="success-actions">
            <ion-button expand="block" @click="goToLeague">
              {{ t("createLeague.goToLeague") }}
            </ion-button>
            <ion-button expand="block" fill="outline" router-link="/leagues">
              {{ t("createLeague.backToLeagues") }}
            </ion-button>
          </div>
        </div>
      </page-reveal>

      <!-- Edition picker. A modal because the list is every live Wikipedia
           edition — a few hundred of them, which is a search rather than a
           dropdown. -->
      <ion-modal
        :is-open="isEditionPickerOpen"
        @did-dismiss="closeEditionPicker"
      >
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ t("createLeague.domain") }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeEditionPicker">
                {{ t("createLeague.domainDone") }}
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
          <ion-toolbar>
            <ion-searchbar
              v-model="editionSearch"
              :placeholder="t('createLeague.domainSearch')"
            />
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <p v-if="isEditionsPending" class="edition-status">
            {{ t("createLeague.domainLoading") }}
          </p>
          <p v-else-if="matchingEditions.length === 0" class="edition-status">
            {{ t("createLeague.domainEmpty") }}
          </p>
          <ion-list v-else>
            <ion-item
              v-for="edition in matchingEditions"
              :key="edition.code"
              button
              :detail="false"
              @click="selectEdition(edition.code)"
            >
              <ion-label>
                <h3>{{ edition.englishName }}</h3>
                <p class="edition-domain">
                  {{ edition.code
                  }}<span class="edition-domain-suffix">.wikipedia</span>
                </p>
              </ion-label>
              <ion-icon
                v-if="edition.code === domain"
                slot="end"
                :icon="checkmarkOutline"
                aria-hidden="true"
              />
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-modal>
    </div>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import {
  onIonViewWillEnter,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import { checkmarkOutline, copyOutline, trophyOutline } from "ionicons/icons";
import { useI18n } from "vue-i18n";
import { Temporal } from "@js-temporal/polyfill";

import NavBar from "@/layout/NavBar.vue";
import PageReveal from "@/components/PageReveal.vue";
import api from "@/services/api";
import { useToast } from "@/composables/useToast";
import { useLeagueStore } from "@/stores/league";
import { useWikipediaEditions } from "@/composables/useWikipediaEditions";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import {
  LeagueInvitePolicy,
  LeagueVisibility,
  type Domain,
} from "../../../model/enums";
import {
  LEAGUE_DURATION_DAYS,
  LEAGUE_ICONS,
  LEAGUE_NAME_MAX_LENGTH,
  LEAGUE_NAME_MIN_LENGTH,
  leagueEndDate,
  type LeagueDuration,
} from "../../../model/league";
import {
  TEAM_NAME_MAX_LENGTH,
  TEAM_NAME_MIN_LENGTH,
} from "../../../model/team";
import { REFERENCE_DOMAIN } from "../../../model/languageScale";

const { t } = useI18n();
const router = useRouter();
const { showSuccess } = useToast();
const leagueStore = useLeagueStore();

const DURATION_OPTIONS = Object.keys(
  LEAGUE_DURATION_DAYS
) as readonly LeagueDuration[];

/**
 * Labels for the durations the model defines, spelled out rather than built as
 * a template-literal key. Two reasons, and the second is the real one: the i18n
 * lint cannot see through such a key and reads every entry as unused, and typing
 * this as a total Record means adding a duration to `model/` fails to compile
 * here until it has a label.
 *
 * Editions used to be listed the same way and no longer can be. There are a few
 * dozen of them, they come from Wikimedia rather than from `model/`, and their
 * names are not ours to translate — each is shown by its own autonym
 * (`italiano`) with its English name beneath (#531).
 */
const durationLabels = computed<Record<LeagueDuration, string>>(() => ({
  "2w": t("createLeague.durations.2w"),
  "1m": t("createLeague.durations.1m"),
  "2m": t("createLeague.durations.2m"),
  "3m": t("createLeague.durations.3m"),
  "6m": t("createLeague.durations.6m"),
}));

const icon = ref<string>(LEAGUE_ICONS[0]);
const name = ref("");

// The reference edition as the default, and the only code this page still names.
// It is the largest edition and always calibrated, so the form has a valid
// selection before the edition list has loaded.
const domain = ref<Domain>(REFERENCE_DOMAIN);

const isEditionPickerOpen = ref(false);
const editionSearch = ref("");
const {
  matching: matchingEditions,
  isPending: isEditionsPending,
  find: findEdition,
} = useWikipediaEditions(editionSearch);

// The edition's English name, falling back to its bare code while the list is
// still loading so the field never reads as empty. The code itself is always
// shown beneath as `xx.wikipedia`, which is how a league states its edition
// everywhere else (LeagueCard, LeagueFactsheet) — the same fact in the same
// shape, so picking an edition and later reading it back look like one thing.
const selectedName = computed(
  () => findEdition(domain.value)?.englishName ?? domain.value
);

function selectEdition(code: string) {
  domain.value = code;
  closeEditionPicker();
}

function closeEditionPicker() {
  isEditionPickerOpen.value = false;
  // Cleared on close so reopening starts from the whole list rather than from
  // whatever was typed last time.
  editionSearch.value = "";
}
const duration = ref<LeagueDuration>("1m");
const visibility = ref<LeagueVisibility>(LeagueVisibility.PRIVATE);
const invitePolicy = ref<LeagueInvitePolicy>(LeagueInvitePolicy.MEMBERS);
const teamName = ref("");

const isSubmitting = ref(false);
const error = ref("");
const created = ref<LeagueDTO | null>(null);
const inviteCode = ref("");
const copied = ref(false);

// Private by default: a league of friends is what this product is for, and the
// default should be the one that cannot leak a league to strangers by omission.
const isPrivate = computed(() => visibility.value === LeagueVisibility.PRIVATE);

const isComplete = computed(
  () =>
    name.value.trim().length >= LEAGUE_NAME_MIN_LENGTH &&
    teamName.value.trim().length >= TEAM_NAME_MIN_LENGTH
);

// Shown live, because "3 Months" is abstract and a date is not.
const endsOn = computed(() =>
  new Date(
    leagueEndDate(Temporal.Now.instant(), duration.value).epochMilliseconds
  ).toLocaleDateString()
);

async function handleSubmit() {
  error.value = "";
  isSubmitting.value = true;

  let league: LeagueDTO;
  try {
    league = await api.leagues.create({
      name: name.value.trim(),
      icon: icon.value,
      domain: domain.value,
      duration: duration.value,
      visibility: visibility.value,
      // Sent whatever the access choice, since the field is hidden for a
      // public league: an absent policy would be read back as `admin`.
      invitePolicy: invitePolicy.value,
      teamName: teamName.value.trim(),
    });
  } catch (err) {
    isSubmitting.value = false;
    error.value = err instanceof Error ? err.message : t("createLeague.failed");
    return;
  }

  isSubmitting.value = false;
  created.value = league;

  // The player now fields a team in one more league, and the selector, the
  // dashboard and the league list all read that from the store.
  await leagueStore.fetchLeagues();
  leagueStore.setCurrentLeague(league);

  if (league.visibility === LeagueVisibility.PRIVATE) {
    try {
      inviteCode.value = (await api.leagues.getInviteCode(league.id)).code;
    } catch {
      // The league exists either way — that is the news. The code has its own
      // place on the league page, so a failure here is a blank, not an alarm.
      inviteCode.value = "";
    }
  }

  await showSuccess(t("createLeague.created", { name: league.title }));
}

/**
 * Put the form back to a blank one.
 *
 * Called every time the view becomes visible, not just on mount. Ionic keeps
 * pages alive inside `ion-router-outlet`, so a player who founds a league and
 * later comes back to found another was met by the *success card of the previous
 * league* — the component was never torn down, so `created` was still set and
 * nothing short of a page reload cleared it. (`TeamFormation` re-measures on the
 * same hook, for the same reason.)
 *
 * Everything is reset rather than just `created`: "create a league" should open a
 * blank form, and leaving a half-typed name and a stale invitation code behind is
 * the same surprise in a quieter form.
 */
function resetForm() {
  created.value = null;
  inviteCode.value = "";
  copied.value = false;
  error.value = "";
  isSubmitting.value = false;

  icon.value = LEAGUE_ICONS[0];
  name.value = "";
  teamName.value = "";
  domain.value = REFERENCE_DOMAIN;
  duration.value = "1m";
  visibility.value = LeagueVisibility.PRIVATE;
  invitePolicy.value = LeagueInvitePolicy.MEMBERS;
  closeEditionPicker();
}

onIonViewWillEnter(resetForm);

async function copyCode() {
  await navigator.clipboard.writeText(inviteCode.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

function goToLeague() {
  if (created.value) router.push(`/leagues/${created.value.id}`);
}
</script>

<style scoped>
.page-container {
  max-width: 32rem;
  margin: 0 auto;
}

/* ── Hero ──────────────────────────────────────── */
.hero {
  text-align: center;
  margin-bottom: 1.5rem;
}

.hero-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0 0 0.5rem;
  font-family: var(--font-family-headings);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.hero-icon {
  font-size: 1.6rem;
  color: var(--ion-color-wiki-gold);
  flex-shrink: 0;
}

.hero-subtitle {
  margin: 0;
  color: var(--ion-color-medium);
}

/* ── Card ──────────────────────────────────────── */
.card {
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 1.25rem;
}

.field {
  margin: 0 0 1.25rem;
  padding: 0;
  border: 0;
}

.field-label {
  display: block;
  margin-bottom: 0.5rem;
  padding: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

.field-hint {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.input-item {
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  --padding-start: 12px;
  --background: var(--ion-background-color);
}

.input-item:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.16);
}

/* ── Edition field ─────────────────────────────── */
/* Shaped like the inputs beside it rather than announced as a control of its
   own: it opens a picker, but it reads as the same kind of row as the name. */
.edition-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding: 0.8rem 12px;
  background: var(--ion-background-color);
  text-align: left;
  cursor: pointer;
}

.edition-names {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.edition-name {
  color: var(--ion-text-color);
  font-size: 0.95rem;
}

/* The domain, given the same understated treatment as on the league page: the
   code carries the weight and `.wikipedia` trails off it. */
.edition-domain {
  color: var(--ion-color-medium);
  font-size: 0.75rem;
}

.edition-domain-suffix {
  opacity: 0.7;
}

.edition-change {
  flex-shrink: 0;
  color: var(--ion-color-primary);
  font-size: 0.75rem;
  font-weight: 600;
}

.edition-status {
  margin: 1.5rem;
  color: var(--ion-color-medium);
  text-align: center;
}

/* ── Icon grid ─────────────────────────────────── */
.icon-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 0.4rem;
}

.icon-option {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  background: var(--ion-color-light);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}

.icon-option.selected {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 2px rgba(var(--ion-color-primary-rgb), 0.25);
}

/* A rule, not a heading: the founding team is part of the same act, so it is
   separated rather than announced. */
.team-field {
  margin-bottom: 0;
  padding-top: 1.25rem;
  border-top: 1px solid var(--ion-border-color);
}

.form-error {
  margin: 1rem 0 0;
  font-size: 0.8125rem;
  color: var(--ion-color-danger);
}

.submit-button {
  margin-top: 1.5rem;
}

/* ── Success ───────────────────────────────────── */
.success {
  text-align: center;
}

.success-badge {
  font-size: 2.5rem;
  line-height: 1;
  margin-bottom: 0.75rem;
}

.success-title {
  margin: 0 0 0.35rem;
  font-family: var(--font-family-headings);
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.success-subtitle {
  margin: 0 0 1.5rem;
  color: var(--ion-color-medium);
}

.code-label {
  margin: 0 0 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ion-color-medium);
}

.code-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.code {
  font-family: var(--font-family-monospace, monospace);
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  /* The trailing letter-spacing would otherwise push the code off centre. */
  text-indent: 0.22em;
  color: var(--ion-color-wiki-gold);
}

.code-pending,
.code-hint {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.success-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1.5rem;
}
</style>
