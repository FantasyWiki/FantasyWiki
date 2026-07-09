<template>
  <nav-bar>
    <article class="notfound">
      <h1 class="nf-title">{{ $t("notFound.title") }}</h1>
      <p class="nf-from">{{ $t("notFound.fromLine") }}</p>

      <!-- Wikipedia-style infobox: floats right of the stub text on
           desktop, stacks above it on mobile -->
      <aside class="nf-infobox" :aria-label="$t('notFound.infobox.title')">
        <p class="nf-infobox__title">{{ $t("notFound.infobox.title") }}</p>
        <dl>
          <div class="nf-infobox__row">
            <dt>{{ $t("notFound.infobox.marketValue") }}</dt>
            <dd>{{ $t("notFound.infobox.marketValueFigure") }}</dd>
          </div>
          <div class="nf-infobox__row">
            <dt>{{ $t("notFound.infobox.contract") }}</dt>
            <dd>{{ $t("notFound.infobox.contractFigure") }}</dd>
          </div>
        </dl>
        <div class="nf-infobox__trend">
          <svg
            class="nf-sparkline"
            viewBox="0 0 120 48"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="nf-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" class="nf-sparkline__arrow" />
              </marker>
            </defs>
            <polyline
              class="nf-sparkline__line"
              points="4,8 30,16 42,10 66,30 80,26 106,42"
              marker-end="url(#nf-arrow)"
            />
          </svg>
          <ion-chip color="danger" outline class="nf-trend-chip">
            <ion-icon :icon="trendingDownOutline" />
            <ion-label>100%</ion-label>
          </ion-chip>
        </div>
      </aside>

      <p class="nf-body">
        <i18n-t keypath="notFound.body" tag="span">
          <template #path
            ><code class="nf-path">{{ attemptedPath }}</code></template
          >
          <template #citation
            ><sup class="nf-cite"
              >[{{ $t("notFound.citationNeeded") }}]</sup
            ></template
          >
        </i18n-t>
      </p>

      <div class="nf-stub-notice">
        <ion-icon :icon="constructOutline" aria-hidden="true" />
        <p>{{ $t("notFound.stubNotice") }}</p>
      </div>

      <div class="nf-actions">
        <ion-button color="primary" fill="solid" @click="router.push('/home')">
          <ion-icon slot="start" :icon="homeOutline" />
          {{ $t("notFound.ctaHome") }}
        </ion-button>
        <ion-button
          color="primary"
          fill="outline"
          @click="router.push('/market')"
        >
          <ion-icon slot="start" :icon="storefrontOutline" />
          {{ $t("notFound.ctaMarket") }}
        </ion-button>
      </div>
    </article>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { IonButton, IonChip, IonIcon, IonLabel } from "@ionic/vue";
import {
  constructOutline,
  homeOutline,
  storefrontOutline,
  trendingDownOutline,
} from "ionicons/icons";
import NavBar from "@/layout/NavBar.vue";

const route = useRoute();
const router = useRouter();

const attemptedPath = computed(() => route.path);
</script>

<style scoped>
.notfound {
  max-width: 46rem;
  margin: 1.5rem auto 2rem;
  padding: 0 0.5rem;
}

/* Wikipedia article title: serif with the classic thin rule below */
.nf-title {
  font-family: var(--font-family-headings), serif;
  font-size: clamp(1.85rem, 6vw, 2.5rem);
  font-weight: 700;
  line-height: 1.15;
  margin: 0 0 0.35rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--ion-border-color);
}

.nf-from {
  font-style: italic;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  margin: 0 0 1.25rem;
}

.nf-body {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
  max-width: 65ch;
}

.nf-path {
  font-size: 0.9em;
  padding: 0.1em 0.4em;
  border-radius: 4px;
  background: rgba(var(--ion-color-primary-rgb), 0.08);
  border: 1px solid var(--ion-border-color);
  word-break: break-all;
}

.nf-cite {
  font-size: 0.7em;
  color: var(--ion-color-primary);
  white-space: nowrap;
}

/* ── Infobox ─────────────────────────────────── */
.nf-infobox {
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  background: rgba(var(--ion-color-primary-rgb), 0.04);
  padding: 0.75rem 0.9rem;
  font-size: 0.85rem;
  margin: 0 0 1.25rem;
}

@media (min-width: 576px) {
  .nf-infobox {
    float: right;
    width: 15.5rem;
    margin: 0 0 1rem 1.5rem;
  }
}

.nf-infobox__title {
  margin: 0 0 0.5rem;
  font-family: var(--font-family-headings), serif;
  font-weight: 700;
  text-align: center;
  font-size: 0.95rem;
}

.nf-infobox dl {
  margin: 0;
}

.nf-infobox__row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.3rem 0;
}

.nf-infobox__row + .nf-infobox__row {
  border-top: 1px solid var(--ion-border-color);
}

.nf-infobox__row dt {
  color: var(--ion-color-medium);
}

.nf-infobox__row dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.nf-infobox__trend {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--ion-border-color);
  margin-top: 0.3rem;
}

.nf-sparkline {
  flex: 1;
  height: 2.5rem;
  overflow: visible;
}

/* The asset's lifetime performance: a market crash in miniature.
   Draws itself once; conveys the "dead asset" state, then stays still. */
.nf-sparkline__line {
  fill: none;
  stroke: var(--ion-color-danger);
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-dasharray: 130;
  stroke-dashoffset: 130;
  animation: nf-draw 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.15s forwards;
}

/* The arrowhead lands only once the line reaches it */
.nf-sparkline__arrow {
  fill: var(--ion-color-danger);
  opacity: 0;
  animation: nf-appear 0.2s ease-out 0.85s forwards;
}

@media (prefers-reduced-motion: reduce) {
  .nf-sparkline__line {
    animation: none;
    stroke-dashoffset: 0;
  }

  .nf-sparkline__arrow {
    animation: none;
    opacity: 1;
  }
}

@keyframes nf-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes nf-appear {
  to {
    opacity: 1;
  }
}

.nf-trend-chip {
  margin: 0;
  height: 1.6rem;
  font-size: 0.75rem;
  --background: transparent;
  flex-shrink: 0;
  pointer-events: none;
}

/* ── Stub notice ─────────────────────────────── */
.nf-stub-notice {
  clear: both;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  font-style: italic;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.nf-stub-notice ion-icon {
  font-size: 1.4rem;
  flex-shrink: 0;
  color: var(--ion-color-primary);
}

.nf-stub-notice p {
  margin: 0;
}

.nf-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.nf-actions ion-button {
  --border-radius: 0.5rem;
}
</style>
