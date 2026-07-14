/**
 * A problem report filed from inside the app. It becomes a GitHub issue on the
 * project repository — see docs/adr for why reports live in the issue tracker
 * rather than in D1, and why the reporter is identified pseudonymously.
 */

/**
 * User-facing categories. They describe the kind of problem in the player's own
 * words, deliberately not the subsystem it belongs to — a player should not have
 * to know the architecture to file a bug. Maintainers add subsystem labels
 * (contract-flow, etc.) during triage.
 */
export const REPORT_CATEGORIES = [
  "broken",
  "visual",
  "idea",
  "language",
  "rules",
  "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export function isReportCategory(value: unknown): value is ReportCategory {
  return REPORT_CATEGORIES.includes(value as ReportCategory);
}

export const REPORT_TITLE_MAX_LENGTH = 120;

/**
 * Context collected by the client, not typed by the player. Everything here is
 * safe to publish: the reporter is referenced by their opaque player id, never
 * by email.
 */
export interface ReportDiagnosticsDTO {
  /** The route the reporter was on before opening the report form. */
  route?: string;
  locale?: string;
  viewport?: string;
  userAgent?: string;
}

export interface CreateProblemReportRequest {
  category: ReportCategory;
  title: string;
  body: string;
  /** Consent to be contacted about *this report*. Never a marketing opt-in. */
  contactConsent: boolean;
  diagnostics?: ReportDiagnosticsDTO;
}

export interface ProblemReportCreatedDTO {
  issueNumber: number;
  issueUrl: string;
}
