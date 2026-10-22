import type { Report, ReportStatus, ReportType } from "./types";

export const REPORT_TYPES: Record<ReportType, string> = {
  blocked: "Path blocked",
  construction: "Construction work",
  flooding: "Flooding or waterlogging",
  "broken-lift": "Lift not working",
  "broken-ramp": "Ramp damaged or blocked",
  other: "Other hazard",
};

export const REPORT_STATUSES: Record<ReportStatus, string> = {
  pending: "Awaiting review",
  verified: "Verified",
  rejected: "Rejected",
  resolved: "Resolved",
};

/** Report types that make a path segment unusable once verified. */
const BLOCKING_TYPES = new Set<ReportType>(["blocked", "construction", "flooding", "broken-ramp"]);

/** Active reports: still relevant to people moving around campus. */
export function isActive(report: Report): boolean {
  return report.status === "pending" || report.status === "verified";
}

/** Path segments routing must avoid: verified, blocking reports only. */
export function blockedEdgeIds(reports: Report[]): Set<string> {
  return new Set(
    reports
      .filter((r) => r.status === "verified" && r.edgeId && BLOCKING_TYPES.has(r.type))
      .map((r) => r.edgeId!),
  );
}

export function describeReport(report: Report): string {
  const label = REPORT_TYPES[report.type];
  const prefix = report.status === "verified" ? "Verified" : "Unverified report";
  return report.description ? `${prefix}: ${label}. ${report.description}` : `${prefix}: ${label}.`;
}
