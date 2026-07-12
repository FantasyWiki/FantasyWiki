/**
 * Single source of truth for TanStack Query keys.
 *
 * Every useQuery and invalidateQueries call must build its key through this
 * factory. Keys used to be inline literals duplicated between the composable
 * that owns a query and the views that invalidate it after a mutation; when
 * one side changed shape the other kept matching nothing and the cache
 * silently served stale data (no error anywhere). With a single definition,
 * renaming or re-scoping a key is one edit and the compiler finds every use.
 */
export const queryKeys = {
  /** Wikimedia-backed market article list for a league domain. */
  market: (domain: string | undefined) => ["market", domain] as const,
  /** Market search fallback, keyed by the (trimmed) search text. */
  marketSearch: (domain: string | undefined, search: string) =>
    ["market-search", domain, search] as const,
  /** All contracts held by any team in the league (ownership badges). */
  leagueContracts: (leagueId: string | null) =>
    ["league-contracts", leagueId] as const,
  /** The current player's saved lineup for the league. */
  teamLineup: (leagueId: string | null) => ["team-lineup", leagueId] as const,
  /** Chemistry levels for a draft formation's current placements. */
  chemistry: (leagueId: string | null, schema: string, placements: string[]) =>
    ["chemistry", leagueId, schema, ...placements] as const,
  /** The current player's team in the league (credits, name). */
  myTeam: (leagueId: string | null) => ["my-team", leagueId] as const,
  dashboard: (leagueId: string | null) => ["dashboard", leagueId] as const,
  leaderboard: (leagueId: string | null) => ["leaderboard", leagueId] as const,
  notifications: () => ["notifications"] as const,
  globalLeague: () => ["global-league"] as const,
};
