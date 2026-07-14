<template>
  <nav-bar>
    <div class="report-page">
      <h1>{{ $t("report.title") }}</h1>

      <!-- Success replaces the form rather than firing a toast: the issue link
           is the whole point. Screenshots cannot be attached through GitHub's
           API, so we hand the reporter their issue and let GitHub's own
           uploader do it. -->
      <ion-card v-if="created" class="report-result">
        <ion-card-content>
          <ion-icon
            :icon="checkmarkCircleOutline"
            color="success"
            class="result-icon"
            aria-hidden="true"
          />
          <h2>{{ $t("report.success.title") }}</h2>
          <p>
            <i18n-t keypath="report.success.body" tag="span">
              <template #issue>
                <a :href="created.issueUrl" target="_blank" rel="noopener">
                  #{{ created.issueNumber }}
                </a>
              </template>
            </i18n-t>
          </p>
          <p class="result-hint">{{ $t("report.success.screenshotHint") }}</p>
          <ion-button
            fill="outline"
            size="small"
            :href="created.issueUrl"
            target="_blank"
            rel="noopener"
          >
            {{ $t("report.success.openIssue") }}
            <ion-icon slot="end" :icon="openOutline" />
          </ion-button>
        </ion-card-content>
      </ion-card>

      <form v-else @submit.prevent="submit">
        <p class="report-intro">{{ $t("report.intro") }}</p>

        <ion-list class="report-form" lines="full">
          <ion-item>
            <ion-select
              v-model="category"
              :label="$t('report.fields.category')"
              label-placement="stacked"
              interface="popover"
              :placeholder="$t('report.fields.categoryPlaceholder')"
            >
              <ion-select-option
                v-for="option in categoryOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-input
              v-model="title"
              :label="$t('report.fields.titleLabel')"
              label-placement="stacked"
              :placeholder="$t('report.fields.titlePlaceholder')"
              :maxlength="REPORT_TITLE_MAX_LENGTH"
              :counter="true"
            />
          </ion-item>

          <ion-item>
            <ion-textarea
              v-model="body"
              :label="$t('report.fields.bodyLabel')"
              label-placement="stacked"
              :placeholder="$t('report.fields.bodyPlaceholder')"
              :auto-grow="true"
              :rows="6"
            />
          </ion-item>

          <ion-item>
            <ion-checkbox v-model="contactConsent" justify="start">
              {{ $t("report.fields.contactConsent") }}
            </ion-checkbox>
          </ion-item>
        </ion-list>

        <!-- The consent box only ever covers this report. There is no
             newsletter, and bundling marketing into a bug form is not consent
             anyone gave knowingly. -->
        <p class="report-note">{{ $t("report.privacyNote") }}</p>

        <div v-if="errorMessage" class="report-error">
          <ion-icon :icon="alertCircleOutline" aria-hidden="true" />
          <div>
            <p>{{ errorMessage }}</p>
            <!-- If our backend could not reach GitHub, the reporter should not
                 lose what they typed: hand them GitHub's own pre-filled form.
                 Note such an issue lands unlabelled and under their own
                 account, so it will not match the user-report filter. -->
            <a
              v-if="fallbackUrl"
              :href="fallbackUrl"
              target="_blank"
              rel="noopener"
            >
              {{ $t("report.errors.fallbackLink") }}
            </a>
          </div>
        </div>

        <ion-button
          type="submit"
          expand="block"
          :disabled="!canSubmit || isSubmitting"
        >
          <ion-spinner v-if="isSubmitting" name="crescent" />
          <span v-else>{{ $t("report.submit") }}</span>
        </ion-button>

        <p v-if="cooldownRemaining > 0" class="report-note">
          {{ $t("report.cooldown", { seconds: cooldownRemaining }) }}
        </p>
      </form>
    </div>
  </nav-bar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCheckbox,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from "@ionic/vue";
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  openOutline,
} from "ionicons/icons";
import NavBar from "@/layout/NavBar.vue";
import { useProblemReport } from "@/composables/useProblemReport";
import {
  REPORT_TITLE_MAX_LENGTH,
  type ReportCategory,
} from "../../../dto/problemReportDTO";

const { t } = useI18n();

const {
  category,
  title,
  body,
  contactConsent,
  isSubmitting,
  errorMessage,
  fallbackUrl,
  created,
  cooldownRemaining,
  canSubmit,
  submit,
} = useProblemReport();

// The keys are written out as literals rather than interpolated from
// REPORT_CATEGORIES: a computed key is invisible to @intlify/no-unused-keys,
// which would then stop catching a category whose translation is genuinely
// missing. Typing the array by ReportCategory keeps it exhaustive — adding a
// category fails to compile until it is translated here.
const categoryOptions = computed<{ value: ReportCategory; label: string }[]>(
  () => [
    { value: "broken", label: t("report.categories.broken") },
    { value: "visual", label: t("report.categories.visual") },
    { value: "idea", label: t("report.categories.idea") },
    { value: "language", label: t("report.categories.language") },
    { value: "rules", label: t("report.categories.rules") },
    { value: "other", label: t("report.categories.other") },
  ]
);
</script>

<style scoped>
.report-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 0 0.5rem;
}

.report-page h1 {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.report-intro,
.report-note {
  color: var(--ion-color-medium);
  font-size: 0.8rem;
}

.report-form {
  margin: 1rem 0;
  background: transparent;
}

.report-error {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border: 1px solid var(--ion-color-danger);
  border-radius: 8px;
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  color: var(--ion-color-danger);
  font-size: 0.875rem;
}

.report-error p {
  margin: 0 0 0.25rem;
}

.report-error a {
  color: var(--ion-color-danger);
  font-weight: 600;
}

.report-result {
  text-align: center;
}

.result-icon {
  font-size: 2.5rem;
}

.result-hint {
  color: var(--ion-color-medium);
  font-size: 0.8rem;
}
</style>
