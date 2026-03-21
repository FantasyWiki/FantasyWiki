<template>
  <ion-grid class="summary-grid ion-no-padding">
    <ion-row>
      <!-- Yesterday's Points -->
      <ion-col size="6" size-md="3">
        <ion-card class="stat-card" @click="() => {}">
          <ion-card-content class="stat-card-content">
            <div class="stat-icon-wrapper stat-icon--primary">
              <ion-icon :icon="trendingUpOutline" />
            </div>
            <div class="stat-body">
              <ion-text color="medium">
                <p class="stat-label ion-no-margin">Yesterday's Points</p>
              </ion-text>

              <!-- Value or skeleton -->
              <ion-skeleton-text
                v-if="!props.summaryData"
                :animated="true"
                class="stat-skeleton"
              />
              <h2 v-else class="stat-value ion-no-margin">
                {{ props.summaryData.yesterdayPoints }}
              </h2>

              <ion-chip
                v-if="props.summaryData"
                :color="
                  props.summaryData.pointsChange >= 0 ? 'success' : 'danger'
                "
                class="stat-change-chip"
                outline
              >
                <ion-icon
                  :icon="
                    props.summaryData.pointsChange >= 0
                      ? arrowUpOutline
                      : arrowDownOutline
                  "
                />
                <ion-label>
                  {{ props.summaryData.pointsChange >= 0 ? "+" : ""
                  }}{{ props.summaryData.pointsChange }}%
                </ion-label>
              </ion-chip>
            </div>
          </ion-card-content>
        </ion-card>
      </ion-col>

      <!-- League Standing -->
      <ion-col size="6" size-md="3">
        <ion-card class="stat-card">
          <ion-card-content class="stat-card-content">
            <div class="stat-icon-wrapper stat-icon--gold">
              <ion-icon :icon="trophyOutline" />
            </div>
            <div class="stat-body">
              <ion-text color="medium">
                <p class="stat-label ion-no-margin">League Standing</p>
              </ion-text>

              <ion-skeleton-text
                v-if="!props.summaryData"
                :animated="true"
                class="stat-skeleton"
              />
              <h2 v-else class="stat-value ion-no-margin">
                #{{ props.summaryData.rank }}
              </h2>

              <ion-text v-if="props.summaryData" color="medium">
                <p class="stat-sub ion-no-margin">
                  of {{ props.summaryData.totalPlayers }} players
                </p>
              </ion-text>
            </div>
          </ion-card-content>
        </ion-card>
      </ion-col>

      <!-- Available Credits -->
      <ion-col size="6" size-md="3">
        <ion-card class="stat-card">
          <ion-card-content class="stat-card-content">
            <div class="stat-icon-wrapper stat-icon--primary">
              <ion-icon :icon="cashOutline" />
            </div>
            <div class="stat-body">
              <ion-text color="medium">
                <p class="stat-label ion-no-margin">Available Credits</p>
              </ion-text>

              <ion-skeleton-text
                v-if="!props.summaryData"
                :animated="true"
                class="stat-skeleton"
              />
              <h2 v-else class="stat-value ion-no-margin">
                {{ props.summaryData.credits }}
              </h2>

              <ion-text v-if="props.summaryData" color="medium">
                <p class="stat-sub ion-no-margin">
                  Portfolio: {{ props.summaryData.portfolioValue }} Cr
                </p>
              </ion-text>
            </div>
          </ion-card-content>
        </ion-card>
      </ion-col>

      <!-- Active Contracts -->
      <ion-col size="6" size-md="3">
        <ion-card class="stat-card">
          <ion-card-content class="stat-card-content">
            <div class="stat-icon-wrapper stat-icon--accent">
              <ion-icon :icon="documentTextOutline" />
            </div>
            <div class="stat-body">
              <ion-text color="medium">
                <p class="stat-label ion-no-margin">Active Contracts</p>
              </ion-text>

              <ion-skeleton-text
                v-if="!props.summaryData"
                :animated="true"
                class="stat-skeleton"
              />
              <h2 v-else class="stat-value ion-no-margin">
                {{ props.summaryData.activeContracts }}/{{ maxContracts }}
              </h2>

              <ion-text v-if="props.summaryData" color="medium">
                <p class="stat-sub ion-no-margin">
                  {{ maxContracts - props.summaryData.activeContracts }} slots
                  available
                </p>
              </ion-text>
            </div>
          </ion-card-content>
        </ion-card>
      </ion-col>
    </ion-row>
  </ion-grid>
</template>

<script setup lang="ts">
import {
  IonCard,
  IonCardContent,
  IonChip,
  IonCol,
  IonGrid,
  IonIcon,
  IonLabel,
  IonRow,
  IonSkeletonText,
  IonText,
} from "@ionic/vue";
import {
  arrowDownOutline,
  arrowUpOutline,
  cashOutline,
  documentTextOutline,
  trendingUpOutline,
  trophyOutline,
} from "ionicons/icons";
import type { DashboardSummary } from "@/types/models";

interface Props {
  summaryData: DashboardSummary | null;
}

const props = defineProps<Props>();
const maxContracts = 18;
</script>

<style scoped>
/* ── Grid ──────────────────────────────────────── */
.summary-grid {
  margin-bottom: 1.5rem;
}

/* ── Card base ─────────────────────────────────── */
.stat-card {
  --background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  border-radius: 0.875rem;
  box-shadow: 0 2px 8px var(--ion-box-shadow-color);
  margin: 0 0 0.75rem 0;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px var(--ion-box-shadow-color);
}

.stat-card-content {
  padding: 1rem !important;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

/* ── Icon wrappers ─────────────────────────────── */
.stat-icon-wrapper {
  width: 2.75rem;
  height: 2.75rem;
  min-width: 2.75rem;
  border-radius: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon-wrapper ion-icon {
  font-size: 1.25rem;
}

.stat-icon--primary {
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
}

.stat-icon--gold {
  background: rgba(var(--ion-color-wiki-gold-rgb), 0.18);
  color: var(--ion-color-wiki-gold);
}

.stat-icon--accent {
  background: rgba(var(--ion-color-secondary-rgb), 0.25);
  color: var(--ion-color-secondary-shade);
}

/* ── Body ──────────────────────────────────────── */
.stat-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-value {
  font-family: var(--font-family-headings);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--ion-color-dark);
  line-height: 1.15;
  margin-top: 2px;
}

.stat-sub {
  font-size: 0.72rem;
  margin-top: 2px;
}

.stat-skeleton {
  height: 2rem;
  border-radius: 4px;
  margin-top: 4px;
  max-width: 80px;
}

/* ── Change chip ───────────────────────────────── */
.stat-change-chip {
  align-self: flex-start;
  height: 1.4rem;
  font-size: 0.7rem;
  margin-top: 4px;
  --background: transparent;
}

.stat-change-chip ion-icon {
  font-size: 0.75rem;
}

/* ── Dark mode ─────────────────────────────────── */
.ion-palette-dark .stat-value {
  color: var(--ion-color-light);
}

/* ── Responsive: compact on mobile ────────────── */
@media (max-width: 575px) {
  .stat-card-content {
    flex-direction: column;
    gap: 0.5rem;
  }

  .stat-icon-wrapper {
    width: 2.25rem;
    height: 2.25rem;
    min-width: 2.25rem;
  }

  .stat-value {
    font-size: 1.35rem;
  }
}
</style>
