import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { queryKeys } from "@/composables/queryKeys";
import api, { ApiError } from "@/services/api";
import {
  isInvitationCode,
  normalizeInvitationCode,
} from "../../../model/league";

/**
 * Resolve an invitation code to the league it opens.
 *
 * The code is normalized and shape-checked with the **shared** model helpers —
 * the same two functions the backend runs on the way in — rather than with a
 * regex written again here. That is what makes the field reject " zk7-qw! "
 * for the same reason the server would, and what keeps a future change to the
 * alphabet from having to be made twice.
 *
 * The check also decides whether to ask at all: a code that cannot be right
 * costs no request, which matters because this endpoint is rate limited and a
 * half-typed code would otherwise burn a player's own attempts while they type.
 *
 * A refusal is deliberately uninformative — wrong code, unused code and bad
 * shape are one 404 with one body (ADR 0008) — so the only distinction worth
 * drawing is "we were told to slow down" (429) from everything else.
 */
export function useLeagueByCode(code: MaybeRefOrGetter<string>) {
  const normalized = computed(() => normalizeInvitationCode(toValue(code)));
  const isWellFormed = computed(() => isInvitationCode(normalized.value));

  const { data, isFetching, isError, error } = useQuery({
    queryKey: computed(() => queryKeys.leagueByCode(normalized.value)),
    queryFn: () => api.leagues.getByCode(normalized.value),
    enabled: isWellFormed,
    // A 404 here is the endpoint working as designed, and a 429 is it asking us
    // to stop — retrying either would spend attempts to be told the same thing.
    retry: false,
    // A league's identity does not go stale while a player reads it, and the
    // request costs part of a rate-limited budget.
    staleTime: 5 * 60 * 1000,
  });

  const isRateLimited = computed(
    () => error.value instanceof ApiError && error.value.status === 429
  );

  return {
    league: computed(() => data.value ?? null),
    normalized,
    isWellFormed,
    isFetching,
    isError,
    isRateLimited,
  };
}
