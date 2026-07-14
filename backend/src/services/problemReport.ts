import {
  CreateProblemReportRequest,
  ProblemReportCreatedDTO,
  REPORT_TITLE_MAX_LENGTH,
  ReportCategory,
  ReportDiagnosticsDTO,
  isReportCategory,
} from "../../../dto/problemReportDTO";
import { Result, failure, success } from "../repositories/result";
import { GitHubClient } from "./githubClient";

export const REPORT_ERRORS = {
  MALFORMED_BODY: "REPORT_MALFORMED_BODY",
  INVALID_CATEGORY: "REPORT_INVALID_CATEGORY",
  TITLE_REQUIRED: "REPORT_TITLE_REQUIRED",
  TITLE_TOO_LONG: "REPORT_TITLE_TOO_LONG",
  BODY_REQUIRED: "REPORT_BODY_REQUIRED",
  SUBMISSION_FAILED: "REPORT_SUBMISSION_FAILED",
} as const;

/** Applied to every report, so maintainers can filter their own issues out. */
export const USER_REPORT_LABEL = "user-report";
/** Marks the reporter as willing to be contacted about this report. */
export const CONTACT_CONSENT_LABEL = "contact-ok";
/** Keeps QA noise from the preview Worker filterable and bulk-deletable. */
export const PREVIEW_LABEL = "preview";

const CATEGORY_LABELS: Record<ReportCategory, string[]> = {
  broken: ["bug"],
  visual: ["bug", "visual"],
  idea: ["feature"],
  // A locale request is a feature, but one with a very different shape of work,
  // so it stays filterable on its own.
  language: ["feature", "language"],
  rules: ["question"],
  other: [],
};

export interface ProblemReportContext {
  /** Opaque players.id. Published in the issue; the email never is. */
  playerId: string;
  /** Anything other than "production" adds the preview label. */
  environment: string;
}

export class ProblemReportService {
  constructor(private readonly github: GitHubClient) {}

  async submit(
    request: CreateProblemReportRequest,
    context: ProblemReportContext,
  ): Promise<Result<ProblemReportCreatedDTO>> {
    const validation = validate(request);
    if (!validation.ok) {
      return validation;
    }

    const result = await this.github.createIssue({
      title: request.title.trim(),
      body: buildIssueBody(request, context),
      labels: buildLabels(request, context),
    });

    // The client's error is not the caller's business: the route only needs to
    // know the report did not get filed, so it can offer the GitHub fallback.
    return result.ok
      ? success(result.value)
      : failure(REPORT_ERRORS.SUBMISSION_FAILED);
  }
}

function validate(request: CreateProblemReportRequest): Result<true> {
  if (!isReportCategory(request.category)) {
    return failure(REPORT_ERRORS.INVALID_CATEGORY);
  }

  const title = request.title?.trim() ?? "";
  if (title.length === 0) {
    return failure(REPORT_ERRORS.TITLE_REQUIRED);
  }
  if (title.length > REPORT_TITLE_MAX_LENGTH) {
    return failure(REPORT_ERRORS.TITLE_TOO_LONG);
  }

  // #439 left the description optional. A title-only report costs a round trip
  // we usually cannot make — the reporter is pseudonymous — so it is required.
  if ((request.body?.trim() ?? "").length === 0) {
    return failure(REPORT_ERRORS.BODY_REQUIRED);
  }

  return success(true);
}

export function buildLabels(
  request: CreateProblemReportRequest,
  context: ProblemReportContext,
): string[] {
  const labels = [USER_REPORT_LABEL, ...CATEGORY_LABELS[request.category]];
  if (request.contactConsent) {
    labels.push(CONTACT_CONSENT_LABEL);
  }
  if (context.environment !== "production") {
    labels.push(PREVIEW_LABEL);
  }
  return labels;
}

/**
 * The diagnostics block is collapsed so it does not bury the reporter's own
 * words, and carries only the opaque player id — the repository is public, so
 * an email here would be permanently indexed and harvested. To reply, look the
 * id up against google_accounts server-side.
 */
export function buildIssueBody(
  request: CreateProblemReportRequest,
  context: ProblemReportContext,
): string {
  const diagnostics = request.diagnostics ?? {};
  const lines = [
    request.body.trim(),
    "",
    "<details><summary>Diagnostics</summary>",
    "",
    ...diagnosticLines(diagnostics),
    `- Reporter: player \`${context.playerId}\``,
    `- Contact consent: ${request.contactConsent ? "yes" : "no"}`,
    `- Environment: ${context.environment}`,
    "",
    "</details>",
    "",
    "_Filed from the in-app report form._",
  ];
  return lines.join("\n");
}

function diagnosticLines(diagnostics: ReportDiagnosticsDTO): string[] {
  const entries: [string, string | undefined][] = [
    ["Route", diagnostics.route],
    ["Locale", diagnostics.locale],
    ["Viewport", diagnostics.viewport],
    ["User agent", diagnostics.userAgent],
  ];
  return entries
    .filter(([, value]) => value)
    .map(([label, value]) => `- ${label}: ${value}`);
}
