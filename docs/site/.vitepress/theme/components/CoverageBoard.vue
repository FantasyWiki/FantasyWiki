<script setup lang="ts">
import { computed } from "vue";
import coverage from "@generated/coverage.json";

/**
 * Line coverage per package, read from the reports the test suites actually
 * wrote — istanbul's JSON summary for the two TypeScript packages, Kover's
 * JaCoCo XML for the Kotlin one.
 *
 * A package with no report says so. Showing an unmeasured package as 0% would
 * be a false claim about the tests, and quietly leaving it out would be a false
 * claim about the project.
 */

interface Metric {
  covered: number;
  total: number;
  pct: number;
}

interface Package {
  id: string;
  name: string;
  runtime: string;
  note: string;
  measured: boolean;
  lines?: Metric;
  statements?: Metric;
  branches?: Metric;
  functions?: Metric;
  files?: number;
}

const packages = coverage.packages as Package[];
const gate = coverage.gate as number;
const combined = coverage.combined as Metric | undefined;

const generated = computed(() =>
  new Date(coverage.generatedAt).toLocaleString("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }),
);

/**
 * Green above the gate, gold just under it, red well below. Three bands rather
 * than a gradient, because the only decision this number drives is binary and a
 * gradient would imply a precision the number does not have.
 */
function band(pct: number) {
  if (pct >= gate) return "var(--fw-type-domain)";
  if (pct >= gate - 20) return "var(--fw-gold-dark)";
  return "var(--vp-c-danger-1)";
}

const ARC = 2 * Math.PI * 52;

function dash(pct: number) {
  return `${(pct / 100) * ARC} ${ARC}`;
}
</script>

<template>
  <div class="cov">
    <header v-if="combined" class="cov__summary">
      <svg class="cov__dial" viewBox="0 0 120 120" role="img" aria-label="Combined line coverage">
        <circle cx="60" cy="60" r="52" class="cov__track" />
        <circle
          cx="60"
          cy="60"
          r="52"
          class="cov__value"
          :stroke="band(combined.pct)"
          :stroke-dasharray="dash(combined.pct)"
        />
        <text x="60" y="58" class="cov__dial-number">{{ combined.pct }}%</text>
        <text x="60" y="76" class="cov__dial-label">lines</text>
      </svg>

      <div>
        <span class="fw-eyebrow">Across every measured package</span>
        <p class="cov__lead">
          <strong>{{ combined.covered.toLocaleString("en-GB") }}</strong> of
          <strong>{{ combined.total.toLocaleString("en-GB") }}</strong> executable lines are
          exercised by the test suites. Codecov gates the project at
          <strong>{{ gate }}%</strong> overall and does not gate the changed lines of a
          pull request on their own.
        </p>
        <p class="cov__meta">Measured {{ generated }} UTC, on the revision that built this page.</p>
      </div>
    </header>

    <div class="cov__packages">
      <article v-for="pkg in packages" :key="pkg.id" class="fw-card cov__package">
        <header class="cov__head">
          <div>
            <h3>{{ pkg.name }}</h3>
            <span class="cov__runtime">{{ pkg.runtime }}</span>
          </div>
          <span v-if="pkg.measured && pkg.lines" class="cov__pct" :style="{ color: band(pkg.lines.pct) }">
            {{ pkg.lines.pct }}%
          </span>
          <span v-else class="cov__pct cov__pct--none">—</span>
        </header>

        <template v-if="pkg.measured && pkg.lines">
          <div class="cov__bar" role="img" :aria-label="`${pkg.lines.pct}% of lines covered`">
            <span :style="{ width: `${pkg.lines.pct}%`, background: band(pkg.lines.pct) }" />
          </div>

          <dl class="cov__metrics">
            <div v-for="key in (['lines', 'branches', 'functions'] as const)" :key="key">
              <dt>{{ key }}</dt>
              <dd>
                {{ pkg[key]?.pct }}%
                <small>{{ pkg[key]?.covered }}/{{ pkg[key]?.total }}</small>
              </dd>
            </div>
          </dl>
        </template>

        <p v-else class="cov__absent">
          No report was published with this build. The number is unknown, not zero.
        </p>

        <p class="cov__note">{{ pkg.note }}</p>
      </article>
    </div>
  </div>
</template>

<style scoped>
.cov {
  margin: 1.5rem 0;
}

.cov__summary {
  display: flex;
  align-items: center;
  gap: 1.4rem;
  padding: 1.2rem 1.4rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--fw-radius-md);
  background: var(--vp-c-bg-alt);
  margin-bottom: 1rem;
}

.cov__dial {
  width: 118px;
  height: 118px;
  flex: none;
  transform: rotate(-90deg);
}

.cov__track {
  fill: none;
  stroke: var(--vp-c-divider);
  stroke-width: 9;
}

.cov__value {
  fill: none;
  stroke-width: 9;
  stroke-linecap: round;
}

.cov__dial-number,
.cov__dial-label {
  transform: rotate(90deg);
  transform-origin: 60px 60px;
  text-anchor: middle;
}

.cov__dial-number {
  font-family: "Libre Baskerville", Georgia, serif;
  font-size: 22px;
  font-weight: 700;
  fill: var(--vp-c-text-1);
}

.cov__dial-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  fill: var(--vp-c-text-3);
}

.cov__lead {
  margin: 0.35rem 0 0.5rem;
  line-height: 1.6;
}

.cov__meta {
  margin: 0;
  font-size: 0.78rem;
  color: var(--vp-c-text-3);
}

.cov__packages {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.cov__package {
  display: flex;
  flex-direction: column;
}

.cov__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
}

.cov__head h3 {
  margin: 0;
  font-family: "Libre Baskerville", Georgia, serif;
  font-size: 1rem;
}

.cov__runtime {
  font-size: 0.74rem;
  color: var(--vp-c-text-3);
}

.cov__pct {
  font-family: "Libre Baskerville", Georgia, serif;
  font-size: 1.55rem;
  font-weight: 700;
  line-height: 1;
}

.cov__pct--none {
  color: var(--vp-c-text-3);
}

.cov__bar {
  height: 7px;
  margin: 0.8rem 0 0.7rem;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  overflow: hidden;
}

.cov__bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
}

.cov__metrics {
  display: flex;
  gap: 1rem;
  margin: 0 0 0.7rem;
}

.cov__metrics dt {
  font-size: 0.64rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.cov__metrics dd {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.cov__metrics small {
  display: block;
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--vp-c-text-3);
}

.cov__absent {
  margin: 0.8rem 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-3);
}

.cov__note {
  margin: auto 0 0;
  padding-top: 0.7rem;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

@media (max-width: 620px) {
  .cov__summary {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
