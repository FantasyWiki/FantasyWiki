<template>
  <nav-bar>
    <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
      <ion-refresher-content />
    </ion-refresher>

    <div class="page-container">
      <!-- Loading -->
      <div v-if="isLoading" class="state-container">
        <ion-spinner name="crescent" color="primary" />
        <ion-text color="medium"
          ><p>{{ t("market.loading") }}</p></ion-text
        >
      </div>

      <!-- Error -->
      <ion-card v-else-if="isError" color="danger" class="state-card">
        <ion-card-content>
          <div class="error-row">
            <ion-icon :icon="alertCircleOutline" />
            <div>
              <p class="ion-no-margin error-title">
                {{ t("market.errorTitle") }}
              </p>
              <p class="error-detail">{{ error?.message }}</p>
              <ion-button
                fill="outline"
                color="light"
                size="small"
                @click="refetch()"
              >
                <ion-icon slot="start" :icon="refreshOutline" />
                {{ t("market.retry") }}
              </ion-button>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Main content -->
      <template v-else>
        <!-- Heading -->
        <div class="page-heading">
          <div class="heading-left">
            <ion-button
              fill="clear"
              size="small"
              class="back-btn"
              @click="router.push({ name: 'Dashboard' })"
            >
              <ion-icon slot="icon-only" :icon="arrowBackOutline" />
            </ion-button>
            <h2 class="page-title">{{ t("market.title") }}</h2>
            <ion-badge
              v-if="currentLeague"
              color="primary"
              class="league-badge"
            >
              {{ currentLeague.icon }} {{ currentLeague.title }}
            </ion-badge>
          </div>
          <div class="balance-pill">
            <span class="balance-label ion-hide-sm-down"
              >{{ t("market.balance") }}:</span
            >
            <span class="balance-value">{{ balanceDisplay }} Cr</span>
          </div>
        </div>

        <!-- Search + Status filter -->
        <div class="controls-row">
          <ion-searchbar
            class="search-bar"
            :placeholder="t('market.searchPlaceholder')"
            :value="searchQuery"
            @ionInput="
              setSearch(($event.target as HTMLIonSearchbarElement).value ?? '')
            "
            :debounce="200"
          />
          <ion-segment
            class="status-segment"
            :value="statusFilter"
            @ionChange="
              setStatusFilter(
                ($event.target as HTMLIonSegmentElement).value as StatusFilter
              )
            "
          >
            <ion-segment-button value="all">
              <ion-label>{{ t("market.filterAll") }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="free">
              <ion-label>{{ t("market.filterFree") }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="owned">
              <ion-label>{{ t("market.filterOwned") }}</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>

        <!-- Search fallback note -->
        <div v-if="isSearchFallback" class="fallback-note">
          <ion-icon :icon="searchOutline" class="fallback-icon" />
          <span>{{
            t("market.searchFallbackNote", { query: searchQuery })
          }}</span>
        </div>

        <!-- Searching spinner (fallback in progress) -->
        <div v-if="isSearching" class="state-container">
          <ion-spinner name="crescent" color="primary" />
          <ion-text color="medium"
            ><p>{{ t("market.searching") }}</p></ion-text
          >
        </div>

        <!-- Desktop table -->
        <div v-if="!isSearching" class="table-wrapper ion-hide-md-down">
          <table class="market-table">
            <thead>
              <tr>
                <th class="col-sortable" @click="toggleSort('title')">
                  {{ t("market.colArticle") }}
                  <ion-icon :icon="sortIcon('title')" class="sort-icon" />
                </th>
                <th class="col-sortable" @click="toggleSort('status')">
                  {{ t("market.colStatus") }}
                  <ion-icon :icon="sortIcon('status')" class="sort-icon" />
                </th>
                <th
                  class="col-sortable col-num"
                  @click="toggleSort('yesterdayViews')"
                >
                  {{ t("market.colYesterday") }}
                  <ion-icon
                    :icon="sortIcon('yesterdayViews')"
                    class="sort-icon"
                  />
                </th>
                <th
                  class="col-sortable col-num"
                  @click="toggleSort('weekViews')"
                >
                  {{ t("market.colWeek") }}
                  <ion-icon :icon="sortIcon('weekViews')" class="sort-icon" />
                </th>
                <th
                  class="col-sortable col-num"
                  @click="toggleSort('monthViews')"
                >
                  {{ t("market.colMonth") }}
                  <ion-icon :icon="sortIcon('monthViews')" class="sort-icon" />
                </th>
                <th
                  class="col-sortable col-num"
                  @click="toggleSort('yearViews')"
                >
                  {{ t("market.colYear") }}
                  <ion-icon :icon="sortIcon('yearViews')" class="sort-icon" />
                </th>
                <th class="col-sortable col-num" @click="toggleSort('price')">
                  {{ t("market.colPrice") }}
                  <ion-icon :icon="sortIcon('price')" class="sort-icon" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="article in paginatedArticles"
                :key="article.id"
                class="market-row"
                @click="handleArticleClick(article)"
              >
                <td>
                  <span class="article-title">{{ article.title }}</span>
                  <a
                    :href="`https://en.wikipedia.org/wiki/${article.slug}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="wiki-link"
                    @click.stop
                  >
                    wikipedia.org
                    <ion-icon :icon="openOutline" class="ext-icon" />
                  </a>
                </td>
                <td>
                  <ion-chip
                    :color="statusChipColor(article)"
                    outline
                    class="status-chip"
                  >
                    {{ statusChipLabel(article) }}
                  </ion-chip>
                </td>
                <td class="col-num muted">
                  {{ formatViews(article.yesterdayViews) }}
                </td>
                <td class="col-num muted">
                  {{ formatViews(article.weekViews) }}
                </td>
                <td class="col-num muted">
                  {{ formatViews(article.monthViews) }}
                </td>
                <td class="col-num muted">
                  {{ formatViews(article.yearViews) }}
                </td>
                <td class="col-num price">
                  {{ formatPrice(article.price) }} Cr
                </td>
              </tr>
              <tr v-if="filteredArticles.length === 0 && !isSearching">
                <td colspan="7" class="empty-cell">
                  {{
                    isSearchFallback
                      ? t("market.noSearchResults")
                      : t("market.noArticles")
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div v-if="!isSearching" class="ion-hide-md-up">
          <!-- Mobile sort chips -->
          <div class="mobile-sort-row">
            <span class="sort-label">{{ t("market.sortLabel") }}</span>
            <ion-chip
              v-for="col in mobileSortOptions"
              :key="col.key"
              :color="sortKey === col.key ? 'primary' : 'medium'"
              :outline="sortKey !== col.key"
              class="sort-chip"
              @click="toggleSort(col.key)"
            >
              {{ col.label }}
              <ion-icon
                v-if="sortKey === col.key"
                :icon="sortDir === 'asc' ? arrowUpOutline : arrowDownOutline"
                class="sort-dir-icon"
              />
            </ion-chip>
          </div>

          <div v-for="article in paginatedArticles" :key="article.id">
            <ion-card
              class="article-card"
              button
              @click="handleArticleClick(article)"
            >
              <ion-card-content>
                <div class="card-header-row">
                  <div class="card-title-block">
                    <h4 class="card-title">{{ article.title }}</h4>
                    <a
                      :href="`https://en.wikipedia.org/wiki/${article.slug}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="wiki-link"
                      @click.stop
                    >
                      wikipedia.org
                      <ion-icon :icon="openOutline" class="ext-icon" />
                    </a>
                  </div>
                  <div class="card-right">
                    <p class="card-price">
                      {{ formatPrice(article.price) }} Cr
                    </p>
                    <ion-chip
                      :color="statusChipColor(article)"
                      outline
                      class="status-chip-sm"
                    >
                      {{ statusChipLabel(article) }}
                    </ion-chip>
                  </div>
                </div>
                <div class="card-stats-grid">
                  <div class="stat-cell">
                    <p class="stat-label">{{ t("market.colYesterday") }}</p>
                    <h6 class="stat-value">
                      {{ formatViews(article.yesterdayViews) }}
                    </h6>
                  </div>
                  <div class="stat-cell">
                    <p class="stat-label">{{ t("market.colWeek") }}</p>
                    <h6 class="stat-value">
                      {{ formatViews(article.weekViews) }}
                    </h6>
                  </div>
                  <div class="stat-cell">
                    <p class="stat-label">{{ t("market.colMonth") }}</p>
                    <h6 class="stat-value">
                      {{ formatViews(article.monthViews) }}
                    </h6>
                  </div>
                  <div class="stat-cell">
                    <p class="stat-label">{{ t("market.colYear") }}</p>
                    <h6 class="stat-value">
                      {{ formatViews(article.yearViews) }}
                    </h6>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </div>

          <div
            v-if="filteredArticles.length === 0 && !isSearching"
            class="empty-mobile"
          >
            {{
              isSearchFallback
                ? t("market.noSearchResults")
                : t("market.noArticles")
            }}
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination-row">
          <p class="pagination-info">
            {{
              t("market.paginationInfo", {
                from: (safePage - 1) * ITEMS_PER_PAGE + 1,
                to: Math.min(
                  safePage * ITEMS_PER_PAGE,
                  filteredArticles.length
                ),
                total: filteredArticles.length,
              })
            }}
          </p>
          <div class="pagination-controls">
            <ion-button
              fill="outline"
              size="small"
              :disabled="safePage <= 1"
              @click="currentPage = Math.max(1, currentPage - 1)"
            >
              <ion-icon :icon="chevronBackOutline" slot="icon-only" />
            </ion-button>

            <template v-for="(item, idx) in pageItems" :key="idx">
              <span v-if="item === 'ellipsis'" class="ellipsis">…</span>
              <ion-button
                v-else
                :fill="safePage === item ? 'solid' : 'outline'"
                size="small"
                class="page-btn"
                @click="currentPage = item as number"
              >
                {{ item }}
              </ion-button>
            </template>

            <ion-button
              fill="outline"
              size="small"
              :disabled="safePage >= totalPages"
              @click="currentPage = Math.min(totalPages, currentPage + 1)"
            >
              <ion-icon :icon="chevronForwardOutline" slot="icon-only" />
            </ion-button>
          </div>
        </div>
      </template>
    </div>
    <!-- /page-container -->

    <ArticleDetail
      v-if="selectedArticle"
      :article="selectedArticle"
      :contract="selectedContract"
      :is-open="isDetailOpen"
      @close="closeDetail"
      @buy="onBuy"
      @sell="onSell"
      @renew="onRenew"
      @request-trade="onRequestTrade"
    />
  </nav-bar>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonChip,
  IonIcon,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
} from "@ionic/vue";
import {
  alertCircleOutline,
  arrowBackOutline,
  arrowDownOutline,
  arrowUpOutline,
  chevronBackOutline,
  chevronForwardOutline,
  openOutline,
  refreshOutline,
  searchOutline,
  swapVerticalOutline,
} from "ionicons/icons";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";

import NavBar from "@/layout/NavBar.vue";
import ArticleDetail from "@/components/ArticleDetail.vue";
import { useLeagueStore } from "@/stores/league";
import {
  useMarket,
  type SortKey,
  type StatusFilter,
} from "@/composables/useMarket";
import { useToast } from "@/composables/useToast";
import { useRenewContract } from "@/composables/useRenewContract";
import type { MarketArticle } from "@/types/market";
import type { ArticleDTO } from "../../../dto/articleDTO";
import type { ContractDTO } from "../../../dto/contractDTO";
import type { ContractTier } from "@/types/articleDetail";
import { formatViews, formatPrice } from "@/types/models";
import { leaguesApi } from "@/services/api";

const { t } = useI18n();
const router = useRouter();
const queryClient = useQueryClient();
const leagueStore = useLeagueStore();
const currentLeague = computed(() => leagueStore.currentLeague);

// The player's spendable balance for the active league. Sourced from the league
// store's current team (fetched via getMyTeam); falls back to a dash until it
// resolves so we never render a misleading hardcoded number.
const balanceDisplay = computed(() => {
  const credits = leagueStore.currentTeam?.credits;
  return credits == null ? "—" : formatPrice(credits);
});

const {
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
  isOwnershipLoading,
  ITEMS_PER_PAGE,
} = useMarket();

function statusChipColor(article: MarketArticle): string {
  if (!article.owner && isOwnershipLoading.value) return "medium";
  return article.owner ? "medium" : "primary";
}

function statusChipLabel(article: MarketArticle): string {
  if (!article.owner && isOwnershipLoading.value) {
    return t("market.ownershipLoading");
  }
  if (!article.owner) return t("market.freeAgent");
  if (article.ownerTeamId === leagueStore.currentTeamId) {
    return t("market.yourTeam");
  }
  return article.owner.name;
}

function sortIcon(key: SortKey) {
  if (sortKey.value !== key) return swapVerticalOutline;
  return sortDir.value === "asc" ? arrowUpOutline : arrowDownOutline;
}

const mobileSortOptions = computed<{ key: SortKey; label: string }[]>(() => [
  { key: "price", label: t("market.colPrice") },
  { key: "yesterdayViews", label: t("market.colYesterday") },
  { key: "weekViews", label: t("market.colWeek") },
  { key: "monthViews", label: t("market.colMonth") },
]);

const pageItems = computed<(number | "ellipsis")[]>(() => {
  const pages = Array.from({ length: totalPages.value }, (_, i) => i + 1);
  const visible = pages.filter((p) => {
    if (totalPages.value <= 5) return true;
    if (p === 1 || p === totalPages.value) return true;
    return Math.abs(p - safePage.value) <= 1;
  });
  return visible.reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
    acc.push(p);
    return acc;
  }, []);
});

const selectedArticle = ref<ArticleDTO | null>(null);
const selectedContract = ref<ContractDTO | null>(null);
const isDetailOpen = ref(false);

function handleArticleClick(article: MarketArticle) {
  selectedArticle.value = article.contract?.article ?? {
    id: article.id,
    title: article.title,
    domain: currentLeague.value!.domain,
  };
  selectedContract.value = article.contract ?? null;
  isDetailOpen.value = true;
}

function closeDetail() {
  isDetailOpen.value = false;
}

const { showSuccess, showError } = useToast();
const { renewContract } = useRenewContract();

async function onBuy(tier: ContractTier) {
  const league = currentLeague.value;
  const article = selectedArticle.value;
  if (!league || !article) return;
  try {
    await leaguesApi.buyMyContract(league.id, article.id, tier);
    closeDetail();
    showSuccess(t("market.buySuccess"));
    // Refetch the article list and invalidate every view that reflects the
    // purchase: market ownership badges (league-contracts), the team bench
    // (team-lineup), and credits/portfolio (dashboard). Refresh the store's
    // current team too so the balance pill reflects the deducted credits.
    // Without this the bench and balance stay stale until a manual reload.
    await Promise.all([
      refetch(),
      leagueStore.fetchCurrentTeamContext(),
      queryClient.invalidateQueries({
        queryKey: ["league-contracts", league.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["team-lineup", league.id] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", league.id] }),
    ]);
  } catch (e) {
    showError(e instanceof Error ? e.message : t("market.buyError"));
  }
}

async function onSell(contractId: string) {
  const league = currentLeague.value;
  if (!league) return;
  try {
    await leaguesApi.sellMyContract(league.id, contractId);
    closeDetail();
    showSuccess(t("market.sellSuccess"));
    // Same invalidation set as onBuy, plus notifications: selling writes an
    // inbox notification, so the notification list must refresh too.
    await Promise.all([
      refetch(),
      leagueStore.fetchCurrentTeamContext(),
      queryClient.invalidateQueries({
        queryKey: ["league-contracts", league.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["team-lineup", league.id] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", league.id] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
  } catch (e) {
    showError(e instanceof Error ? e.message : t("market.sellError"));
  }
}

async function onRenew(contract: ContractDTO) {
  const league = currentLeague.value;
  if (!league) return;
  const ok = await renewContract(league.id, contract.id);
  if (ok) {
    closeDetail();
    await refetch();
  }
}

// TODO: implement trade-request flow once a trade API exists.
function onRequestTrade(contractId: string) {
  console.log("Request trade", contractId);
}

async function handleRefresh(event: CustomEvent) {
  await refetch();
  (event.target as HTMLIonRefresherElement).complete();
}
</script>

<style scoped>
.page-container {
  max-width: 1400px;
  margin: 0 auto;
}

.back-btn {
  --padding-start: 0;
  --padding-end: 4px;
  margin-inline-end: 4px;
}

@media (min-width: 1024px) {
  .page-container {
    padding-left: 2rem;
    padding-right: 2rem;
  }
}

@media (min-width: 1280px) {
  .page-container {
    padding-left: 4rem;
    padding-right: 4rem;
  }
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
}

.state-card {
  margin-top: 16px;
}

.error-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.error-row ion-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.error-title {
  font-weight: 600;
  margin: 0 0 4px;
}

.error-detail {
  font-size: 13px;
  opacity: 0.85;
  margin: 0 0 8px;
}

/* Heading */
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.heading-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  font-family: var(--font-family-headings);
}

@media (min-width: 768px) {
  .page-title {
    font-size: 2.25rem;
  }
}

.league-badge {
  font-size: 11px;
}

.balance-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--ion-color-step-50, var(--ion-background-color));
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  padding: 6px 12px;
}

.balance-label {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.balance-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ion-color-primary);
}

/* Controls */
.controls-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.search-bar {
  --border-radius: 8px;
  --color: var(--ion-text-color);
  --placeholder-color: var(--ion-color-medium);
  --placeholder-opacity: 1;
  --icon-color: var(--ion-color-medium);
  --box-shadow: none;
  padding: 0;
}

.search-bar :deep(.searchbar-input-container) {
  border: 1.5px solid var(--ion-color-primary);
  border-radius: 8px;
}

.status-segment {
  width: 100%;
}

/* Desktop table */
.table-wrapper {
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.market-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--ion-card-background, var(--ion-background-color));
}

.market-table thead tr {
  border-bottom: 1px solid var(--ion-border-color);
}

.market-table th {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  color: var(--ion-color-medium);
  white-space: nowrap;
}

.market-table th.col-num {
  text-align: right;
}

.col-sortable {
  cursor: pointer;
  user-select: none;
}

.col-sortable:hover {
  color: var(--ion-color-primary);
}

.sort-icon {
  vertical-align: middle;
  font-size: 12px;
  margin-left: 2px;
  opacity: 0.6;
}

.col-sortable:hover .sort-icon {
  opacity: 1;
}

.market-row {
  cursor: pointer;
  border-bottom: 1px solid var(--ion-border-color);
}

.market-row:last-child {
  border-bottom: none;
}

.market-row:hover {
  background: var(
    --ion-color-step-50,
    rgba(var(--ion-color-primary-rgb), 0.04)
  );
}

.market-table td {
  padding: 10px 12px;
  font-size: 14px;
}

.market-table td.col-num {
  text-align: right;
}

.article-title {
  font-weight: 500;
  display: block;
}

.wiki-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: var(--ion-color-medium);
  text-decoration: none;
  margin-top: 2px;
}

.wiki-link:hover {
  color: var(--ion-color-primary);
}

.ext-icon {
  font-size: 10px;
}

.status-chip {
  font-size: 12px;
  height: 24px;
  margin: 0;
}

.muted {
  color: var(--ion-color-medium);
}

.price {
  font-weight: 700;
  color: var(--ion-color-primary);
}

.empty-cell {
  text-align: center;
  padding: 48px 16px;
  color: var(--ion-color-medium);
}

/* Mobile */
.mobile-sort-row {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 8px;
}

.sort-label {
  font-size: 12px;
  color: var(--ion-color-medium);
  white-space: nowrap;
  flex-shrink: 0;
}

.sort-chip {
  flex-shrink: 0;
  font-size: 12px;
  height: 28px;
  margin: 0;
}

.sort-dir-icon {
  font-size: 11px;
  margin-left: 2px;
}

.article-card {
  margin: 0 0 8px;
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
}

.card-title-block {
  min-width: 0;
}

.card-title {
  font-weight: 600;
  font-size: 14px;
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-right {
  text-align: right;
  flex-shrink: 0;
}

.card-price {
  font-weight: 700;
  font-size: 14px;
  color: var(--ion-color-primary);
  margin: 0 0 4px;
}

.status-chip-sm {
  font-size: 10px;
  height: 20px;
  margin: 0;
}

.card-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  text-align: center;
}

.stat-label {
  font-size: 11px;
  color: var(--ion-color-medium);
  margin: 0 0 2px;
}

.stat-value {
  font-size: 13px;
  font-weight: 500;
  margin: 0;
}

.empty-mobile {
  text-align: center;
  padding: 48px 16px;
  color: var(--ion-color-medium);
}

/* Pagination */
.pagination-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  margin-bottom: 8px;
}

.pagination-info {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin: 0;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-btn {
  min-width: 36px;
}

.ellipsis {
  padding: 0 4px;
  color: var(--ion-color-medium);
  font-size: 14px;
}

.fallback-note {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ion-color-medium);
  padding: 6px 4px 10px;
}

.fallback-icon {
  font-size: 15px;
  flex-shrink: 0;
}
</style>
