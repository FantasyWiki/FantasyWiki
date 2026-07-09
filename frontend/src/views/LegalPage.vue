<template>
  <nav-bar>
    <div class="legal-content">
      <h1>{{ $t("legal.title") }}</h1>

      <section>
        <h2>{{ $t("legal.terms.title") }}</h2>
        <p>{{ $t("legal.terms.body") }}</p>
      </section>

      <section>
        <h2>{{ $t("legal.privacy.title") }}</h2>
        <p>{{ $t("legal.privacy.body") }}</p>
      </section>

      <section>
        <h2>{{ $t("legal.attribution.title") }}</h2>
        <p>{{ $t("legal.attribution.body") }}</p>
      </section>
    </div>
  </nav-bar>
</template>

<script setup lang="ts">
import NavBar from "@/layout/NavBar.vue";
</script>

<style scoped>
.legal-content {
  max-width: 44rem;
  margin: 0 auto;
  padding: 1rem 0.5rem 2rem;
}

h1 {
  font-size: 1.75rem;
  margin-bottom: 1.5rem;
}

h2 {
  font-size: 1.125rem;
  margin: 1.5rem 0 0.5rem;
}

p {
  margin: 0;
  line-height: 1.6;
  color: var(--ion-color-medium);
}
</style>
