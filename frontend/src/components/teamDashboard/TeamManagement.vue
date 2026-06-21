<template>
  <ion-card class="dashboard-card td-card">
    <ion-card-header>
      <div class="dashboard-header td-header">
        <div class="header-left td-header-left">
          <div class="icon-wrapper td-header-icon td-header-icon--secondary">
            <ion-icon :icon="layersOutline" color="primary" />
          </div>
          <div>
            <ion-card-title class="td-card-title">{{
              $t("dashboard.teamManagement.title")
            }}</ion-card-title>
            <ion-card-subtitle>
              <span>{{ props.formation.schema }}</span>
            </ion-card-subtitle>
          </div>
        </div>

        <ion-button
          fill="outline"
          size="small"
          color="primary"
          router-link="/team"
        >
          {{ $t("dashboard.teamManagement.manage") }}
          <ion-icon slot="end" :icon="arrowForwardOutline" />
        </ion-button>
      </div>
    </ion-card-header>

    <ion-card-content class="ion-padding">
      <team-formation
        :formation="props.formation"
        :swap-mode="false"
        @article-click="handleArticleClick"
      />
    </ion-card-content>
  </ion-card>

  <!-- ── Article detail modal ──────────────────────────────────────── -->
  <ArticleDetail
    v-if="selectedContract"
    :selected-contract="selectedContract"
    :is-open="isDetailOpen"
    @close="closeDetail"
  />
</template>

<script setup lang="ts">
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonIcon,
} from "@ionic/vue";
import { arrowForwardOutline, layersOutline } from "ionicons/icons";
import { DraftFormationDTO } from "../../../../dto/formationDTO";
import TeamFormation from "@/components/formation/TeamFormation.vue";
import ArticleDetail from "@/components/ArticleDetail.vue";
import { ref } from "vue";
import type { ContractDTO } from "../../../../dto/contractDTO";

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  formation: DraftFormationDTO;
}

const props = defineProps<Props>();

// ── Article detail dialog ─────────────────────────────────────────────────
const selectedContract = ref<ContractDTO | null>(null);
const isDetailOpen = ref(false);

function closeDetail() {
  isDetailOpen.value = false;
}

function handleArticleClick(article: ContractDTO) {
  selectedContract.value = article;
  isDetailOpen.value = true;
}
</script>

<style scoped src="src/components/teamDashboard/team-dashboard.css"></style>
