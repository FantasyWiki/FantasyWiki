<template>
  <!-- A full modal rather than the popover/sheet pair this started as. The
       Genie takes the player's whole attention for a minute at a time, so it
       gets the screen — and an auto-height sheet with no `ion-content` collapsed
       its own hit area, which left the answer buttons visible but unclickable. -->
  <ion-modal
    :is-open="isOpen"
    :initial-breakpoint="1"
    :breakpoints="[0, 1]"
    handle-behavior="cycle"
    class="genie-modal"
    @did-dismiss="onDismiss"
  >
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <!-- Abandoning a hunt is a normal thing to want, mid-question as much
             as at the end — a wrong answer three questions back is otherwise
             only escapable by closing the panel. Kept in the toolbar so it sits
             in one place across both states instead of crowding the answers. -->
        <ion-buttons slot="start">
          <ion-button
            v-if="canStartOver"
            fill="clear"
            size="small"
            class="genie-restart"
            @click="reset()"
          >
            <ion-icon aria-hidden="true" slot="start" :icon="refreshOutline" />
            {{ t("market.genie.newGuess") }}
          </ion-button>
        </ion-buttons>
        <!-- The `k` is struck rather than dropped, so the joke reads as a
             knock-off oracle. It is hidden from assistive tech, which would
             otherwise spell out a name nobody says out loud. -->
        <ion-title class="genie-title">
          <span class="genie-wordmark"
            >A<span aria-hidden="true">k</span>Inator</span
          >
        </ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="emit('close')">
            <ion-icon
              aria-hidden="true"
              :icon="closeOutline"
              slot="icon-only"
            />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding genie-content">
      <div class="genie">
        <!-- One figure for every state, above whatever the state needs. The
             asleep frame is the lamp on its own — the only one he is absent
             from, which is the point of it. -->
        <img
          class="genie-figure"
          :class="{ 'genie-figure--adrift': isBusy }"
          :src="POSE_ART[pose]"
          :alt="t('market.genie.imageAlt')"
        />

        <!-- Opening: the one and only free-text field in the session. -->
        <template v-if="status === 'idle'">
          <p class="genie-line">{{ t("market.genie.prompt") }}</p>
          <ion-item lines="none" class="genie-field">
            <ion-input
              :value="draft"
              :placeholder="t('market.genie.placeholder')"
              :maxlength="GENIE_MAX_QUERY_CHARS"
              :aria-label="t('market.genie.prompt')"
              @ion-input="draft = String($event.detail.value ?? '')"
              @keyup.enter="submit"
            />
          </ion-item>
          <ion-button
            expand="block"
            class="genie-action"
            :disabled="!draft.trim()"
            @click="submit"
          >
            {{ t("market.genie.ask") }}
          </ion-button>
        </template>

        <!-- Working. The wording never mentions how many are left. -->
        <template v-else-if="status === 'seeding' || status === 'thinking'">
          <div class="genie-busy">
            <ion-spinner name="dots" color="primary" />
            <span class="genie-line">{{
              status === "seeding"
                ? t("market.genie.seeking")
                : t("market.genie.thinking")
            }}</span>
          </div>
        </template>

        <!-- The question. Answers are taps, so the keyboard stays away. -->
        <template v-else-if="status === 'asking'">
          <p class="genie-utterance">{{ utterance }}</p>
          <div class="genie-options">
            <ion-button
              v-for="option in options"
              :key="option"
              expand="block"
              fill="outline"
              class="genie-action"
              @click="answer(option)"
            >
              {{ option }}
            </ion-button>
            <!-- Always offered, and never narrows anything: a question the
                 player cannot answer must not be the reason their article
                 disappears. -->
            <ion-button
              expand="block"
              fill="clear"
              color="medium"
              class="genie-action"
              @click="answerUnsure()"
            >
              {{ t("market.genie.unsure") }}
            </ion-button>
          </div>
        </template>

        <!-- The hunt is over. The Genie says so and stands aside on a tap,
             rather than the panel vanishing on its own — the rows appear in the
             table behind it, and a modal that closes itself gives no clue that
             is where to look. -->
        <template v-else-if="status === 'results'">
          <p class="genie-utterance">{{ t("market.genie.found") }}</p>
          <ion-button
            expand="block"
            class="genie-action"
            @click="emit('close')"
          >
            {{ t("market.genie.ok") }}
          </ion-button>
          <ion-button
            v-if="canExtend"
            expand="block"
            fill="clear"
            color="medium"
            class="genie-action"
            @click="keepGuessing()"
          >
            {{ t("market.genie.keepGuessing") }}
          </ion-button>
        </template>

        <!-- Asleep. The panel dismisses to the ordinary search bar; buying an
             article never depended on the Genie in the first place. -->
        <template v-else-if="status === 'asleep'">
          <span class="genie-line">{{ t("market.genie.asleep") }}</span>
        </template>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, onUnmounted, watch } from "vue";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import { closeOutline, refreshOutline } from "ionicons/icons";
import { useI18n } from "vue-i18n";
import { useGenie, type GeniePose } from "@/composables/useGenie";
import { GENIE_MAX_QUERY_CHARS } from "../../../dto/genieDTO";
import type { MarketArticle } from "@/types/market";
import asking from "@/assets/genie/asking.svg";
import asleep from "@/assets/genie/asleep.svg";
import celebrating from "@/assets/genie/celebrating.svg";
import defeated from "@/assets/genie/defeated.svg";
import greeting from "@/assets/genie/greeting.svg";
import reading from "@/assets/genie/reading.svg";
import sly from "@/assets/genie/sly.svg";
import stumped from "@/assets/genie/stumped.svg";
import surprised from "@/assets/genie/surprised.svg";
import thinking from "@/assets/genie/thinking.svg";

/**
 * Which pose is shown when is the composable's business — it has the history
 * the rotation is derived from. This only turns the name into a file.
 */
const POSE_ART: Record<GeniePose, string> = {
  asking,
  asleep,
  celebrating,
  defeated,
  greeting,
  reading,
  sly,
  stumped,
  surprised,
  thinking,
};

const { t } = useI18n();

/** Long enough to read the line, short enough not to feel like a dead end. */
const ASLEEP_DISMISS_MS = 2200;

const props = defineProps<{ isOpen: boolean }>();

const emit = defineEmits<{
  close: [];
  results: [articles: MarketArticle[]];
}>();

const {
  status,
  pose,
  utterance,
  options,
  results,
  canExtend,
  draft,
  start,
  answer,
  answerUnsure,
  keepGuessing,
  resumeOrReset,
  reset,
} = useGenie();

/**
 * Only offered once there is a hunt to abandon, and never mid-request: a reset
 * while a turn is in flight would be undone the moment that turn came back.
 */
const canStartOver = computed(
  () => status.value === "asking" || status.value === "results"
);

/** Drives the drift on the figure, so a wait never looks like a frozen frame. */
const isBusy = computed(
  () => status.value === "seeding" || status.value === "thinking"
);

function submit() {
  if (!draft.value.trim()) return;
  start(draft.value);
}

// Reopening picks the session back up where it was left, unless it has gone
// stale — so a mistaken tap on the backdrop costs nothing.
watch(
  () => props.isOpen,
  (open) => {
    if (open) resumeOrReset();
  },
  { immediate: true }
);

/**
 * The rows are the answer, so they go to the market table rather than being
 * listed again here — same price, ownership badge and buy flow as every other
 * row, which is the whole point of the Genie being additive.
 *
 * Handing them over on dismissal, not on arrival, is what makes the reveal
 * legible: the table changes as the panel gets out of the way, so the player
 * sees where to look. It runs on `did-dismiss` rather than on the OK button so
 * that dismissing by the backdrop cannot lose a hunt the player just finished.
 */
function onDismiss() {
  if (results.value.length > 0) {
    emit("results", results.value);
  }
  emit("close");
}

// Asleep is a brief popup, not a state to sit in: it says its line and hands
// the player back to the search bar.
//
// The timer is held and cancelled rather than left to fire: the session state
// is module-scoped, so a player who reopens and starts a fresh hunt inside the
// dismissal window would otherwise have the old timer close the panel out from
// under the new one.
let asleepTimer: number | undefined;

watch(status, (value) => {
  window.clearTimeout(asleepTimer);
  if (value === "asleep") {
    asleepTimer = window.setTimeout(() => emit("close"), ASLEEP_DISMISS_MS);
  }
});

onUnmounted(() => window.clearTimeout(asleepTimer));
</script>

<style scoped>
/* Nearly the whole screen: this is a task you give your attention to, and the
   market table behind it is not something you cross-reference mid-question. */
.genie-modal {
  --width: min(600px, 94vw);
  --height: min(760px, 90vh);
  --border-radius: 1rem;
}

@media (max-width: 767px) {
  .genie-modal {
    --width: 100%;
    --height: 100%;
    --border-radius: 1rem 1rem 0 0;
  }
}

.genie-title {
  font-size: 1rem;
}

.genie-wordmark {
  font-family: var(--font-family-headings);
  font-weight: 700;
}

.genie-wordmark span {
  text-decoration: line-through;
  text-decoration-thickness: 2px;
  text-decoration-color: var(--ion-color-danger);
}

.genie-content {
  --padding-bottom: calc(var(--ion-safe-area-bottom, 0px) + 1rem);
}

/* Centred vertically: for most of the session this holds one sentence and a
   few buttons, and pinning that to the top of a tall modal looks abandoned. */
/* Centred vertically, but `safe`: on a short screen the tallest state — a
   two-line question over four options and the "no idea" out — is taller than
   the modal, and plain `center` would push its top edge out of the scroll
   container's reach rather than letting it scroll. */
.genie {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: safe center;
  gap: 1rem;
}

/* Sized off the viewport, not the source box: the figure is the first thing
   that should give way when the question is long and the options are many,
   because the answer buttons are the only part the player has to reach. */
.genie-figure {
  align-self: center;
  height: clamp(88px, 24vh, 180px);
  width: auto;
  flex: none;
}

@keyframes genie-adrift {
  from {
    transform: translateY(3px);
  }
  to {
    transform: translateY(-5px);
  }
}

.genie-figure--adrift {
  animation: genie-adrift 2.4s ease-in-out infinite alternate;
}

@media (prefers-reduced-motion: reduce) {
  .genie-figure--adrift {
    animation: none;
  }
}

.genie-line {
  font-size: 1rem;
  margin: 0;
  color: var(--ion-color-medium);
  text-align: center;
}

.genie-utterance {
  font-size: 1.25rem;
  line-height: 1.4;
  margin: 0 0 0.5rem;
  text-align: center;
  color: var(--ion-text-color);
  font-family: var(--font-family-headings);
}

.genie-field {
  --min-height: 52px;
  --padding-start: 0.75rem;
  border: 1.5px solid var(--ion-color-primary);
  border-radius: 8px;
  font-size: 1rem;
}

.genie-action {
  margin: 0;
  --border-radius: 8px;
  text-transform: none;
  font-size: 1rem;
}

.genie-options {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.genie-busy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
</style>
