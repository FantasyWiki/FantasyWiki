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
            <ion-icon aria-hidden="true" :icon="alertCircleOutline" />
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
                <ion-icon
                  aria-hidden="true"
                  slot="start"
                  :icon="refreshOutline"
                />
                {{ t("market.retry") }}
              </ion-button>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Main content -->
      <page-reveal v-else>
        <!-- Heading -->
        <div class="page-heading">
          <div class="heading-left">
            <ion-button
              fill="clear"
              size="small"
              class="back-btn"
              :aria-label="t('market.back')"
              @click="router.push({ name: 'Dashboard' })"
            >
              <ion-icon
                aria-hidden="true"
                slot="icon-only"
                :icon="arrowBackOutline"
              />
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
          <!-- The Genie sits *beside* the search bar, sharing its line and its
               height: it is additive, and the search bar is both the thing it
               supplements and where a failed session hands the player back to. -->
          <div class="search-row">
            <ion-searchbar
              class="search-bar"
              :placeholder="t('market.searchPlaceholder')"
              :value="searchQuery"
              @ionInput="
                setSearch(
                  ($event.target as HTMLIonSearchbarElement).value ?? ''
                )
              "
              :debounce="200"
            />
            <ion-button
              v-if="isArticleGenieAvailable"
              fill="outline"
              class="genie-trigger"
              @click="openGenie"
            >
              <ion-icon
                aria-hidden="true"
                slot="start"
                :icon="sparklesOutline"
              />
              {{ t("market.genie.trigger") }}
            </ion-button>
          </div>
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
          <ion-icon
            aria-hidden="true"
            :icon="searchOutline"
            class="fallback-icon"
          />
          <span>{{
            t("market.searchFallbackNote", { query: searchQuery })
          }}</span>
        </div>

        <!-- Listing spinner: search fallback, or the owned set still resolving -->
        <div v-if="isListLoading" class="state-container">
          <ion-spinner name="crescent" color="primary" />
          <ion-text color="medium"
            ><p>
              {{ isSearching ? t("market.searching") : t("market.loading") }}
            </p></ion-text
          >
        </div>

        <!-- Desktop table -->
        <!-- data-tour: the onboarding tour rings the price column's table so
             the player sees a real listing while it is explained. -->
        <div
          v-if="!isListLoading"
          data-tour="market"
          class="table-wrapper ion-hide-md-down"
        >
          <table class="market-table">
            <thead>
              <tr>
                <th class="col-sortable" @click="toggleSort('title')">
                  {{ t("market.colArticle") }}
                  <ion-icon
                    aria-hidden="true"
                    :icon="sortIcon('title')"
                    class="sort-icon"
                  />
                </th>
                <th class="col-sortable" @click="toggleSort('status')">
                  {{ t("market.colStatus") }}
                  <ion-icon
                    aria-hidden="true"
                    :icon="sortIcon('status')"
                    class="sort-icon"
                  />
                </th>
                <th
                  class="col-sortable col-num"
                  @click="toggleSort('yesterdayViews')"
                >
                  {{ t("market.colYesterday") }}
                  <ion-icon
                    aria-hidden="true"
                    :icon="sortIcon('yesterdayViews')"
                    class="sort-icon"
                  />
                </th>
                <th
                  class="col-sortable col-num"
                  @click="toggleSort('weekViews')"
                >
                  {{ t("market.colWeek") }}
                  <ion-icon
                    aria-hidden="true"
                    :icon="sortIcon('weekViews')"
                    class="sort-icon"
                  />
                </th>
                <th
                  class="col-sortable col-num"
                  @click="toggleSort('monthViews')"
                >
                  {{ t("market.colMonth") }}
                  <ion-icon
                    aria-hidden="true"
                    :icon="sortIcon('monthViews')"
                    class="sort-icon"
                  />
                </th>
                <th
                  class="col-sortable col-num"
                  @click="toggleSort('yearViews')"
                >
                  {{ t("market.colYear") }}
                  <ion-icon
                    aria-hidden="true"
                    :icon="sortIcon('yearViews')"
                    class="sort-icon"
                  />
                </th>
                <th class="col-sortable col-num" @click="toggleSort('price')">
                  {{ t("market.colPrice") }}
                  <ion-icon
                    aria-hidden="true"
                    :icon="sortIcon('price')"
                    class="sort-icon"
                  />
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
                    <ion-icon
                      aria-hidden="true"
                      :icon="openOutline"
                      class="ext-icon"
                    />
                  </a>
                </td>
                <td>
                  <ion-chip
                    :color="statusChipColor(article)"
                    outline
                    class="status-chip"
                    :title="statusChipLabel(article)"
                  >
                    <span class="chip-label">{{
                      statusChipLabel(article)
                    }}</span>
                  </ion-chip>
                </td>
                <td class="col-num muted">
                  {{ formatViews(article.yesterdayViews) }}
                </td>
                <td class="col-num muted">
                  {{ viewsCell(article, article.weekViews) }}
                </td>
                <td class="col-num muted">
                  {{ viewsCell(article, article.monthViews) }}
                </td>
                <td class="col-num muted">
                  {{ viewsCell(article, article.yearViews) }}
                </td>
                <td class="col-num price">{{ priceCell(article) }}</td>
              </tr>
              <tr v-if="filteredArticles.length === 0 && !isListLoading">
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
        <!-- Carries data-tour too: only one of the two listings is ever
             visible, and the tour rings whichever that is. -->
        <div v-if="!isListLoading" data-tour="market" class="ion-hide-md-up">
          <!-- Mobile sort chips -->
          <div class="mobile-sort-row">
            <span class="sort-label">{{ t("market.sortLabel") }}</span>
            <ion-chip
              v-for="col in mobileSortOptions"
              :key="col.key"
              :color="sortKey === col.key ? 'primary' : 'medium'"
              :outline="sortKey !== col.key"
              class="sort-chip chip-clickable"
              @click="toggleSort(col.key)"
            >
              {{ col.label }}
              <ion-icon
                aria-hidden="true"
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
                      <ion-icon
                        aria-hidden="true"
                        :icon="openOutline"
                        class="ext-icon"
                      />
                    </a>
                  </div>
                  <div class="card-right">
                    <p class="card-price">{{ priceCell(article) }}</p>
                    <ion-chip
                      :color="statusChipColor(article)"
                      outline
                      class="status-chip-sm"
                      :title="statusChipLabel(article)"
                    >
                      <span class="chip-label">{{
                        statusChipLabel(article)
                      }}</span>
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
                      {{ viewsCell(article, article.weekViews) }}
                    </h6>
                  </div>
                  <div class="stat-cell">
                    <p class="stat-label">{{ t("market.colMonth") }}</p>
                    <h6 class="stat-value">
                      {{ viewsCell(article, article.monthViews) }}
                    </h6>
                  </div>
                  <div class="stat-cell">
                    <p class="stat-label">{{ t("market.colYear") }}</p>
                    <h6 class="stat-value">
                      {{ viewsCell(article, article.yearViews) }}
                    </h6>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
          </div>

          <div
            v-if="filteredArticles.length === 0 && !isListLoading"
            class="empty-mobile"
          >
            {{
              hasSearchQuery
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
              :aria-label="t('market.previousPage')"
              :disabled="safePage <= 1"
              @click="currentPage = Math.max(1, currentPage - 1)"
            >
              <ion-icon
                aria-hidden="true"
                :icon="chevronBackOutline"
                slot="icon-only"
              />
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
              :aria-label="t('market.nextPage')"
              :disabled="safePage >= totalPages"
              @click="currentPage = Math.min(totalPages, currentPage + 1)"
            >
              <ion-icon
                aria-hidden="true"
                :icon="chevronForwardOutline"
                slot="icon-only"
              />
            </ion-button>
          </div>
        </div>
      </page-reveal>
    </div>
    <!-- /page-container -->

    <article-genie
      v-if="isArticleGenieAvailable"
      :is-open="isGenieOpen"
      @results="onGenieResults"
      @close="closeGenie"
    />

    <ArticleDetail
      v-if="selectedArticle"
      :article="selectedArticle"
      :contract="selectedContract"
      :is-open="isDetailOpen"
      :on-request-trade="onRequestTrade"
      @close="closeDetail"
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
  sparklesOutline,
  swapVerticalOutline,
} from "ionicons/icons";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import NavBar from "@/layout/NavBar.vue";
import PageReveal from "@/components/PageReveal.vue";
import ArticleDetail from "@/components/ArticleDetail.vue";
import ArticleGenie from "@/components/ArticleGenie.vue";
import { storeToRefs } from "pinia";
import { useAppStore } from "@/stores/app";
import { useLeagueStore } from "@/stores/league";
import {
  useMarket,
  type SortKey,
  type StatusFilter,
} from "@/composables/useMarket";
import { useMyTeam } from "@/composables/useMyTeam";
import { useToast } from "@/composables/useToast";
import type { MarketArticle } from "@/types/market";
import type { ArticleDTO } from "../../../dto/articleDTO";
import type { ContractDTO } from "../../../dto/contractDTO";
import { formatViews, formatPrice } from "@/types/models";

const { t } = useI18n();
const { show } = useToast();
const router = useRouter();
const leagueStore = useLeagueStore();
const currentLeague = computed(() => leagueStore.currentLeague);
const { myTeam, myTeamId } = useMyTeam();

// The player's spendable balance for the active league. Sourced from the
// my-team query; falls back to a dash until it resolves so we never render a
// misleading hardcoded number.
const balanceDisplay = computed(() => {
  const credits = myTeam.value?.credits;
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
  hasSearchQuery,
  isListLoading,
  isOwnershipLoading,
  setGenieResults,
  ITEMS_PER_PAGE,
} = useMarket();

// The Article Genie is optional: a backend with no Workers AI binding says so
// on the session, and the market then shows no trace of it rather than a button
// that can only report the genie asleep (docs/development/local-dev-setup.md).
const { isArticleGenieAvailable } = storeToRefs(useAppStore());

// A full modal, owned by the component itself (as ArticleDetail does). The
// session behind it survives being dismissed, so this is only visibility.
const isGenieOpen = ref(false);

function openGenie() {
  isGenieOpen.value = true;
}

function closeGenie() {
  isGenieOpen.value = false;
}

/**
 * The findings become ordinary market rows — same price, ownership badge and
 * buy flow as everything else. Emitted as the panel dismisses, so the table
 * changes into view rather than behind a modal the player still has open.
 */
function onGenieResults(articles: MarketArticle[]) {
  setGenieResults(articles);
  closeGenie();
}

function statusChipColor(article: MarketArticle): string {
  if (!article.owner && isOwnershipLoading.value) return "medium";
  return article.owner ? "medium" : "primary";
}

function statusChipLabel(article: MarketArticle): string {
  if (!article.owner && isOwnershipLoading.value) {
    return t("market.ownershipLoading");
  }
  if (!article.owner) return t("market.freeAgent");
  if (article.ownerTeamId === myTeamId.value) {
    return t("market.yourTeam");
  }
  // The Owner Team, never the player behind it: `owner.name` is the account's
  // Google profile name (a real name for most players), and a rival's identity
  // is not the market's to publish. Every other standings surface — the
  // leaderboard, ArticleDetail's locked-by-other state — already names the team.
  return article.owner.teamName;
}

// A row from the top-read payload has its yesterday count but no view series
// yet. Its zeros are placeholders, and rendering them as "0" would read as a
// measured value — an article nobody visited — so they show as a dash until
// the per-article fetch lands.
const PENDING_CELL = "—";

function viewsCell(article: MarketArticle, views: number): string {
  return article.pending ? PENDING_CELL : formatViews(views);
}

function priceCell(article: MarketArticle): string {
  return article.pending ? PENDING_CELL : `${formatPrice(article.price)} Cr`;
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

// Buy, sell and renew are owned by ArticleDetail itself (useContractActions),
// which also invalidates every view they touch — this page only supplies the
// action no other host can implement.
// TODO: implement trade-request flow once a trade API exists. Until then the
// button acknowledges the tap instead of failing silently.
function onRequestTrade() {
  show("Not implemented yet", "medium");
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

/* One line, one height. The searchbar takes what is left after the trigger,
   which keeps its own width instead of being squeezed to its label. */
.search-row {
  --control-height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-bar {
  --border-radius: 8px;
  --color: var(--ion-text-color);
  --placeholder-color: var(--ion-color-medium);
  --placeholder-opacity: 1;
  --icon-color: var(--ion-color-medium);
  --box-shadow: none;
  padding: 0;
  flex: 1 1 auto;
  min-width: 0;
}

/* `border-box` is load-bearing: the outline lives on this element, so without it
   the 1.5px border sits outside the fixed height and the bottom edge is clipped
   away. The input then fills the container rather than being sized to the same
   number, which would overflow it by exactly those borders. */
.search-bar :deep(.searchbar-input-container) {
  border: 1.5px solid var(--ion-color-primary);
  border-radius: 8px;
  height: var(--control-height);
  box-sizing: border-box;
}

.search-bar :deep(.searchbar-input) {
  height: 100%;
  box-sizing: border-box;
}

.status-segment {
  width: 100%;
}

/* Sized like the balance pill it echoes across the page: a settled block of
   chrome rather than a button shrink-wrapped to its label. */
.genie-trigger {
  flex: 0 0 auto;
  min-width: 150px;
  height: var(--control-height);
  margin: 0;
  --border-radius: 8px;
  font-size: 0.8125rem;
  text-transform: none;
  white-space: nowrap;
}

/* Below this the two share the line only if the label goes, and a searchbar
   squeezed to a few characters is worse than a stacked pair. */
@media (max-width: 480px) {
  .search-row {
    flex-wrap: wrap;
  }

  .genie-trigger {
    flex: 1 0 100%;
  }
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

/* Team names run to 30 characters (the creation-form limit), which would
   stretch the status column past the view counts. The label truncates instead;
   the chip carries the full name as a title attribute. Wide enough that no
   fixed label ("Free Agent", "La tua squadra") is ever clipped. */
.chip-label {
  display: block;
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-chip-sm .chip-label {
  max-width: 8.5rem;
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
