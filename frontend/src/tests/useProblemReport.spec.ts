import { describe, it, expect, beforeEach } from "vitest";
import { defineComponent } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import router from "@/router/index";
import { useProblemReport } from "@/composables/useProblemReport";

type Report = ReturnType<typeof useProblemReport>;

/**
 * The composable needs a component context (onUnmounted, i18n, router), so it
 * is mounted inside a host rather than called bare. Testing it here instead of
 * through the page keeps us off Ionic's web components, which jsdom does not
 * render faithfully.
 */
function mountComposable(): Report {
  let api!: Report;
  const Host = defineComponent({
    setup() {
      api = useProblemReport();
      return () => null;
    },
  });
  mount(Host, { global: { plugins: [router] } });
  return api;
}

function fillIn(report: Report) {
  report.category.value = "broken";
  report.title.value = "Market never loads";
  report.body.value = "It spins forever after I buy a contract.";
}

describe("useProblemReport", () => {
  beforeEach(async () => {
    localStorage.clear();
    await router.push("/");
    await router.isReady();
  });

  it("will not submit until a category, a title and a body are present", () => {
    const report = mountComposable();
    expect(report.canSubmit.value).toBe(false);

    report.category.value = "broken";
    report.title.value = "Market never loads";
    expect(report.canSubmit.value).toBe(false);

    report.body.value = "It spins forever.";
    expect(report.canSubmit.value).toBe(true);
  });

  it("returns the created issue so the reporter can attach a screenshot to it", async () => {
    const report = mountComposable();
    fillIn(report);

    await report.submit();
    await flushPromises();

    expect(report.created.value).toEqual({
      issueNumber: 1234,
      issueUrl: "https://github.com/FantasyWiki/FantasyWiki/issues/1234",
    });
    expect(report.errorMessage.value).toBe("");
    // The cooldown starts, so a double-click cannot file a second issue.
    expect(report.cooldownRemaining.value).toBeGreaterThan(0);
    expect(report.canSubmit.value).toBe(false);
  });

  // A backend outage must never cost the reporter their words.
  it("offers a pre-filled GitHub link when the report cannot be filed", async () => {
    server.use(
      http.post("*/api/reports", () =>
        HttpResponse.json(
          { error: "REPORT_SUBMISSION_FAILED" },
          { status: 502 }
        )
      )
    );

    const report = mountComposable();
    fillIn(report);

    await report.submit();
    await flushPromises();

    expect(report.created.value).toBeNull();
    expect(report.errorMessage.value).not.toBe("");
    expect(report.fallbackUrl.value).toContain(
      "github.com/FantasyWiki/FantasyWiki/issues/new"
    );
    expect(report.fallbackUrl.value).toContain("Market+never+loads");
    // What they typed is still there.
    expect(report.title.value).toBe("Market never loads");
  });

  // Our own throttle must not hand out a bypass — that would defeat it.
  it("shows a cooldown and no GitHub bypass when rate limited", async () => {
    server.use(
      http.post("*/api/reports", () =>
        HttpResponse.json({ error: "REPORT_RATE_LIMITED" }, { status: 429 })
      )
    );

    const report = mountComposable();
    fillIn(report);

    await report.submit();
    await flushPromises();

    expect(report.errorMessage.value).not.toBe("");
    expect(report.fallbackUrl.value).toBe("");
    expect(report.cooldownRemaining.value).toBeGreaterThan(0);
  });
});
