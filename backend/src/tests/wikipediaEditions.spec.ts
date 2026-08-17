import { describe, it, expect } from "vitest";
import {
  EDITION_ERRORS,
  WikipediaEditionService,
} from "../services/wikipediaEditions";
import type { WikimediaClient } from "../../../external-apis/wikimedia/client";

/**
 * The client is injected rather than mocked: `vi.mock` is a no-op under the
 * Workers test pool, so a module-scope client would quietly stay the real one and
 * these tests would fetch Sitematrix for real.
 */
function client(
  listEditions: () => Promise<
    Array<{ code: string; autonym: string; englishName: string }>
  >,
): WikimediaClient {
  return { site: { listEditions } } as unknown as WikimediaClient;
}

describe("WikipediaEditionService", () => {
  it("offers every live edition, small ones included", async () => {
    // The list is deliberately unfiltered — the acceptance floor is applied when a
    // league is founded, not here (see the service's own doc comment). An edition
    // that will be refused must still appear, or the refusal is unreachable.
    const service = new WikipediaEditionService(
      client(async () => [
        { code: "en", autonym: "English", englishName: "English" },
        { code: "la", autonym: "Latina", englishName: "Latin" },
      ]),
    );

    const result = await service.getEditions();

    expect(result).toEqual({
      ok: true,
      value: [
        { code: "en", autonym: "English", englishName: "English" },
        { code: "la", autonym: "Latina", englishName: "Latin" },
      ],
    });
  });

  it("carries both names, because they are searched separately", async () => {
    // A player types `italiano` if they read that edition and `Italian` if they do
    // not; dropping either would make the picker unsearchable for one of them.
    const service = new WikipediaEditionService(
      client(async () => [
        { code: "it", autonym: "italiano", englishName: "Italian" },
      ]),
    );

    const result = await service.getEditions();

    expect(result.ok && result.value[0]).toEqual({
      code: "it",
      autonym: "italiano",
      englishName: "Italian",
    });
  });

  it("names a Wikimedia outage rather than serving an empty list", async () => {
    // An empty list and a failed fetch look identical to the picker, and only one
    // of them means "there are no editions". Answering 503 keeps them apart.
    const service = new WikipediaEditionService(
      client(async () => {
        throw new Error("network down");
      }),
    );

    const result = await service.getEditions();

    expect(result).toEqual({ ok: false, error: EDITION_ERRORS.UNAVAILABLE });
  });
});
