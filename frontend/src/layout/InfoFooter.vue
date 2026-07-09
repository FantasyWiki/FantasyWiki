<template>
  <footer class="info-footer">
    <nav class="footer-links">
      <!-- TODO: point to the GitHub Pages site once the report and the
           user guide are published there. -->
      <a :href="`${REPO_URL}#readme`" target="_blank" rel="noopener">
        {{ $t("footer.technicalDocs") }}
      </a>
      <span aria-hidden="true">·</span>
      <a :href="`${REPO_URL}/tree/master/docs`" target="_blank" rel="noopener">
        {{ $t("footer.userGuide") }}
      </a>
      <span aria-hidden="true">·</span>
      <a :href="REPO_URL" target="_blank" rel="noopener">
        <ion-icon :icon="logoGithub" aria-hidden="true" />
        GitHub
      </a>
      <span aria-hidden="true">·</span>
      <a :href="`${REPO_URL}/issues`" target="_blank" rel="noopener">
        {{ $t("footer.reportProblem") }}
      </a>
      <span aria-hidden="true">·</span>
      <router-link to="/legal">{{ $t("footer.legal") }}</router-link>
    </nav>
    <p class="footer-credits">
      © {{ new Date().getFullYear() }} FantasyWiki ·
      {{ $t("footer.madeBy") }}
      <a href="https://github.com/Fre0Grella" target="_blank" rel="noopener">
        Marco Galeri
      </a>
      {{ $t("footer.and") }}
      <a
        href="https://github.com/luca-patrignani"
        target="_blank"
        rel="noopener"
      >
        Luca Patrignani
      </a>
    </p>
  </footer>
</template>

<script setup lang="ts">
import { IonIcon } from "@ionic/vue";
import { logoGithub } from "ionicons/icons";

const REPO_URL = "https://github.com/FantasyWiki/FantasyWiki";
</script>

<style scoped>
.info-footer {
  margin-top: 3rem;
  padding: 1.25rem 0.5rem;
  border-top: 1px solid var(--ion-border-color);
  text-align: center;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  column-gap: 0.6rem;
  row-gap: 0.35rem;
}

.footer-links a {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--ion-color-medium);
  text-decoration: none;
}

.footer-links a:hover {
  color: var(--ion-color-primary);
}

.footer-links ion-icon {
  font-size: 1rem;
}

.footer-credits {
  margin: 0.6rem 0 0;
  font-size: 0.75rem;
}

.footer-credits a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.footer-credits a:hover {
  color: var(--ion-color-primary);
}
</style>
