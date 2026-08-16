import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { queryKeys } from "@/composables/queryKeys";
import api from "@/services/api";
import { LeagueVisibility } from "../../../model/enums";
import type { LeagueDTO } from "../../../dto/leagueDTO";

/**
 * A league's invitation code, when the caller is allowed to have it.
 *
 * **The server decides, not this composable.** `GET /leagues/:id/invite-code`
 * applies the league's invite policy and answers a caller it does not allow
 * exactly as it answers a league that is not there. That is deliberate — and it
 * is also why the rule is not re-implemented here: `LeagueDTO` carries neither
 * `invitePolicy` nor `adminId`, so the client could not decide even if it
 * wanted to. A refusal simply leaves `code` undefined and the card renders
 * nothing.
 *
 * The one thing decided locally is whether to ask at all. A public league has
 * no code by definition, so asking would spend a request to be told 404 on the
 * happy path.
 */
export function useInvitationCode(
  leagueId: MaybeRefOrGetter<string | undefined>,
  league: MaybeRefOrGetter<LeagueDTO | undefined>
) {
  const id = computed(() => toValue(leagueId) ?? null);
  const isPrivate = computed(
    () => toValue(league)?.visibility === LeagueVisibility.PRIVATE
  );

  const { data: code, isLoading } = useQuery({
    queryKey: computed(() => queryKeys.invitationCode(id.value)),
    queryFn: () => api.leagues.getInviteCode(id.value!).then((r) => r.code),
    enabled: computed(() => !!id.value && isPrivate.value),
    // A 404 here is the endpoint working as designed — this caller may not
    // invite — not a fetch worth repeating.
    retry: false,
    // The code changes only if it is rotated, which nothing does yet.
    staleTime: 5 * 60 * 1000,
  });

  return { code, isLoading, isPrivate };
}
