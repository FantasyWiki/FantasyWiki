/**
 * The Article Genie's turn protocol — see
 * [ADR 0006](../docs/adr/0006-article-genie.md) for the decision and
 * [Article Genie LLM Integration](../docs/architecture/article-genie-llm.md)
 * for the mechanism.
 *
 * The session is stateless: the client carries the candidate set and the
 * history, and each request is a complete picture of the game so far. Resetting
 * that history is equivalent to starting a new game, which is already free, so
 * the abuse control is the rate limiter rather than the protocol.
 */

/**
 * A real Wikipedia article the Genie is choosing between. Ids are small
 * integers assigned by the client, and the model answers in ids rather than
 * titles: output tokens dominate session cost and the survivor list is returned
 * every turn, so ids (~2 tokens) instead of titles (~6) roughly halve it.
 */
export interface GenieCandidateDTO {
  id: number;
  title: string;
  /**
   * The one-line blurb from the search API. **Not optional in practice** — the
   * game trades on articles that postdate the model's training cutoff, and the
   * blurb is the only thing that lets it classify one. Measured on the live
   * top-read set, a single "is it a person?" turn keeps 100% of the people with
   * blurbs and only 84.6% without, silently losing the ones it has never heard
   * of. Typed optional solely because Wikipedia does not give every page one.
   */
  description?: string;
}

/**
 * A question the Genie asked and what the player tapped back. Only the question
 * is carried, never the flavour text wrapped around it — flavour is display-only
 * and must not re-enter the prompt on later turns.
 */
export interface GenieExchangeDTO {
  question: string;
  answer: string;
}

/**
 * The answer that must never cost the player the right article. A filter the
 * player cannot answer is the classic way an Akinator-style loop deletes its own
 * target, so this one is honoured by the backend rather than trusted to the
 * prompt: an unsure answer keeps the whole set.
 */
export const GENIE_UNSURE_ANSWER = "unsure";

/**
 * How big the surviving set is, as a word. The player must never see a raw
 * count — it reads as debug output and breaks character — so the client buckets
 * the number and passes only the bucket. The model therefore never sees a
 * figure and cannot contradict one.
 */
export const GENIE_BUCKETS = [
  "vast",
  "many",
  "a dozen or so",
  "a handful",
  "almost there",
] as const;

export type GenieBucket = (typeof GENIE_BUCKETS)[number];

export function isGenieBucket(value: unknown): value is GenieBucket {
  return GENIE_BUCKETS.includes(value as GenieBucket);
}

/**
 * Which of the two question kinds the model just asked. The distinction is a
 * safety boundary, not a label: a *filter* partitions the set and can therefore
 * drop the right article, while a *preference* only re-ranks and can never lose
 * anything. The backend enforces that rather than trusting the model to honour
 * it — see `ArticleGenieService`.
 */
export const GENIE_QUESTION_KINDS = ["filter", "preference"] as const;

export type GenieQuestionKind = (typeof GENIE_QUESTION_KINDS)[number];

export function isGenieQuestionKind(value: unknown): value is GenieQuestionKind {
  return GENIE_QUESTION_KINDS.includes(value as GenieQuestionKind);
}

/**
 * Reading the player's opening text into the searches that seed the candidate
 * set. This is a separate call from a turn because of an ordering constraint the
 * turn protocol cannot satisfy on its own: a turn is defined over a candidate
 * list, and there is no candidate list until the query has been read. Folding it
 * into the first turn would mean seeding on keywords alone, which for *"find me
 * a relation between OpenAI and Portugal"* returns articles *about* OpenAI and
 * lets the Genie open with a question about the wrong set entirely.
 *
 * It stays within what ADR 0006 asks of the Worker — one model call, one
 * subrequest, no D1, no migration.
 */
export interface GenieSeedRequest {
  query: string;
}

export interface GenieSeedResponse {
  /**
   * A plain keyword search, always present. Both this and the anchor search run
   * and their results are merged: with no routing decision to get wrong, a
   * misread query can only add surplus candidates, never drop the right one.
   */
  keywords: string;
  /**
   * Article titles the query names, when it names any. Empty for a
   * tip-of-the-tongue query.
   */
  anchors: string[];
}

/**
 * A cost guard, not a structural limit. Nothing downstream is written for
 * pairs: the anchor search conjoins `linksto:` terms and the outbound
 * intersection folds over however many anchors there are, and a candidate is
 * ranked by how many of them it links mutually with. Three anchors work; they
 * just cost one paginated link fetch each and return almost nothing, because
 * the intersection collapses fast — ADR 0006 measured that even *two* unrelated
 * anchors yield no candidate with mutual links to both.
 *
 * The cap exists so a pathological query cannot fan out without bound. It is
 * safe to raise, and safe to hit: the keyword search runs alongside the anchor
 * search regardless, so dropping a fourth anchor narrows the seed rather than
 * emptying it.
 */
export const GENIE_MAX_ANCHORS = 3;

export interface GenieTurnRequest {
  /** The player's opening free text. The only free-text field in the session. */
  query: string;
  /** Prior exchanges, oldest first. Empty on the opening turn. */
  history: GenieExchangeDTO[];
  /** The candidates still standing. Ids must be unique within the request. */
  candidates: GenieCandidateDTO[];
  bucket: GenieBucket;
}

export interface GenieTurnResponse {
  /** One sentence: flavour plus the next question, in the Genie's voice. */
  utterance: string;
  /**
   * The same question stripped of its flavour — this, and never `utterance`, is
   * what goes into `history`.
   *
   * Flavour is display-only. Writing it back would re-feed the model its own
   * narration on every later turn, growing the prompt with text that carries no
   * information about the article and inviting it to answer the flavour rather
   * than the question. Falls back to `utterance` when the model omits it, since
   * a slightly noisy history beats an empty one.
   */
  question: string;
  /** Ids that survive the answer just given. Always a subset of what was sent. */
  keep: number[];
  /** The taps offered for `utterance`. The client adds its own "not sure". */
  options: string[];
  kind: GenieQuestionKind;
  /** The model judges it has narrowed things as far as it usefully can. */
  done: boolean;
}

/**
 * Caps. Oversized payloads are **rejected, not truncated**: silently trimming
 * hides a client bug and makes the model's answer depend on state nobody can
 * see.
 */
export const GENIE_MAX_QUERY_CHARS = 200;
/**
 * Also the design cap on the seeded candidate set. The search API puts the
 * intended article in roughly the top three, so 40 reliably contains it while
 * keeping per-turn cost and the model's attention load low.
 */
export const GENIE_MAX_CANDIDATES = 40;
/** The soft cap of 10 turns plus the one optional "+5" extension. */
export const GENIE_MAX_HISTORY = 15;

/**
 * Caps on the free text the client carries, because the count caps above bound
 * how *many* strings arrive and not how long they are. Without these, forty
 * candidates and fifteen exchanges are a megabyte-scale prompt, and Workers AI
 * neurons are an **account-wide** daily allocation: one player could put the
 * Genie to sleep for everyone, at the rate limiter's 20 requests a minute.
 *
 * Sized so a real session can never hit them. Titles and blurbs come from the
 * search API — Wikipedia titles are capped at 255 bytes and a blurb is one line.
 * The history is the model's own words fed back, and `max_tokens` is 512, so no
 * reply it is capable of generating can exceed these.
 */
export const GENIE_MAX_TITLE_CHARS = 300;
export const GENIE_MAX_DESCRIPTION_CHARS = 1000;
export const GENIE_MAX_QUESTION_CHARS = 2000;
export const GENIE_MAX_ANSWER_CHARS = 500;

/** Survivors at or below this are worth showing rather than narrowing further. */
export const GENIE_RESULT_THRESHOLD = 5;

export const GENIE_ERRORS = {
  MALFORMED_BODY: "GENIE_MALFORMED_BODY",
  QUERY_REQUIRED: "GENIE_QUERY_REQUIRED",
  QUERY_TOO_LONG: "GENIE_QUERY_TOO_LONG",
  TOO_MANY_CANDIDATES: "GENIE_TOO_MANY_CANDIDATES",
  NO_CANDIDATES: "GENIE_NO_CANDIDATES",
  HISTORY_TOO_LONG: "GENIE_HISTORY_TOO_LONG",
  /** A candidate or an exchange carried more text than a real one ever could. */
  TEXT_TOO_LONG: "GENIE_TEXT_TOO_LONG",
  INVALID_BUCKET: "GENIE_INVALID_BUCKET",
  DUPLICATE_CANDIDATE_ID: "GENIE_DUPLICATE_CANDIDATE_ID",
  RATE_LIMITED: "GENIE_RATE_LIMITED",
  /**
   * The single player-facing failure. Quota exhaustion, transport trouble and an
   * unparseable response after a retry all land here, because they all mean the
   * same thing to the player: the genie is asleep, use the search bar.
   */
  ASLEEP: "GENIE_ASLEEP",
} as const;
