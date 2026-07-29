import { ref, computed } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import {
  fetchMarket,
  fetchMarketArticlesByTitle,
  searchMarket,
} from "@/services/marketService";
import { api } from "@/services/api";
import { queryKeys } from "@/composables/queryKeys";
import type { ContractDTO } from "../../../dto/contractDTO";
import type { MarketArticle } from "@/types/market";

export type SortKey =
  | "title"
  | "status"
  | "yesterdayViews"
  | "weekViews"
  | "monthViews"
  | "yearViews"
  | "price";
export type SortDir = "asc" | "desc";
export type StatusFilter = "all" | "free" | "owned";

const ITEMS_PER_PAGE = 10;
const MIN_SEARCH_CHARS = 3;
/** Hydrated owned rows change no faster than the daily pageview snapshot they read. */
const OWNED_EXTRAS_STALE_MS = 5 * 60 * 1000;

/** Normalizes a canonical Wikipedia title for matching across the two data sources. */
function normKey(title: string): string {
  return title.trim().toLowerCase().replace(/[ _]+/g, "_");
}

export function useMarket() {
  const leagueStore = useLeagueStore();

  const queryKey = computed(() =>
    queryKeys.market(leagueStore.currentLeague?.domain)
  );

  // Publishing each partial into the cache is what makes the table appear
  // after the single top-read request instead of after all 50 per-article
  // ones: writing data to the key resolves the query's loading state, and the
  // rows fill in place as their view series land. The final fetch result
  // overwrites the last partial, so the cached value is always complete.
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<
    MarketArticle[]
  >({
    queryKey,
    queryFn: () =>
      fetchMarket(leagueStore.currentLeague!.domain, (partial) =>
        queryClient.setQueryData(queryKey.value, partial)
      ),
    enabled: computed(() => !!leagueStore.currentLeague?.domain),
  });

  // Ownership is resolved from a separate, league-scoped contracts fetch that
  // runs independently of (and in parallel with) the Wikimedia-backed article
  // list/search above. The two never block each other: the table renders as
  // soon as the article list resolves, and owner badges upgrade reactively
  // once this query resolves too.
  const {
    data: leagueContractsData,
    isLoading: isOwnershipLoading,
    isError: isOwnershipError,
  } = useQuery<ContractDTO[]>({
    queryKey: computed(() =>
      queryKeys.leagueContracts(leagueStore.currentLeagueId)
    ),
    queryFn: () => api.leagues.getContracts(leagueStore.currentLeagueId!),
    enabled: computed(() => !!leagueStore.currentLeagueId),
  });

  // Matched on title, not id: article identity is the canonical Wikipedia
  // title (+ league domain, which is already fixed per league), but a
  // contract's `article.id`/`article.title` both carry that same title —
  // whereas MarketArticle.id is Wikimedia's canonicalTitle (underscored) and
  // its title is the display form (spaced). normKey() folds both to the
  // same key.
  const contractByKey = computed(() => {
    const map = new Map<string, ContractDTO>();
    for (const contract of leagueContractsData.value ?? []) {
      map.set(normKey(contract.article.title), contract);
    }
    return map;
  });

  function mergeOwnership(articles: MarketArticle[]): MarketArticle[] {
    return articles.map((article) => {
      const contract = contractByKey.value.get(normKey(article.title)) ?? null;
      if (!contract) {
        return {
          ...article,
          owner: null,
          ownerTeamId: undefined,
          contract: null,
        };
      }
      return {
        ...article,
        contract,
        ownerTeamId: contract.team.id,
        owner: {
          name: contract.team.player.name,
          teamName: contract.team.name,
        },
      };
    });
  }

  const searchQuery = ref("");
  const statusFilter = ref<StatusFilter>("all");
  const sortKey = ref<SortKey>("price");
  const sortDir = ref<SortDir>("desc");
  const currentPage = ref(1);

  function toggleSort(key: SortKey) {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
    } else {
      sortKey.value = key;
      sortDir.value = "desc";
    }
    currentPage.value = 1;
  }

  function setSearch(q: string) {
    searchQuery.value = q;
    currentPage.value = 1;
  }

  function setStatusFilter(f: StatusFilter) {
    statusFilter.value = f;
    currentPage.value = 1;
  }

  function applyStatusAndSort(articles: MarketArticle[]): MarketArticle[] {
    let filtered = [...articles];

    if (statusFilter.value === "free") {
      filtered = filtered.filter((a) => !a.owner);
    } else if (statusFilter.value === "owned") {
      filtered = filtered.filter((a) => !!a.owner);
    }

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey.value) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "status":
          cmp = (a.owner ? 1 : 0) - (b.owner ? 1 : 0);
          break;
        case "yesterdayViews":
          cmp = a.yesterdayViews - b.yesterdayViews;
          break;
        case "weekViews":
          cmp = a.weekViews - b.weekViews;
          break;
        case "monthViews":
          cmp = a.monthViews - b.monthViews;
          break;
        case "yearViews":
          cmp = a.yearViews - b.yearViews;
          break;
        case "price":
          cmp = a.price - b.price;
          break;
      }
      return sortDir.value === "asc" ? cmp : -cmp;
    });

    return filtered;
  }

  function applyLocalSearch(articles: MarketArticle[]): MarketArticle[] {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => a.title.toLowerCase().includes(q));
  }

  const topFiltered = computed<MarketArticle[]>(() =>
    applyStatusAndSort(applyLocalSearch(mergeOwnership(data.value ?? [])))
  );

  // Owned mode enumerates the league's contracts rather than the Top Read
  // Snapshot, so the searchbar narrows that set locally instead of handing the
  // query to Wikipedia — a search there would reintroduce the very bug this
  // mode fixes, only scoped to 8 results instead of 50.
  const isOwnedMode = computed(() => statusFilter.value === "owned");

  const isSearchFallback = computed(
    () =>
      !isOwnedMode.value && searchQuery.value.trim().length >= MIN_SEARCH_CHARS
  );

  const {
    data: searchData,
    isLoading: isSearching,
    isError: isSearchError,
  } = useQuery<MarketArticle[]>({
    queryKey: computed(() =>
      queryKeys.marketSearch(
        leagueStore.currentLeague?.domain,
        searchQuery.value.trim()
      )
    ),
    queryFn: () =>
      searchMarket(leagueStore.currentLeague!.domain, searchQuery.value.trim()),
    enabled: computed(
      () => isSearchFallback.value && !!leagueStore.currentLeague?.domain
    ),
  });

  // An article can be owned wherever it sits in the domain, but the market
  // list only ever holds the Top Read Snapshot — so filtering that list to
  // owned rows silently dropped every contract outside the top 50. The owned
  // set comes from the league's contracts instead, and the ones the snapshot
  // doesn't carry get their views/price fetched per title.
  const missingOwnedContracts = computed<ContractDTO[]>(() => {
    if (!isOwnedMode.value || !data.value) return [];
    const inSnapshot = new Set(data.value.map((a) => normKey(a.title)));
    return [...contractByKey.value].flatMap(([key, contract]) =>
      inSnapshot.has(key) ? [] : [contract]
    );
  });

  const { data: ownedExtrasData, isLoading: isOwnedExtrasLoading } = useQuery<
    MarketArticle[]
  >({
    queryKey: computed(() =>
      queryKeys.marketOwnedExtras(
        leagueStore.currentLeague?.domain,
        missingOwnedContracts.value
          .map((contract) => normKey(contract.article.title))
          .sort()
      )
    ),
    queryFn: () =>
      fetchMarketArticlesByTitle(
        leagueStore.currentLeague!.domain,
        missingOwnedContracts.value.map((contract) => ({
          title: contract.article.title,
          fallbackPrice: contract.purchasePrice,
        }))
      ),
    enabled: computed(
      () =>
        !!leagueStore.currentLeague?.domain &&
        missingOwnedContracts.value.length > 0
    ),
    staleTime: OWNED_EXTRAS_STALE_MS,
  });

  // Deduped on the snapshot's terms: the snapshot list streams in, so a
  // contract can look absent from it, get hydrated, and then turn up in a later
  // partial — which without this would render the same article twice, under the
  // same row key.
  const ownedArticles = computed<MarketArticle[]>(() => {
    const fromSnapshot = mergeOwnership(data.value ?? []);
    const snapshotKeys = new Set(fromSnapshot.map((a) => normKey(a.title)));
    const hydrated = mergeOwnership(ownedExtrasData.value ?? []).filter(
      (a) => !snapshotKeys.has(normKey(a.title))
    );
    return [...fromSnapshot, ...hydrated];
  });

  const filteredArticles = computed<MarketArticle[]>(() => {
    if (isOwnedMode.value) {
      return applyStatusAndSort(applyLocalSearch(ownedArticles.value));
    }
    if (isSearchFallback.value) {
      return applyStatusAndSort(mergeOwnership(searchData.value ?? []));
    }
    return topFiltered.value;
  });

  /**
   * Owned mode has to wait for both the contracts and the hydrated rows: shown
   * early it renders the snapshot subset first and then grows, jumping the row
   * count and the page the viewer is on.
   */
  const isOwnedLoading = computed(
    () =>
      isOwnedMode.value &&
      (isOwnershipLoading.value || isOwnedExtrasLoading.value)
  );

  /** Whichever listing is active is still resolving — the table must not render yet. */
  const isListLoading = computed(
    () => isSearching.value || isOwnedLoading.value
  );

  /**
   * Search text is narrowing the listing — whether it went to Wikipedia or
   * filtered locally. Drives the empty state's copy: an empty listing under a
   * query is "no results", not "no articles".
   */
  const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0);

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(filteredArticles.value.length / ITEMS_PER_PAGE))
  );

  const safePage = computed(() =>
    Math.min(currentPage.value, totalPages.value)
  );

  const paginatedArticles = computed<MarketArticle[]>(() => {
    const start = (safePage.value - 1) * ITEMS_PER_PAGE;
    return filteredArticles.value.slice(start, start + ITEMS_PER_PAGE);
  });

  return {
    isLoading,
    isError,
    error,
    refetch,
    searchQuery,
    statusFilter,
    sortKey,
    sortDir,
    currentPage,
    safePage,
    totalPages,
    filteredArticles,
    paginatedArticles,
    toggleSort,
    setSearch,
    setStatusFilter,
    isSearchFallback,
    isSearching,
    isSearchError,
    hasSearchQuery,
    isOwnedLoading,
    isListLoading,
    isOwnershipLoading,
    isOwnershipError,
    ITEMS_PER_PAGE,
  };
}
