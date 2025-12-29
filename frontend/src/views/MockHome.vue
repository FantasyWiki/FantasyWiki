<template>
  <base-layout>
      <div style="padding: 20px; text-align: center;">
        <h1>Test Navbar Mode</h1>
        <p>Scorri per testare l'effetto blur!</p>
        <p v-for="i in 20" :key="i">Riga di contenuto {{ i }}</p>
        <p v-for="i in 50" :key="i">
          <ion-button>
            Riga di contenuto {{ i }}
          </ion-button>
        </p>
      </div>
  </base-layout>

</template>

<script setup lang="ts">
import BaseLayout from "@/layout/BaseLayout.vue";
</script>
