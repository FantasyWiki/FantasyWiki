import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { queryKeys } from "@/composables/queryKeys";
import api from "@/services/api";
import type { WikipediaEditionDTO } from "../../../dto/wikipediaEditionDTO";

/**
 * The Wikipedia editions a league can be founded on, and a search over them.
 *
 * Server state, so it lives in the TanStack Query cache like every other remote
 * resource — and it is the same answer for every player, so nothing keys it.
 *
 * The search is client-side over the fetched list rather than a round trip. There
 * are ~348 live editions and the whole list is a few kilobytes, so one request and
 * a filter beats an endpoint that takes a query — and it makes the search instant,
 * which matters more here than anywhere else on the form: a player scanning for
 * their language is the only reason this control is a search at all.
 *
 * Not every edition listed can actually host a league. The ones too small to
 * score fairly are refused at creation, by the calibration that measures them
 * (ADR 0002) — see `WikipediaEditionService` on the backend for why the list is
 * not pre-filtered.
 *
 * Matching is over both names *and* the code, because those are the three things a
 * player might type: `italiano` if they read that edition, `Italian` if they do
 * not, and `it` if they know the codes. Case- and accent-insensitive, so searching
 * `espanol` finds `español`.
 *
 * The autonym is matched but not shown — a row reads `Italian` over
 * `it.wikipedia`, the same way every other surface states a league's edition. It
 * stays in the DTO because dropping it would make the picker unsearchable for
 * exactly the players who read that edition.
 */
export function useWikipediaEditions(search: Ref<string>) {
  const { data, isPending, isError, refetch } = useQuery<WikipediaEditionDTO[]>(
    {
      queryKey: queryKeys.wikipediaEditions(),
      queryFn: () => api.wikipediaEditions.getAll(),
      // New Wikipedia editions are years apart, so a session never needs to ask
      // twice.
      staleTime: Infinity,
    }
  );

  const editions = computed(() => data.value ?? []);

  const matching = computed(() => {
    const needle = fold(search.value.trim());
    if (!needle) return editions.value;
    return editions.value.filter((edition) =>
      [edition.autonym, edition.englishName, edition.code].some((field) =>
        fold(field).includes(needle)
      )
    );
  });

  return {
    editions,
    matching,
    isPending,
    isError,
    refetch,
    /** The edition with this code, if it is on the list. */
    find: (code: string) => editions.value.find((e) => e.code === code),
  };
}

/**
 * Lowercase and strip diacritics, so `espanol` matches `español` and `Deutsch`
 * matches `deutsch`. NFD splits an accented character into base + combining
 * mark, and `\p{M}` (any Unicode mark) erases the marks.
 */
function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
