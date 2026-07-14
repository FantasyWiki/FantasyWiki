import { computed, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { ApiError, reportsApi } from "@/services/api";
import type {
  ProblemReportCreatedDTO,
  ReportCategory,
} from "../../../dto/problemReportDTO";

const REPO_URL = "https://github.com/FantasyWiki/FantasyWiki";
const COOLDOWN_KEY = "report:lastSubmittedAt";

/**
 * Mirrors the server's 60s rate-limit window. This is a courtesy, not a control
 * — it stops double-clicks and impulsive repeats. The Cloudflare rate-limit
 * binding is what actually protects the shared GitHub token.
 */
export const COOLDOWN_SECONDS = 60;

/**
 * Form state and submission for the problem report page (issue #439). Lives in
 * a composable so the submit/fallback logic is testable without driving Ionic's
 * web components through jsdom.
 */
export function useProblemReport() {
  const { t, locale } = useI18n();
  const router = useRouter();

  const category = ref<ReportCategory | undefined>();
  const title = ref("");
  const body = ref("");
  const contactConsent = ref(false);

  const isSubmitting = ref(false);
  const errorMessage = ref("");
  const fallbackUrl = ref("");
  const created = ref<ProblemReportCreatedDTO | null>(null);

  // The route the reporter came from is the most useful thing in the
  // diagnostics, and it is lost the moment they navigate to /report.
  const back = router.options.history.state.back;
  const previousRoute = typeof back === "string" ? back : "";

  const cooldownRemaining = ref(0);
  const cooldownTimer = setInterval(refreshCooldown, 1000);
  refreshCooldown();
  onUnmounted(() => clearInterval(cooldownTimer));

  function refreshCooldown() {
    const last = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0);
    const elapsed = (Date.now() - last) / 1000;
    cooldownRemaining.value = Math.max(
      0,
      Math.ceil(COOLDOWN_SECONDS - elapsed)
    );
  }

  const canSubmit = computed(
    () =>
      Boolean(category.value) &&
      title.value.trim().length > 0 &&
      body.value.trim().length > 0 &&
      cooldownRemaining.value === 0
  );

  /**
   * GitHub's web form accepts a pre-filled issue via query params, so a backend
   * outage never costs the reporter their words. `labels` is ignored for users
   * without triage rights, so a fallback issue arrives unlabelled and authored
   * by the reporter — it will not match the `user-report` filter.
   */
  function buildFallbackUrl(): string {
    const params = new URLSearchParams({
      title: title.value.trim(),
      body: body.value.trim(),
    });
    return `${REPO_URL}/issues/new?${params.toString()}`;
  }

  async function submit() {
    if (!canSubmit.value || !category.value) return;

    isSubmitting.value = true;
    errorMessage.value = "";
    fallbackUrl.value = "";

    try {
      created.value = await reportsApi.create({
        category: category.value,
        title: title.value.trim(),
        body: body.value.trim(),
        contactConsent: contactConsent.value,
        diagnostics: {
          route: previousRoute || undefined,
          locale: locale.value,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          userAgent: navigator.userAgent,
        },
      });
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      refreshCooldown();
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;

      if (status === 429) {
        // Our own limiter said no. Deliberately no GitHub bypass here — that
        // would defeat the throttle we just applied.
        errorMessage.value = t("report.errors.rateLimited");
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
        refreshCooldown();
      } else if (status === 400) {
        errorMessage.value = t("report.errors.invalid");
      } else {
        errorMessage.value = t("report.errors.submissionFailed");
        fallbackUrl.value = buildFallbackUrl();
      }
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
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
  };
}
