import { describe, it, expect } from "vitest";
import { ProblemReportService } from "../../services/problemReport";
import {
  CreateIssueInput,
  CreatedIssue,
  GITHUB_ERRORS,
  GitHubClient,
} from "../../services/githubClient";
import { REPORT_ERRORS } from "../../services/problemReport";
import { Result, failure, success } from "../../repositories/result";
import { CreateProblemReportRequest } from "../../../../dto/problemReportDTO";

// The client is injected rather than module-mocked: the Workers pool silently
// ignores vi.mock, so a stub is the only reliable way to stay off the network.
class StubGitHubClient implements GitHubClient {
  calls: CreateIssueInput[] = [];

  constructor(
    private readonly response: Result<CreatedIssue> = success({
      issueNumber: 42,
      issueUrl: "https://github.com/FantasyWiki/FantasyWiki/issues/42",
    }),
  ) {}

  async createIssue(input: CreateIssueInput): Promise<Result<CreatedIssue>> {
    this.calls.push(input);
    return this.response;
  }
}

function aRequest(
  overrides: Partial<CreateProblemReportRequest> = {},
): CreateProblemReportRequest {
  return {
    category: "broken",
    title: "Market page never loads",
    body: "It spins forever after I buy a contract.",
    contactConsent: false,
    ...overrides,
  };
}

const CONTEXT = { playerId: "player-123", environment: "production" };

describe("ProblemReportService", () => {
  it("files an issue and returns its number and url", async () => {
    const github = new StubGitHubClient();
    const service = new ProblemReportService(github);

    const result = await service.submit(aRequest(), CONTEXT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toEqual({
      issueNumber: 42,
      issueUrl: "https://github.com/FantasyWiki/FantasyWiki/issues/42",
    });
    expect(github.calls).toHaveLength(1);
    expect(github.calls[0].title).toBe("Market page never loads");
  });

  it("labels every report user-report plus its category", async () => {
    const github = new StubGitHubClient();
    const service = new ProblemReportService(github);

    await service.submit(aRequest({ category: "visual" }), CONTEXT);

    expect(github.calls[0].labels).toEqual(["user-report", "bug", "visual"]);
  });

  // A locale request is a feature, but a distinctly shaped one, so it carries
  // its own label on top of `feature`.
  it("labels a language request as both feature and language", async () => {
    const github = new StubGitHubClient();
    const service = new ProblemReportService(github);

    await service.submit(aRequest({ category: "language" }), CONTEXT);

    expect(github.calls[0].labels).toEqual([
      "user-report",
      "feature",
      "language",
    ]);
  });

  it("adds contact-ok only when the reporter consented", async () => {
    const github = new StubGitHubClient();
    const service = new ProblemReportService(github);

    await service.submit(aRequest({ contactConsent: true }), CONTEXT);

    expect(github.calls[0].labels).toContain("contact-ok");
  });

  it("labels non-production reports preview so QA noise stays filterable", async () => {
    const github = new StubGitHubClient();
    const service = new ProblemReportService(github);

    await service.submit(aRequest(), { ...CONTEXT, environment: "preview" });

    expect(github.calls[0].labels).toContain("preview");
  });

  // The repository is public: an email here would be permanently indexed and
  // harvested. The opaque player id is what lets us reply, via our own DB.
  it("publishes the pseudonymous player id and never an email", async () => {
    const github = new StubGitHubClient();
    const service = new ProblemReportService(github);

    await service.submit(
      aRequest({
        contactConsent: true,
        diagnostics: { route: "/market", locale: "it", viewport: "390x844" },
      }),
      CONTEXT,
    );

    const body = github.calls[0].body;
    expect(body).toContain("player-123");
    expect(body).not.toMatch(/@[\w.]+\.\w+/);
    expect(body).toContain("<details><summary>Diagnostics</summary>");
    expect(body).toContain("- Route: /market");
    expect(body).toContain("It spins forever after I buy a contract.");
  });

  it("omits diagnostics that the client did not send", async () => {
    const github = new StubGitHubClient();
    const service = new ProblemReportService(github);

    await service.submit(
      aRequest({ diagnostics: { route: "/market" } }),
      CONTEXT,
    );

    expect(github.calls[0].body).not.toContain("- Locale:");
  });

  it.each([
    [
      "an unknown category",
      { category: "nonsense" as never },
      REPORT_ERRORS.INVALID_CATEGORY,
    ],
    ["a blank title", { title: "   " }, REPORT_ERRORS.TITLE_REQUIRED],
    [
      "an overlong title",
      { title: "x".repeat(121) },
      REPORT_ERRORS.TITLE_TOO_LONG,
    ],
    ["a blank body", { body: "  " }, REPORT_ERRORS.BODY_REQUIRED],
  ])(
    "rejects %s without calling GitHub",
    async (_name, overrides, expected) => {
      const github = new StubGitHubClient();
      const service = new ProblemReportService(github);

      const result = await service.submit(aRequest(overrides), CONTEXT);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.error).toBe(expected);
      expect(github.calls).toHaveLength(0);
    },
  );

  it("reports a submission failure when GitHub is unreachable", async () => {
    const github = new StubGitHubClient(failure(GITHUB_ERRORS.REQUEST_FAILED));
    const service = new ProblemReportService(github);

    const result = await service.submit(aRequest(), CONTEXT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toBe(REPORT_ERRORS.SUBMISSION_FAILED);
  });
});
