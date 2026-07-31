import { computed, ref } from "vue";
import { api } from "@/services/api";
import {
  hydrateCandidates,
  seedCandidates,
  type GenieCandidate,
} from "@/services/genieService";
import { useLeagueStore } from "@/stores/league";
import type { MarketArticle } from "@/types/market";
import {
  GENIE_MAX_QUERY_CHARS,
  GENIE_RESULT_THRESHOLD,
  GENIE_UNSURE_ANSWER,
  type GenieBucket,
  type GenieExchangeDTO,
} from "../../../dto/genieDTO";

/** Soft cap on questions, and the one extension the player can ask for. */
const SOFT_TURN_CAP = 10;
const TURN_EXTENSION = 5;

/**
 * How long a dismissed session stays warm. Long enough that a mistaken tap on
 * the backdrop, or a look at the table behind, costs the player nothing; short
 * enough that coming back much later starts a hunt for whatever they want *now*.
 */
const SESSION_TTL_MS = 10 * 60 * 1000;

export type GenieStatus =
  "idle" | "seeding" | "asking" | "thinking" | "results" | "asleep";

/**
 * The faces the Genie wears while questioning, cycled so no two consecutive
 * questions are delivered by the same drawing.
 *
 * `thinking` is deliberately not among them: it flashes between every pair of
 * questions, so reusing it here would put the same pose on screen either side
 * of the transition — the back-to-back repetition the utterances already avoid.
 */
const QUESTION_POSES = [
  "asking",
  "sly",
  "reading",
  "surprised",
  "stumped",
  "defeated",
] as const;

type GenieQuestionPose = (typeof QUESTION_POSES)[number];

export type GeniePose =
  GenieQuestionPose | "greeting" | "thinking" | "celebrating" | "asleep";

function shuffled(poses: readonly GenieQuestionPose[]): GenieQuestionPose[] {
  const out = [...poses];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The order the question poses come out in, drawn fresh for each hunt so the
 * third question is not forever asked by the same face.
 *
 * Built as whole shuffled passes rather than an independent draw per question:
 * an independent draw can spend a long hunt alternating between two poses, and
 * the point of the set is that the player sees it. Every pose appears once per
 * pass, in an order that changes.
 *
 * A pass opening on the pose the previous one closed with is rotated by one
 * rather than reshuffled — the poses within a pass are all distinct, so moving
 * the head to the tail fixes the join in a single step, where reshuffling could
 * in principle keep colliding.
 *
 * Long enough to outrun the cap and its extension, so the run never wraps onto
 * its own start.
 */
function buildPoseCycle(): GenieQuestionPose[] {
  const cycle: GenieQuestionPose[] = [];
  while (cycle.length <= SOFT_TURN_CAP + TURN_EXTENSION) {
    const pass = shuffled(QUESTION_POSES);
    if (pass[0] === cycle[cycle.length - 1]) {
      cycle.push(...pass.slice(1), pass[0]);
    } else {
      cycle.push(...pass);
    }
  }
  return cycle;
}

/**
 * Session state lives at module scope, not inside the composable, so it
 * outlives the panel being closed. Dismissing the modal unmounts the component
 * — with the state inside it, a stray tap on the backdrop would throw away an
 * interrogation the player was ten questions into.
 *
 * There is exactly one Genie on screen at a time, so a single shared session is
 * the whole truth rather than a cache of one.
 */
const status = ref<GenieStatus>("idle");
const utterance = ref("");
const options = ref<string[]>([]);
const results = ref<MarketArticle[]>([]);
const candidates = ref<GenieCandidate[]>([]);
const history = ref<GenieExchangeDTO[]>([]);
const query = ref("");
const turnCap = ref(SOFT_TURN_CAP);
const draft = ref("");
/** The current question, kept apart from the flavour wrapped around it. */
const pendingQuestion = ref("");
/** When the session last did anything, for `resumeOrReset`. */
const lastTouchedAt = ref(0);
/** This hunt's running order of question poses, redrawn by `reset`. */
const poseCycle = ref<GenieQuestionPose[]>(buildPoseCycle());

/**
 * Maps a candidate count to the word the player hears. The count itself never
 * leaves this function: shown as a number it reads as debug output and breaks
 * character, and a Genie that says "31 articles left" is not a Genie.
 */
export function bucketFor(count: number): GenieBucket {
  if (count > 30) return "vast";
  if (count > 15) return "many";
  if (count > 8) return "a dozen or so";
  if (count > GENIE_RESULT_THRESHOLD) return "a handful";
  return "almost there";
}

export function useGenie() {
  const leagueStore = useLeagueStore();

  const askedCount = computed(() => history.value.length);

  /**
   * The extension is offered only when stopping now would be the cap's doing
   * rather than the Genie's — if it already has few enough candidates to show,
   * more questions buy nothing.
   */
  const canExtend = computed(
    () =>
      status.value === "results" &&
      turnCap.value === SOFT_TURN_CAP &&
      askedCount.value >= SOFT_TURN_CAP &&
      candidates.value.length > GENIE_RESULT_THRESHOLD
  );

  /**
   * Which drawing is on screen. Derived from the history rather than kept in a
   * counter of its own: the panel unmounts when it is dismissed, so a counter
   * would restart at the first pose whenever the player tapped the backdrop and
   * came back mid-interview. Deriving it also means `reset` and `keepGuessing`
   * need no upkeep to stay correct.
   *
   * Finishing always looks the same — the Genie has one way of being pleased
   * with itself, and a fixed pose is what makes the end of the hunt legible.
   */
  const pose = computed<GeniePose>(() => {
    switch (status.value) {
      case "results":
        return "celebrating";
      case "asleep":
        return "asleep";
      case "seeding":
      case "thinking":
        return "thinking";
      case "asking":
        // Clamped rather than wrapped: the cycle is built past the turn cap, so
        // this only guards a cap raised without the cycle following it.
        return poseCycle.value[
          Math.min(history.value.length, poseCycle.value.length - 1)
        ];
      default:
        return "greeting";
    }
  });

  function reset() {
    status.value = "idle";
    utterance.value = "";
    options.value = [];
    results.value = [];
    candidates.value = [];
    history.value = [];
    query.value = "";
    turnCap.value = SOFT_TURN_CAP;
    pendingQuestion.value = "";
    draft.value = "";
    lastTouchedAt.value = 0;
    // A fresh hunt gets a fresh running order, so the same round is not always
    // asked by the same face.
    poseCycle.value = buildPoseCycle();
  }

  /** Marks the session as alive, so it survives the next dismissal. */
  function touch() {
    lastTouchedAt.value = Date.now();
  }

  /**
   * Called when the panel opens. Picks a warm session back up exactly where it
   * was — same question, same survivors — so a stray tap on the backdrop costs
   * nothing.
   *
   * Only a session the player can still act on is worth resuming: one that is
   * mid-question, in flight, or holding an unspent "+5". Resuming a finished or
   * asleep one would reopen onto a screen with nothing to do, which is worse
   * than starting over.
   */
  function resumeOrReset() {
    const isLive =
      status.value === "asking" ||
      status.value === "seeding" ||
      status.value === "thinking" ||
      (status.value === "results" && canExtend.value);

    if (!isLive || Date.now() - lastTouchedAt.value > SESSION_TTL_MS) {
      reset();
    }
  }

  /**
   * Every failure lands in the same place. Quota exhaustion, a transport
   * problem and an unparseable model reply mean one thing to the player: the
   * genie is asleep, and the ordinary search bar is right there. The feature is
   * additive, so nothing about buying an article depends on it.
   */
  function fallAsleep() {
    status.value = "asleep";
    options.value = [];
  }

  async function start(rawQuery: string) {
    const domain = leagueStore.currentLeague?.domain;
    const trimmed = rawQuery.trim().slice(0, GENIE_MAX_QUERY_CHARS);
    if (!domain || !trimmed) return;

    reset();
    query.value = trimmed;
    draft.value = trimmed;
    status.value = "seeding";
    touch();

    try {
      const seed = await api.genie.seed(trimmed);
      const seeded = await seedCandidates(domain, seed);

      if (seeded.length === 0) {
        // Nothing to narrow is not a model failure, but it reaches the player
        // the same way: there is no session to run.
        fallAsleep();
        return;
      }

      candidates.value = seeded;
      await ask();
    } catch {
      fallAsleep();
    }
  }

  /** Sends the current set and history, and takes back the next question. */
  async function ask() {
    status.value = "thinking";
    touch();

    try {
      const response = await api.genie.takeTurn({
        query: query.value,
        history: history.value,
        candidates: candidates.value.map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          description: candidate.description,
        })),
        bucket: bucketFor(candidates.value.length),
      });

      const surviving = new Set(response.keep);
      const kept = candidates.value.filter((candidate) =>
        surviving.has(candidate.id)
      );
      // The backend already refuses to empty the set, so this only guards
      // against a response that somehow kept nothing recognisable.
      candidates.value = kept.length > 0 ? kept : candidates.value;

      utterance.value = response.utterance;
      options.value = response.options;
      // The bare question, never the flavour wrapped around it: flavour is
      // display-only, and feeding it back would grow the prompt every turn with
      // narration that says nothing about the article.
      pendingQuestion.value = response.question || response.utterance;

      const exhausted = history.value.length >= turnCap.value;
      if (
        response.done ||
        candidates.value.length <= GENIE_RESULT_THRESHOLD ||
        exhausted
      ) {
        await finish();
        return;
      }

      status.value = "asking";
      touch();
    } catch {
      fallAsleep();
    }
  }

  /**
   * Records the tap and takes another turn. Only the question is written into
   * the history — never the flavour around it, which is display-only and would
   * otherwise re-enter the prompt on every later turn.
   */
  async function answer(option: string) {
    if (status.value !== "asking") return;

    history.value = [
      ...history.value,
      { question: pendingQuestion.value, answer: option },
    ];
    await ask();
  }

  /** The tap that must never cost the player their article. */
  async function answerUnsure() {
    await answer(GENIE_UNSURE_ANSWER);
  }

  /** Grants the one "+5" extension and puts the Genie back to work. */
  async function keepGuessing() {
    if (!canExtend.value) return;
    turnCap.value = SOFT_TURN_CAP + TURN_EXTENSION;
    await ask();
  }

  /** Prices what is left and hands it to the market table. */
  async function finish() {
    const domain = leagueStore.currentLeague?.domain;
    if (!domain) {
      fallAsleep();
      return;
    }

    status.value = "thinking";
    try {
      results.value = await hydrateCandidates(
        domain,
        candidates.value.slice(0, GENIE_RESULT_THRESHOLD)
      );
      status.value = "results";
      touch();
    } catch {
      fallAsleep();
    }
  }

  return {
    status,
    pose,
    utterance,
    options,
    results,
    canExtend,
    draft,
    bucket: computed(() => bucketFor(candidates.value.length)),
    start,
    resumeOrReset,
    answer,
    answerUnsure,
    keepGuessing,
    reset,
  };
}
