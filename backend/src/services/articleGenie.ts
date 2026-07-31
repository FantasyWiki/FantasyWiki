import {
  GENIE_ERRORS,
  GENIE_MAX_ANCHORS,
  GENIE_MAX_CANDIDATES,
  GENIE_MAX_HISTORY,
  GENIE_MAX_QUERY_CHARS,
  GENIE_UNSURE_ANSWER,
  GenieCandidateDTO,
  GenieQuestionKind,
  GenieSeedRequest,
  GenieSeedResponse,
  GenieTurnRequest,
  GenieTurnResponse,
  isGenieBucket,
  isGenieQuestionKind,
} from "../../../dto/genieDTO";
import { Result, failure, success } from "../repositories/result";
import { LlmClient, LlmMessage } from "./llmClient";

/**
 * Runs one turn of the Article Genie: the model is handed a bounded list of
 * *real* Wikipedia articles and asked to narrow it, never to name one.
 * Hallucinating a title is impossible by construction (ADR 0006), which leaves
 * misclassification as the failure mode this service defends against.
 *
 * The defences are here rather than in the prompt because a prompt is a request
 * and this is a guarantee:
 *
 * - ids outside the supplied list are discarded, not trusted;
 * - a *preference* question keeps everything, so it can only ever re-rank;
 * - an "unsure" answer keeps everything, so a question the player cannot answer
 *   never costs them the article;
 * - a turn that would empty the set restores it instead.
 */
export class ArticleGenieService {
  constructor(private readonly llm: LlmClient) {}

  /**
   * Reads the opening text into the searches that seed the candidate set.
   *
   * The keyword query is never omitted, even when anchors are found: both
   * searches run and are merged, so a misparse costs surplus candidates that
   * the narrowing loop already exists to strip, rather than silently deleting
   * the article the player wanted.
   *
   * Falls back to the raw query as keywords rather than failing — a query the
   * model could not parse is still a perfectly good search term.
   */
  async seed(request: GenieSeedRequest): Promise<Result<GenieSeedResponse>> {
    const query = request?.query?.trim() ?? "";
    if (query.length === 0) {
      return failure(GENIE_ERRORS.QUERY_REQUIRED);
    }
    if (query.length > GENIE_MAX_QUERY_CHARS) {
      return failure(GENIE_ERRORS.QUERY_TOO_LONG);
    }

    let raw: string;
    try {
      raw = await this.llm.ask([
        { role: "system", content: SEED_PROMPT },
        { role: "user", content: query },
      ]);
    } catch {
      return failure(GENIE_ERRORS.ASLEEP);
    }

    return success(parseSeed(raw, query));
  }

  async takeTurn(
    request: GenieTurnRequest,
  ): Promise<Result<GenieTurnResponse>> {
    const validation = validate(request);
    if (!validation.ok) {
      return validation;
    }

    const messages = buildMessages(request);

    // One retry, for the two things worth asking again about: a reply that was
    // not JSON, and a question the Genie has already asked. Both are usually
    // fixed by being told so. A quota or transport failure is not retried —
    // it would fail again identically and only spend the player's wait.
    let raw: string;
    try {
      raw = await this.llm.ask(messages);
    } catch {
      return failure(GENIE_ERRORS.ASLEEP);
    }

    let parsed = parseTurn(raw);
    const instruction = !parsed
      ? RETRY_INSTRUCTION
      : isRepeat(parsed, request)
        ? REPEAT_INSTRUCTION
        : null;

    if (instruction) {
      try {
        raw = await this.llm.ask([
          ...messages,
          { role: "assistant", content: raw },
          { role: "user", content: instruction },
        ]);
      } catch {
        return failure(GENIE_ERRORS.ASLEEP);
      }
      // Keep the retry only if it parsed; a second failure leaves the first
      // attempt, which for a repeat is still a usable turn.
      parsed = parseTurn(raw) ?? parsed;
    }

    if (!parsed) {
      return failure(GENIE_ERRORS.ASLEEP);
    }

    // Asked twice and still repeating itself: the model has run out of ways to
    // split this set, which is what `done` means. Better to show the player
    // what is left than to put the same question in front of them again.
    if (isRepeat(parsed, request)) {
      parsed = { ...parsed, done: true };
    }

    return success(sanitize(parsed, request));
  }
}

function validate(request: GenieTurnRequest): Result<true> {
  const query = request?.query?.trim() ?? "";
  if (query.length === 0) {
    return failure(GENIE_ERRORS.QUERY_REQUIRED);
  }
  if (query.length > GENIE_MAX_QUERY_CHARS) {
    return failure(GENIE_ERRORS.QUERY_TOO_LONG);
  }

  const candidates = request.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return failure(GENIE_ERRORS.NO_CANDIDATES);
  }
  if (candidates.length > GENIE_MAX_CANDIDATES) {
    return failure(GENIE_ERRORS.TOO_MANY_CANDIDATES);
  }

  // Duplicate ids would make `keep` ambiguous — two different articles would
  // survive or die together, and which one the player ended up with would
  // depend on array order.
  const ids = new Set(candidates.map((candidate) => candidate.id));
  if (ids.size !== candidates.length) {
    return failure(GENIE_ERRORS.DUPLICATE_CANDIDATE_ID);
  }

  if (!Array.isArray(request.history)) {
    return failure(GENIE_ERRORS.MALFORMED_BODY);
  }
  if (request.history.length > GENIE_MAX_HISTORY) {
    return failure(GENIE_ERRORS.HISTORY_TOO_LONG);
  }

  if (!isGenieBucket(request.bucket)) {
    return failure(GENIE_ERRORS.INVALID_BUCKET);
  }

  return success(true);
}

const SEED_PROMPT = `You turn a player's description of a Wikipedia article they are hunting for \
into search inputs. Reply with a single JSON object and nothing else:

{"keywords": "the search terms to look the article up by", "anchors": ["Wikipedia article titles \
the player named explicitly"]}

- "keywords" is never empty. Strip the filler ("find me", "the one that", "I'm looking for") and \
keep the describing words.
- "anchors" holds articles the player named as things to relate to, e.g. "find me a relation \
between OpenAI and Portugal" gives ["OpenAI", "Portugal"]. Use the article title as Wikipedia \
would spell it.
- When the player is describing an article rather than naming ones to connect, e.g. "the female \
mathematician who worked at NASA", anchors is empty. Do not guess the answer and do not put your \
guess in anchors.
- List every article the player named to relate, not just the first two.`;

/**
 * Reads the seed out of the model's reply, falling back to the player's own
 * words as keywords. There is no retry here: an unparseable reply still leaves a
 * usable keyword search, so a second call would spend a neuron and a wait to
 * improve a query that already works.
 */
export function parseSeed(raw: string, query: string): GenieSeedResponse {
  const source = extractJsonObject(raw);
  let record: Record<string, unknown> = {};

  if (source) {
    try {
      const value: unknown = JSON.parse(source);
      if (typeof value === "object" && value !== null) {
        record = value as Record<string, unknown>;
      }
    } catch {
      // Falls through to the raw query below.
    }
  }

  const keywords =
    typeof record.keywords === "string" && record.keywords.trim().length > 0
      ? record.keywords.trim()
      : query;

  const anchors = Array.isArray(record.anchors)
    ? record.anchors
        .filter(
          (anchor): anchor is string =>
            typeof anchor === "string" && anchor.trim().length > 0,
        )
        .map((anchor) => anchor.trim())
        .slice(0, GENIE_MAX_ANCHORS)
    : [];

  return { keywords, anchors };
}

const RETRY_INSTRUCTION =
  "That was not valid JSON. Reply with the JSON object only — no prose, no " +
  "code fences, no explanation.";

const REPEAT_INSTRUCTION =
  "You have already asked that. Ask a different question, about something you " +
  "have not covered yet, and word your reply differently. JSON object only.";

/**
 * Folds a question to a comparison key. Deliberately not aggressive — only case,
 * whitespace and trailing punctuation — so it stays correct in languages whose
 * questions this would otherwise strip to nothing.
 */
function questionKey(question: string): string {
  return question
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?!.]+$/, "");
}

/**
 * Has the Genie asked this before?
 *
 * Checked against the whole history rather than just the previous turn: asking
 * the same thing again is no better at turn six than at turn two, and it is
 * always a wasted question, since a set already split on that answer cannot
 * split on it twice.
 *
 * Only the question is compared, because only the question is in the history —
 * the flavour around it is display-only and never sent back. In practice that
 * is enough: a repeated question is what makes the sentence the player reads
 * repeat.
 */
function isRepeat(parsed: ParsedTurn, request: GenieTurnRequest): boolean {
  const asked = new Set(
    request.history.map((exchange) => questionKey(exchange.question)),
  );
  return asked.has(questionKey(parsed.question));
}

const SYSTEM_PROMPT = `You are the Article Genie in a fantasy game played over Wikipedia articles. \
A player is hunting for an article they cannot name, and you help by narrowing a list of REAL \
articles they give you.

Rules you must follow:
- Never invent, suggest or name an article that is not in the candidate list.
- Refer to candidates ONLY by their numeric id.
- Ask exactly ONE short question per turn, in character: warm, playful, a single sentence.
- NEVER ask something you have already asked, and never reuse the same wording twice in a row — \
vary the flavour every turn. If you cannot think of a genuinely new question, set done to true \
instead of repeating yourself.
- Judge candidates ONLY from their title and description. Many of these articles are newer than \
anything you know, so the description is your evidence — never rely on recognising a name.
- Never state, imply or hint at how many candidates are left. You are given a mood word for that; \
weave that word in instead of any number.

Two kinds of question, and the difference matters:
- "filter": splits the list, e.g. "Is it a person?". Only ask one when you can answer it for every \
candidate from its title and description.
- "preference": only reorders, e.g. "Something famous, or something obscure?". It never removes \
anything, so put EVERY id in keep when you ask one. Prefer these once the list is short.

Answer with a single JSON object and nothing else:
{"utterance": "one sentence of flavour plus your question", "keep": [ids that survive the player's \
LAST answer], "options": ["2-4 short tap answers to your question"], "kind": "filter" | \
"preference", "done": true when you cannot usefully narrow further}

On the very first turn there is no answer to apply yet: put every id in keep and just ask your \
opening question.`;

function buildMessages(request: GenieTurnRequest): LlmMessage[] {
  const listing = request.candidates
    .map((candidate) => formatCandidate(candidate))
    .join("\n");

  const history = request.history.length
    ? request.history
        .map((exchange, index) => {
          const answer =
            exchange.answer === GENIE_UNSURE_ANSWER
              ? "the player did not know"
              : exchange.answer;
          return `${index + 1}. You asked: ${exchange.question} — They answered: ${answer}`;
        })
        .join("\n")
    : "(nothing yet — this is your opening question)";

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `The player is looking for: ${request.query.trim()}`,
        "",
        "So far:",
        history,
        "",
        "Candidates still standing:",
        listing,
        "",
        `How many are left, as a mood: ${request.bucket}`,
      ].join("\n"),
    },
  ];
}

function formatCandidate(candidate: GenieCandidateDTO): string {
  const description = candidate.description?.trim();
  return description
    ? `${candidate.id}. ${candidate.title} — ${description}`
    : `${candidate.id}. ${candidate.title}`;
}

interface ParsedTurn {
  utterance: string;
  question: string;
  keep: number[];
  options: string[];
  kind: GenieQuestionKind;
  done: boolean;
}

/**
 * Pulls the turn out of the model's reply, tolerating the two things it does
 * even when told not to: wrapping the object in a code fence, and padding it
 * with a sentence of prose. Returns null when nothing usable is there, which is
 * what triggers the single retry.
 */
export function parseTurn(raw: string): ParsedTurn | null {
  const source = extractJsonObject(raw);
  if (!source) return null;

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;

  const utterance = record.utterance;
  if (typeof utterance !== "string" || utterance.trim().length === 0) {
    return null;
  }
  if (!Array.isArray(record.keep)) {
    return null;
  }

  const keep = record.keep.filter(
    (id): id is number => typeof id === "number" && Number.isInteger(id),
  );

  const options = Array.isArray(record.options)
    ? record.options.filter(
        (option): option is string =>
          typeof option === "string" && option.trim().length > 0,
      )
    : [];

  return {
    utterance: utterance.trim(),
    // Only the question is ever written back into history, so a model that
    // skips it falls back to the whole utterance rather than to nothing.
    question:
      typeof record.question === "string" && record.question.trim().length > 0
        ? record.question.trim()
        : utterance.trim(),
    keep,
    options,
    kind: isGenieQuestionKind(record.kind) ? record.kind : "filter",
    done: record.done === true,
  };
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return trimmed.slice(start, end + 1);
}

/** Answers that must not be allowed to narrow anything. */
function isNonCommittal(answer: string | undefined): boolean {
  return answer?.trim().toLowerCase() === GENIE_UNSURE_ANSWER;
}

/**
 * Turns what the model said into what the player gets. Everything the model
 * could get wrong is corrected against the request it was answering, so a bad
 * turn costs a wasted question rather than the article the player was after.
 */
function sanitize(
  parsed: ParsedTurn,
  request: GenieTurnRequest,
): GenieTurnResponse {
  const allIds = request.candidates.map((candidate) => candidate.id);
  const supplied = new Set(allIds);

  // Ids the model made up are dropped rather than trusted; a hallucinated id
  // has no article behind it and would surface as an empty row.
  let keep = [...new Set(parsed.keep)].filter((id) => supplied.has(id));

  const lastAnswer = request.history.at(-1)?.answer;

  if (parsed.kind === "preference" || isNonCommittal(lastAnswer)) {
    // Both promises are kept here, not in the prompt: a preference question
    // only re-ranks, and a question the player could not answer must never be
    // the reason their article disappeared.
    keep = allIds;
  }

  if (keep.length === 0) {
    // The model filtered the set out of existence. The previous turn's list is
    // exactly what it was sent, so restoring it costs one wasted question
    // instead of ending the session with nothing.
    keep = allIds;
  }

  return {
    utterance: parsed.utterance,
    question: parsed.question,
    keep,
    options: parsed.options.length > 0 ? parsed.options : DEFAULT_OPTIONS,
    kind: parsed.kind,
    done: parsed.done,
  };
}

/** A filter question the model forgot to give taps for is still yes/no. */
const DEFAULT_OPTIONS = ["Yes", "No"];
