<template>
  <nav-bar>
    <div class="ion-text-center">
      <h1>Test Navbar Mode</h1>
      <p>Scorri per testare l'effetto blur!</p>
      <p v-for="i in 20" :key="i">Riga di contenuto {{ i }}</p>
      <p v-for="i in 50" :key="i">
        <ion-button>
          Riga di contenuto {{ i }}
        </ion-button>
      </p>
    </div>
  </nav-bar>
</template>

<script setup lang="ts">
import NavBar from '@/layout/NavBar.vue';
import { IonButton } from '@ionic/vue';
</script>
