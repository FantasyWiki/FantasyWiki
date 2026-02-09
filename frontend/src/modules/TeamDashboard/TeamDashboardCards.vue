<template>
  <ion-grid class="ion-no-padding">
    <ion-row>
      <!-- Yesterday's Points -->
      <ion-col size="12" size-md="6" size-lg="3">
        <ion-card class="summary-card">
          <ion-card-content>
            <div class="card-header">
              <div class="card-info">
                <ion-text color="medium">
                  <p class="card-label">Yesterday's Points</p>
                </ion-text>
                <h2 class="card-value">{{ summaryData.yesterdayPoints }}</h2>
                <ion-text :color="summaryData.pointsChange >= 0 ? 'success' : 'danger'">
                  <p class="card-change">
                    {{ summaryData.pointsChange >= 0 ? '+' : '' }}{{ summaryData.pointsChange }}%
                  </p>
                </ion-text>
              </div>
              <div class="icon-wrapper icon-primary">
                <ion-icon :icon="trendingUpOutline" />
              </div>
            </div>
          </ion-card-content>
        </ion-card>
      </ion-col>

      <!-- League Standing -->
      <ion-col size="12" size-md="6" size-lg="3">
        <ion-card class="summary-card">
          <ion-card-content>
            <div class="card-header">
              <div class="card-info">
                <ion-text color="medium">
                  <p class="card-label">League Standing</p>
                </ion-text>
                <h2 class="card-value">#{{ summaryData.leagueStanding }}</h2>
                <ion-text color="medium">
                  <p class="card-subtext">of {{ summaryData.totalPlayers }} players</p>
                </ion-text>
              </div>
              <div class="icon-wrapper icon-gold">
                <ion-icon :icon="trophyOutline" />
              </div>
            </div>
          </ion-card-content>
        </ion-card>
      </ion-col>

      <!-- Credits -->
      <ion-col size="12" size-md="6" size-lg="3">
        <ion-card class="summary-card">
          <ion-card-content>
            <div class="card-header">
              <div class="card-info">
                <ion-text color="medium">
                  <p class="card-label">Available Credits</p>
                </ion-text>
                <h2 class="card-value">{{ summaryData.credits }}</h2>
                <ion-text color="medium">
                  <p class="card-subtext">Portfolio: {{ summaryData.portfolioValue }} Cr</p>
                </ion-text>
              </div>
              <div class="icon-wrapper icon-primary">
                <ion-icon :icon="cashOutline" />
              </div>
            </div>
          </ion-card-content>
        </ion-card>
      </ion-col>

      <!-- Active Contracts -->
      <ion-col size="12" size-md="6" size-lg="3">
        <ion-card class="summary-card">
          <ion-card-content>
            <div class="card-header">
              <div class="card-info">
                <ion-text color="medium">
                  <p class="card-label">Active Contracts</p>
                </ion-text>
                <h2 class="card-value">{{ summaryData.activeContracts }}/{{ summaryData.maxContracts }}</h2>
                <ion-text color="medium">
                  <p class="card-subtext">{{ summaryData.maxContracts - summaryData.activeContracts }} slots available</p>
                </ion-text>
              </div>
              <div class="icon-wrapper icon-accent">
                <ion-icon :icon="documentTextOutline" />
              </div>
            </div>
          </ion-card-content>
        </ion-card>
      </ion-col>
    </ion-row>
  </ion-grid>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonIcon,
  IonText,
} from "@ionic/vue";
import {
  trendingUpOutline,
  trophyOutline,
  cashOutline,
  documentTextOutline,
} from "ionicons/icons";

// Mock data - replace with real data from store/props
const summaryData = ref({
  yesterdayPoints: 127,
  pointsChange: 12.5,
  leagueStanding: 4,
  totalPlayers: 523,
  credits: 550,
  portfolioValue: 450,
  activeContracts: 6,
  maxContracts: 10,
});
</script>

<style scoped>
.summary-card {
  --background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  box-shadow: var(--ion-box-shadow-color) 0 2px 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ion-box-shadow-color) 0 4px 12px;
}

ion-card-content {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-info {
  flex: 1;
}

.card-label {
  font-size: 0.875rem;
  font-weight: 500;
  margin: 0 0 8px 0;
}

.card-value {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--ion-color-dark);
}

.card-change {
  font-size: 0.875rem;
  font-weight: 500;
  margin: 0;
}

.card-subtext {
  font-size: 0.875rem;
  margin: 0;
}

.icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-wrapper ion-icon {
  font-size: 24px;
}

.icon-primary {
  background: var(--ion-color-primary-tint);
  color: var(--ion-color-primary);
}

.icon-gold {
  background: rgba(245, 200, 66, 0.2);
  color: var(--wiki-gold);
}

.icon-accent {
  background: var(--ion-color-secondary-tint);
  color: var(--ion-color-secondary-shade);
}

/* Dark mode adjustments */
.ion-palette-dark .card-value {
  color: var(--ion-color-light);
}
</style>