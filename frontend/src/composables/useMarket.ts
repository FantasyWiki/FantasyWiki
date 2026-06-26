import { ref, computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useLeagueStore } from "@/stores/league";
import { fetchMarket, searchMarket } from "@/services/marketService";
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
    const articles = data.value ?? [];
    let filtered = [...articles];

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      filtered = filtered.filter((a) => a.title.toLowerCase().includes(q));
    }

    return applyStatusAndSort(filtered);
  });

  const isSearchFallback = computed(
    () =>
      searchQuery.value.trim().length >= MIN_SEARCH_CHARS &&
      topFiltered.value.length === 0
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
      return applyStatusAndSort(searchData.value ?? []);
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
    ITEMS_PER_PAGE,
  };
}
