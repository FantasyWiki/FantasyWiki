/**
 * The seam between the Article Genie and whatever language model is behind it.
 *
 * One method, deliberately: the provider stays swappable (ADR 0006 keeps Gemini
 * as a drop-in escape hatch behind this interface if the free Workers AI
 * allocation ever stops being enough) and, more practically, a one-method
 * interface is trivial to substitute in a test.
 *
 * That substitution has to happen through a *constructor parameter*, not
 * `vi.mock`: under `@cloudflare/vitest-pool-workers` a mocked module silently
 * resolves to the real one, so a test that appears to stub the model would
 * quietly spend real neurons and assert against real output.
 */
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmClient {
  /** Resolves to the model's raw text. Throws on any provider failure. */
  ask(messages: LlmMessage[]): Promise<string>;
}

/**
 * Mistral Small 24B, fixed by measurement rather than by cost (ADR 0006). The
 * obvious cheap pick — Llama 3.1 8B — cannot hold the narrowing loop: ~92%
 * per-turn recall compounds to losing the correct article in roughly a third of
 * five-turn sessions. 24B survived 40/40 at ~77 neurons, and 70B is no better
 * for 30% more. Re-run the fidelity probe in the architecture doc if this
 * changes.
 */
export const GENIE_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

/**
 * The subset of the Workers AI binding this client uses. Narrower than the
 * generated `Ai` type so a test double is a two-line object literal.
 */
export interface WorkersAiBinding {
  run(
    model: string,
    input: { messages: LlmMessage[]; max_tokens?: number },
  ): Promise<unknown>;
}

/** Keeps a runaway generation from burning the day's allocation in one call. */
const MAX_TOKENS = 512;

export function createLlmClient(ai: WorkersAiBinding): LlmClient {
  return {
    async ask(messages: LlmMessage[]): Promise<string> {
      const result = await ai.run(GENIE_MODEL, {
        messages,
        max_tokens: MAX_TOKENS,
      });
      return extractResponseText(result);
    },
  };
}

/**
 * Workers AI usually answers `{ response: "..." }`, but when the generation is
 * pure JSON it pre-parses it and `response` arrives as an object. Both are
 * normalised back to text here so the service has exactly one thing to parse —
 * this is also why JSON mode is not needed (ADR 0006: it costs 3.3x more input
 * for a guarantee Cloudflare declines to make).
 */
export function extractResponseText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  const response = (result as { response?: unknown } | null)?.response;

  if (typeof response === "string") {
    return response;
  }
  if (response !== undefined && response !== null) {
    return JSON.stringify(response);
  }

  throw new Error("Workers AI returned no response field");
}
