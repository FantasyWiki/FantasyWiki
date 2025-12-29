<template>
  <BaseLayout>
    <ion-text color="secondary">
      <h1>{{ $route.params.teamId }} Dashboard</h1>
    </ion-text>
    <ion-text color="tertiary">
    <p>Manage your team, track performance, and climb the leaderboard</p>
    </ion-text>
    <TeamDashboardCards></TeamDashboardCards>
  </BaseLayout>
</template>

<script setup lang="ts">
import { IonText, } from '@ionic/vue';
import BaseLayout from "@/layout/BaseLayout.vue";
import TeamDashboardCards from "@/modules/TeamDashboard/TeamDashboardCards.vue";
</script>

<style scoped>

</style>