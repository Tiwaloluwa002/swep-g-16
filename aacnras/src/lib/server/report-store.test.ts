import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "./db";
import { addReport, listReports, parseNewReport, updateReportStatus } from "./report-store";

const valid = { type: "flooding", description: "Water across the path", placeId: "library", lat: 7.5198, lng: 4.523 };

beforeEach(() => resetDbForTests());

describe("report store (PGlite)", () => {
  it("stores a new report as pending and lists it", async () => {
    const created = await addReport(parseNewReport(valid) as Exclude<ReturnType<typeof parseNewReport>, string>);
    expect(created.status).toBe("pending");
    expect(created.placeId).toBe("library");
    expect(created.edgeId).toBeUndefined();
    expect(await listReports()).toEqual([created]);
  });

  it("updates a report's status", async () => {
    const created = await addReport(parseNewReport(valid) as Exclude<ReturnType<typeof parseNewReport>, string>);
    const updated = await updateReportStatus(created.id, "verified");
    expect(updated?.status).toBe("verified");
    expect((await listReports())[0].status).toBe("verified");
  });

  it("returns null when updating an unknown report", async () => {
    expect(await updateReportStatus("missing", "resolved")).toBeNull();
  });

  it("rejects invalid input before it reaches the database", () => {
    expect(parseNewReport({ ...valid, type: "nope" })).toBe("Choose a report type.");
    expect(parseNewReport({ ...valid, placeId: undefined })).toBe("Choose the path or building the report is about.");
  });
});
