import { ref, computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import { fetchMarket, searchMarket } from "@/services/marketService";
import { api } from "@/services/api";
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

/** Normalizes a canonical Wikipedia title for matching across the two data sources. */
function normKey(title: string): string {
  return title.trim().toLowerCase().replace(/[ _]+/g, "_");
}

export function useMarket() {
  const leagueStore = useLeagueStore();

  const queryKey = computed(() => [
    "market",
    leagueStore.currentLeague?.domain,
  ]);

  const { data, isLoading, isError, error, refetch } = useQuery<
    MarketArticle[]
  >({
    queryKey,
    queryFn: () => fetchMarket(leagueStore.currentLeague!.domain),
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
    queryKey: computed(() => ["league-contracts", leagueStore.currentLeagueId]),
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
          cmp = a.weekViews - b.weekViews;
          break;
      }
      return sortDir.value === "asc" ? cmp : -cmp;
    });

    return filtered;
  }

  const topFiltered = computed<MarketArticle[]>(() => {
    const articles = mergeOwnership(data.value ?? []);
    let filtered = [...articles];

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      filtered = filtered.filter((a) => a.title.toLowerCase().includes(q));
    }

    return applyStatusAndSort(filtered);
  });

  const isSearchFallback = computed(
    () => searchQuery.value.trim().length >= MIN_SEARCH_CHARS
  );

  const {
    data: searchData,
    isLoading: isSearching,
    isError: isSearchError,
  } = useQuery<MarketArticle[]>({
    queryKey: computed(() => [
      "market-search",
      leagueStore.currentLeague?.domain,
      searchQuery.value.trim(),
    ]),
    queryFn: () =>
      searchMarket(leagueStore.currentLeague!.domain, searchQuery.value.trim()),
    enabled: computed(
      () => isSearchFallback.value && !!leagueStore.currentLeague?.domain
    ),
  });

  const filteredArticles = computed<MarketArticle[]>(() => {
    if (isSearchFallback.value) {
      return applyStatusAndSort(mergeOwnership(searchData.value ?? []));
    }
    return topFiltered.value;
  });

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
    isOwnershipLoading,
    isOwnershipError,
    ITEMS_PER_PAGE,
  };
}
