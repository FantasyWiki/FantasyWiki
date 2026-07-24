import { describe, it, expect } from "vitest";
import {
  GENIE_ERRORS,
  GENIE_MAX_ANCHORS,
  GENIE_MAX_ANSWER_CHARS,
  GENIE_MAX_CANDIDATES,
  GENIE_MAX_DESCRIPTION_CHARS,
  GENIE_MAX_HISTORY,
  GENIE_MAX_QUERY_CHARS,
  GENIE_MAX_TITLE_CHARS,
  GENIE_UNSURE_ANSWER,
  GenieTurnRequest,
} from "../../../dto/genieDTO";
import { ArticleGenieService } from "../services/articleGenie";
import { LlmClient, LlmMessage } from "../services/llmClient";

/**
 * The model is substituted through the constructor, never through `vi.mock`:
 * under `@cloudflare/vitest-pool-workers` a mocked module silently resolves to
 * the real one, so a test written that way would spend real neurons against the
 * live binding and assert on whatever the model happened to say.
 */
function stubLlm(...replies: string[]): LlmClient & { calls: LlmMessage[][] } {
  const calls: LlmMessage[][] = [];
  let index = 0;
  return {
    calls,
    async ask(messages: LlmMessage[]) {
      calls.push(messages);
      const reply = replies[Math.min(index, replies.length - 1)];
      index += 1;
      return reply;
    },
  };
}

function failingLlm(): LlmClient {
  return {
    async ask() {
      throw new Error("Workers AI: out of neurons");
    },
  };
}

function turn(overrides: Partial<GenieTurnRequest> = {}): GenieTurnRequest {
  return {
    query: "the female mathematician who worked at NASA",
    history: [],
    candidates: [
      {
        id: 1,
        title: "Katherine Johnson",
        description: "American mathematician",
      },
      { id: 2, title: "Apollo 11", description: "1969 crewed spaceflight" },
      {
        id: 3,
        title: "Dorothy Vaughan",
        description: "American mathematician",
      },
    ],
    bucket: "a handful",
    ...overrides,
  };
}

/**
 * One exchange already behind us, so a turn is narrowing on an answer the
 * player actually gave. The opening turn is a different case with a guarantee
 * of its own — nothing has been answered, so nothing may be filtered out — and
 * a test that means to exercise narrowing has to be past it.
 *
 * Worded unlike anything the replies below ask, so it does not trip the
 * repeated-question retry on its way through.
 */
const ANSWERED = [{ question: "Is it from this century?", answer: "Yes" }];

const GOOD_REPLY = JSON.stringify({
  utterance: "A fine hunt — is it a person?",
  keep: [1, 3],
  options: ["Yes", "No"],
  kind: "filter",
  done: false,
});

describe("ArticleGenieService.seed", () => {
  it("reads anchors out of a chemistry query", async () => {
    const result = await new ArticleGenieService(
      stubLlm(
        JSON.stringify({
          keywords: "relation OpenAI Portugal",
          anchors: ["OpenAI", "Portugal"],
        }),
      ),
    ).seed({ query: "find me a relation between OpenAI and Portugal" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      keywords: "relation OpenAI Portugal",
      anchors: ["OpenAI", "Portugal"],
    });
  });

  it("leaves anchors empty for a tip-of-the-tongue query", async () => {
    const result = await new ArticleGenieService(
      stubLlm(
        JSON.stringify({
          keywords: "female mathematician NASA",
          anchors: [],
        }),
      ),
    ).seed({ query: "the female mathematician who worked at NASA" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.anchors).toEqual([]);
  });

  it("carries more than two anchors — the pipeline is not written for pairs", async () => {
    const result = await new ArticleGenieService(
      stubLlm(
        JSON.stringify({
          keywords: "Italy France Spain",
          anchors: ["Italy", "France", "Spain"],
        }),
      ),
    ).seed({ query: "something linking Italy, France and Spain" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.anchors).toEqual(["Italy", "France", "Spain"]);
  });

  it("caps a runaway anchor list rather than fanning out without bound", async () => {
    const result = await new ArticleGenieService(
      stubLlm(
        JSON.stringify({
          keywords: "everything",
          anchors: ["A", "B", "C", "D", "E"],
        }),
      ),
    ).seed({ query: "link A and B and C and D and E" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.anchors).toHaveLength(GENIE_MAX_ANCHORS);
    // Dropping the tail narrows the seed rather than emptying it: the keyword
    // search runs alongside the anchor search regardless.
    expect(result.value.keywords).toBe("everything");
  });

  it("falls back to the player's own words when the reply is unusable", async () => {
    const result = await new ArticleGenieService(
      stubLlm("I'd guess Katherine Johnson"),
    ).seed({ query: "the female mathematician who worked at NASA" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // An unparseable reply still leaves a perfectly good search term, so there
    // is nothing worth spending a retry on.
    expect(result.value).toEqual({
      keywords: "the female mathematician who worked at NASA",
      anchors: [],
    });
  });

  it("rejects an oversized query and falls asleep when the model throws", async () => {
    const service = new ArticleGenieService(failingLlm());

    expect(
      await service.seed({ query: "x".repeat(GENIE_MAX_QUERY_CHARS + 1) }),
    ).toEqual({ ok: false, error: GENIE_ERRORS.QUERY_TOO_LONG });

    expect(await service.seed({ query: "anything" })).toEqual({
      ok: false,
      error: GENIE_ERRORS.ASLEEP,
    });
  });
});

describe("ArticleGenieService", () => {
  describe("validation", () => {
    it("rejects an empty query without calling the model", async () => {
      const llm = stubLlm(GOOD_REPLY);
      const result = await new ArticleGenieService(llm).takeTurn(
        turn({ query: "   " }),
      );

      expect(result).toEqual({
        ok: false,
        error: GENIE_ERRORS.QUERY_REQUIRED,
      });
      expect(llm.calls).toHaveLength(0);
    });

    it("rejects an oversized query rather than truncating it", async () => {
      const llm = stubLlm(GOOD_REPLY);
      const result = await new ArticleGenieService(llm).takeTurn(
        turn({ query: "x".repeat(GENIE_MAX_QUERY_CHARS + 1) }),
      );

      expect(result).toEqual({
        ok: false,
        error: GENIE_ERRORS.QUERY_TOO_LONG,
      });
      // Truncating would hide a client bug and make the answer depend on state
      // nobody can see, so nothing reaches the model at all.
      expect(llm.calls).toHaveLength(0);
    });

    it("rejects an oversized candidate list", async () => {
      const candidates = Array.from(
        { length: GENIE_MAX_CANDIDATES + 1 },
        (_, index) => ({ id: index, title: `Article ${index}` }),
      );

      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(turn({ candidates }));

      expect(result).toEqual({
        ok: false,
        error: GENIE_ERRORS.TOO_MANY_CANDIDATES,
      });
    });

    it("rejects an empty candidate list", async () => {
      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(turn({ candidates: [] }));

      expect(result).toEqual({
        ok: false,
        error: GENIE_ERRORS.NO_CANDIDATES,
      });
    });

    it("rejects duplicate candidate ids, which would make `keep` ambiguous", async () => {
      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(
        turn({
          candidates: [
            { id: 1, title: "Katherine Johnson" },
            { id: 1, title: "Dorothy Vaughan" },
          ],
        }),
      );

      expect(result).toEqual({
        ok: false,
        error: GENIE_ERRORS.DUPLICATE_CANDIDATE_ID,
      });
    });

    it("rejects a history past the soft cap plus its extension", async () => {
      const history = Array.from(
        { length: GENIE_MAX_HISTORY + 1 },
        (_, index) => ({ question: `q${index}`, answer: "Yes" }),
      );

      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(turn({ history }));

      expect(result).toEqual({
        ok: false,
        error: GENIE_ERRORS.HISTORY_TOO_LONG,
      });
    });

    it("rejects a blurb longer than any real one, without calling the model", async () => {
      const llm = stubLlm(GOOD_REPLY);
      const result = await new ArticleGenieService(llm).takeTurn(
        turn({
          candidates: [
            {
              id: 1,
              title: "Katherine Johnson",
              description: "x".repeat(GENIE_MAX_DESCRIPTION_CHARS + 1),
            },
          ],
        }),
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      // The count caps bound how many strings arrive, never how long they are.
      // Forty megabyte blurbs is a megabyte-scale prompt billed against an
      // account-wide neuron allocation — one player putting the Genie to sleep
      // for everybody.
      expect(result.error).toBe(GENIE_ERRORS.TEXT_TOO_LONG);
      expect(llm.calls).toHaveLength(0);
    });

    it("rejects a title longer than Wikipedia can even have", async () => {
      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(
        turn({
          candidates: [{ id: 1, title: "x".repeat(GENIE_MAX_TITLE_CHARS + 1) }],
        }),
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe(GENIE_ERRORS.TEXT_TOO_LONG);
    });

    it("rejects an exchange carrying more text than the model can generate", async () => {
      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(
        turn({
          history: [
            {
              question: "Is it a person?",
              answer: "y".repeat(GENIE_MAX_ANSWER_CHARS + 1),
            },
          ],
        }),
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe(GENIE_ERRORS.TEXT_TOO_LONG);
    });

    it("rejects a candidate whose fields are the wrong type", async () => {
      const llm = stubLlm(GOOD_REPLY);
      const result = await new ArticleGenieService(llm).takeTurn(
        turn({
          // A numeric blurb reaches `.trim()` while the prompt is built, which
          // is outside every try/catch on the path — so without this check the
          // route answers 500 to a body it should be calling a 400.
          candidates: [
            { id: 1, title: "Katherine Johnson", description: 7 },
          ] as unknown as GenieTurnRequest["candidates"],
        }),
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe(GENIE_ERRORS.MALFORMED_BODY);
      expect(llm.calls).toHaveLength(0);
    });

    it("rejects an exchange whose fields are the wrong type", async () => {
      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(
        turn({
          // Reaches `.trim()` in the repeat check, equally uncaught.
          history: [
            { question: null, answer: "Yes" },
          ] as unknown as GenieTurnRequest["history"],
        }),
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe(GENIE_ERRORS.MALFORMED_BODY);
    });

    it("rejects a query that is not a string", async () => {
      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(turn({ query: 42 as unknown as string }));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe(GENIE_ERRORS.QUERY_REQUIRED);
    });

    it("rejects a bucket that is not one of the agreed words", async () => {
      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(turn({ bucket: "31 articles" as GenieTurnRequest["bucket"] }));

      expect(result).toEqual({
        ok: false,
        error: GENIE_ERRORS.INVALID_BUCKET,
      });
    });
  });

  describe("the prompt", () => {
    it("carries each candidate's description, which is what makes recency work", async () => {
      const llm = stubLlm(GOOD_REPLY);
      await new ArticleGenieService(llm).takeTurn(turn());

      const prompt = llm.calls[0].map((m) => m.content).join("\n");
      // Titles alone lose ~15% of the people the model has never heard of
      // (ADR 0006), and the game trades on articles newer than its cutoff.
      expect(prompt).toContain("Katherine Johnson — American mathematician");
    });

    it("passes the bucket word and never a count", async () => {
      const llm = stubLlm(GOOD_REPLY);
      await new ArticleGenieService(llm).takeTurn(turn());

      const prompt = llm.calls[0].map((m) => m.content).join("\n");
      expect(prompt).toContain("a handful");
      expect(prompt).not.toMatch(/\b3 candidates\b/);
    });
  });

  describe("a well-formed turn", () => {
    it("returns the model's utterance and the surviving ids", async () => {
      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(turn({ history: ANSWERED }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual({
        utterance: "A fine hunt — is it a person?",
        // GOOD_REPLY carries no bare question, so it falls back to the whole
        // utterance rather than leaving history empty.
        question: "A fine hunt — is it a person?",
        keep: [1, 3],
        options: ["Yes", "No"],
        kind: "filter",
        done: false,
      });
    });

    it("reads the object out of a fenced or padded reply", async () => {
      const result = await new ArticleGenieService(
        stubLlm("Here you go!\n```json\n" + GOOD_REPLY + "\n```"),
      ).takeTurn(turn({ history: ANSWERED }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.keep).toEqual([1, 3]);
    });
  });

  describe("what the model gets wrong", () => {
    it("keeps everything on the opening turn, which answers nothing", async () => {
      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(turn({ history: [] }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // GOOD_REPLY narrows to [1, 3]. On turn one there is no answer to narrow
      // on, so that is the model picking for the player before they have said a
      // word — and with a full 40-candidate seed it can land straight on the
      // result threshold and end the hunt without a question ever being
      // answered. The prompt asks for every id here; this is what enforces it.
      expect(result.value.keep).toEqual([1, 2, 3]);
    });

    it("discards ids that were never in the candidate list", async () => {
      const result = await new ArticleGenieService(
        stubLlm(
          JSON.stringify({
            utterance: "Is it a person?",
            keep: [1, 99, 3],
            options: ["Yes", "No"],
            kind: "filter",
            done: false,
          }),
        ),
      ).takeTurn(turn({ history: ANSWERED }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // 99 has no article behind it and would render as an empty row.
      expect(result.value.keep).toEqual([1, 3]);
    });

    it("keeps everything when the question was a preference", async () => {
      const result = await new ArticleGenieService(
        stubLlm(
          JSON.stringify({
            utterance: "Something famous, or something obscure?",
            keep: [1],
            options: ["Famous", "Obscure"],
            kind: "preference",
            done: false,
          }),
        ),
      ).takeTurn(turn({ history: ANSWERED }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // A preference only re-ranks. Honoured here rather than in the prompt,
      // because it is a guarantee and a prompt is only a request.
      expect(result.value.keep).toEqual([1, 2, 3]);
    });

    it("keeps everything when the player answered that they did not know", async () => {
      const result = await new ArticleGenieService(
        stubLlm(
          JSON.stringify({
            utterance: "Is it a person?",
            keep: [1],
            options: ["Yes", "No"],
            kind: "filter",
            done: false,
          }),
        ),
      ).takeTurn(
        turn({
          history: [
            { question: "Is it a person?", answer: GENIE_UNSURE_ANSWER },
          ],
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // A question the player could not answer must never be the reason their
      // article vanished.
      expect(result.value.keep).toEqual([1, 2, 3]);
    });

    it("restores the set when a turn would empty it", async () => {
      const result = await new ArticleGenieService(
        stubLlm(
          JSON.stringify({
            utterance: "Is it a person?",
            keep: [],
            options: ["Yes", "No"],
            kind: "filter",
            done: false,
          }),
        ),
      ).takeTurn(turn({ history: ANSWERED }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Costs one wasted question instead of ending the session with nothing.
      expect(result.value.keep).toEqual([1, 2, 3]);
    });

    it("returns the bare question apart from the flavour around it", async () => {
      const result = await new ArticleGenieService(
        stubLlm(
          JSON.stringify({
            utterance: "Mhh, a fine hunt — is it a person?",
            question: "Is it a person?",
            keep: [1, 3],
            options: ["Yes", "No"],
            kind: "filter",
            done: false,
          }),
        ),
      ).takeTurn(turn());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Only this goes into history. Feeding the flavour back would grow the
      // prompt every turn with narration that says nothing about the article.
      expect(result.value.question).toBe("Is it a person?");
      expect(result.value.utterance).toBe("Mhh, a fine hunt — is it a person?");
    });

    it("falls back to the whole utterance when the bare question is missing", async () => {
      const result = await new ArticleGenieService(
        stubLlm(GOOD_REPLY),
      ).takeTurn(turn());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // A slightly noisy history beats an empty one.
      expect(result.value.question).toBe("A fine hunt — is it a person?");
    });

    it("asks again when the model repeats a question it already asked", async () => {
      const repeated = JSON.stringify({
        utterance: "Mhh — is it a person?",
        question: "Is it a person?",
        keep: [1, 3],
        options: ["Yes", "No"],
        kind: "filter",
        done: false,
      });
      const fresh = JSON.stringify({
        utterance: "Then tell me — was she a scientist?",
        question: "Was she a scientist?",
        keep: [1],
        options: ["Yes", "No"],
        kind: "filter",
        done: false,
      });

      const llm = stubLlm(repeated, fresh);
      const result = await new ArticleGenieService(llm).takeTurn(
        turn({
          history: [{ question: "Is it a person?", answer: "Yes" }],
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.question).toBe("Was she a scientist?");
      expect(result.value.utterance).toBe(
        "Then tell me — was she a scientist?",
      );
      expect(llm.calls).toHaveLength(2);
      expect(llm.calls[1].at(-1)?.content).toContain("already asked");
    });

    it("treats punctuation and casing as the same question", async () => {
      const llm = stubLlm(
        JSON.stringify({
          utterance: "Is it a person",
          question: "is it a person",
          keep: [1],
          options: ["Yes", "No"],
          kind: "filter",
          done: false,
        }),
      );
      await new ArticleGenieService(llm).takeTurn(
        turn({ history: [{ question: "Is it a person?", answer: "Yes" }] }),
      );

      expect(llm.calls).toHaveLength(2);
    });

    it("stops rather than asking the same question a third time", async () => {
      const repeated = JSON.stringify({
        utterance: "Mhh — is it a person?",
        question: "Is it a person?",
        keep: [1, 3],
        options: ["Yes", "No"],
        kind: "filter",
        done: false,
      });

      // The stub keeps returning the same thing, so the retry repeats too.
      const result = await new ArticleGenieService(stubLlm(repeated)).takeTurn(
        turn({ history: [{ question: "Is it a person?", answer: "Yes" }] }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Out of ways to split the set is what `done` means — better to show what
      // is left than to put the same question up again.
      expect(result.value.done).toBe(true);
    });

    it("leaves a genuinely new question alone", async () => {
      const llm = stubLlm(
        JSON.stringify({
          utterance: "And was she a scientist?",
          question: "Was she a scientist?",
          keep: [1],
          options: ["Yes", "No"],
          kind: "filter",
          done: false,
        }),
      );
      const result = await new ArticleGenieService(llm).takeTurn(
        turn({ history: [{ question: "Is it a person?", answer: "Yes" }] }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.done).toBe(false);
      // No retry: a new question costs nothing extra.
      expect(llm.calls).toHaveLength(1);
    });

    it("falls back to yes/no when no taps were offered", async () => {
      const result = await new ArticleGenieService(
        stubLlm(
          JSON.stringify({
            utterance: "Is it a person?",
            keep: [1, 3],
            kind: "filter",
            done: false,
          }),
        ),
      ).takeTurn(turn());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.options).toEqual(["Yes", "No"]);
    });
  });

  describe("failure", () => {
    it("retries once when the reply is not JSON, and uses the retry", async () => {
      const llm = stubLlm("I think it's Katherine Johnson!", GOOD_REPLY);
      const result = await new ArticleGenieService(llm).takeTurn(
        turn({ history: ANSWERED }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.keep).toEqual([1, 3]);
      expect(llm.calls).toHaveLength(2);
      // The retry shows the model its own bad reply and says what was wrong.
      expect(llm.calls[1].at(-1)?.content).toContain("valid JSON");
    });

    it("falls asleep when the reply is malformed twice", async () => {
      const llm = stubLlm("nope", "still nope");
      const result = await new ArticleGenieService(llm).takeTurn(turn());

      expect(result).toEqual({ ok: false, error: GENIE_ERRORS.ASLEEP });
      expect(llm.calls).toHaveLength(2);
    });

    it("falls asleep when the model call throws, without retrying", async () => {
      const result = await new ArticleGenieService(failingLlm()).takeTurn(
        turn(),
      );

      // Quota exhaustion is the expected way this fails on the free plan: it
      // would fail identically on a retry and only spend the player's wait.
      expect(result).toEqual({ ok: false, error: GENIE_ERRORS.ASLEEP });
    });
  });
});
