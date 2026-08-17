import { Hono } from "hono";
import {
  EDITION_ERRORS,
  WikipediaEditionService,
} from "../services/wikipediaEditions";

const wikipediaEditions = new Hono();

/**
 * The Wikipedia editions a league can be founded on.
 *
 * A plural noun collection with no identifier (api-naming-rules.md §2), and
 * unscoped: the answer is the same for every player, which is what lets the
 * client hold it for the session.
 *
 * Every live edition, unfiltered — the acceptance floor is applied at league
 * creation instead of here, for the reasons on `WikipediaEditionService`. A
 * Wikimedia outage answers 503, because the request was well-formed and will work
 * later.
 */
wikipediaEditions.get("/", async (c) => {
  const result = await new WikipediaEditionService().getEditions();
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.error === EDITION_ERRORS.UNAVAILABLE ? 503 : 500,
    );
  }
  return c.json(result.value);
});

export default wikipediaEditions;
