<template>
  <ion-grid class="stats-grid">
    <ion-row>
      <!-- Card 1: Punti (Verde) -->
      <ion-col size="12" size-md="6" size-lg="3">
        <div class="stat-card">
          <div class="card-content">
            <span class="label">Yesterday's Points</span>
            <div class="value-row">
              <h2>127</h2>
              <div class="icon-circle success">
                <ion-icon :icon="trendingUp" />
              </div>
            </div>
            <span class="subtext positive">+12.5%</span>
          </div>
        </div>
      </ion-col>

      <!-- Card 2: Ranking (Giallo) -->
      <ion-col size="12" size-md="6" size-lg="3">
        <div class="stat-card">
          <div class="card-content">
            <span class="label">League Standing</span>
            <div class="value-row">
              <h2>#4</h2>
              <div class="icon-circle warning">
                <ion-icon :icon="trophy" />
              </div>
            </div>
            <span class="subtext">of 523 players</span>
          </div>
        </div>
      </ion-col>

      <!-- Card 3: Crediti (Verde acqua) -->
      <ion-col size="12" size-md="6" size-lg="3">
        <div class="stat-card">
          <div class="card-content">
            <span class="label">Available Credits</span>
            <div class="value-row">
              <h2>550</h2>
              <div class="icon-circle info">
                <ion-icon :icon="cash" />
              </div>
            </div>
            <span class="subtext">Portfolio: 450 Cr</span>
          </div>
        </div>
      </ion-col>

      <!-- Card 4: Contratti (Bianco/Neutro) -->
      <ion-col size="12" size-md="6" size-lg="3">
        <div class="stat-card">
          <div class="card-content">
            <span class="label">Active Contracts</span>
            <div class="value-row">
              <h2>6/10</h2>
              <div class="icon-circle default">
                <ion-icon :icon="documentText" />
              </div>
            </div>
            <span class="subtext">4 slots available</span>
          </div>
        </div>
      </ion-col>
    </ion-row>
  </ion-grid>
</template>

<script setup lang="ts">
import { IonGrid, IonRow, IonCol, IonIcon } from '@ionic/vue';
import { trendingUp, trophy, cash, documentText } from 'ionicons/icons';
</script>

<style scoped>

/* Reset base per la griglia */
.stats-grid {
  padding: 0;
}

/* Stile Card Base */
.stat-card {
  background: #15201b; /* Colore scuro dal tuo mockup */
  border: 1px solid #2a3d35;
  border-radius: 16px;
  padding: 20px;
  height: 100%;
  transition: transform 0.2s;
}

.label {
  color: #8fa39a;
  font-size: 0.9rem;
  font-weight: 500;
}

.value-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  margin-bottom: 8px;
}

h2 {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

/* Icone Cerchiate */
.icon-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.icon-circle.success { background: rgba(46, 213, 115, 0.15); color: #2ed573; }
.icon-circle.warning { background: rgba(255, 171, 0, 0.15); color: #ffab00; }
.icon-circle.info    { background: rgba(50, 255, 126, 0.1); color: #7bed9f; }
.icon-circle.default { background: rgba(255, 255, 255, 0.1); color: #ffffff; }

/* Subtext */
.subtext {
  font-size: 0.85rem;
  color: #63756e;
}

.subtext.positive {
  color: #2ed573;
}
</style>
