/**
 * A Wikipedia edition a league can be founded on.
 *
 * The list of these replaces `LEAGUE_DOMAINS` — a hand-maintained constant of two
 * codes — with something Wikimedia and its own readership decide (#531). Served
 * by `GET /api/wikipedia-editions`.
 *
 * Two names and no view figures. The picker shows the English name over the
 * edition's domain (`Italian` / `it.wikipedia`), which is how a league states its
 * edition everywhere else; the autonym is carried for *search*, so a player who
 * reads that edition can find it by typing `italiano` rather than having to know
 * its English name. How many of its articles clear 50 views a day is what decides
 * whether a league may be founded on it, and is not a number a player has any use
 * for — see docs/domain/language-editions.md.
 */
export interface WikipediaEditionDTO {
  /** The language code, e.g. `it`. This is what `CreateLeagueRequest.domain` carries. */
  code: string;
  /** The edition's name in its own language and script (`italiano`, `日本語`) — searched, not shown. */
  autonym: string;
  /** Its English name (`Italian`, `Japanese`). */
  englishName: string;
}
