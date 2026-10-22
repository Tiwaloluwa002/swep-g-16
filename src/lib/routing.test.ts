import { describe, expect, it } from "vitest";
import { places } from "@/data/campus";
import { planRoute } from "./advisory";
import { edgeById, nodeById } from "./graph";
import { PROFILE_LIST } from "./profiles";
import { findPath } from "./routing";
import type { Report, RouteOptions } from "./types";

const standard: RouteOptions = { profile: "standard", avoidUnlit: false };
const wheelchair: RouteOptions = { profile: "wheelchair", avoidUnlit: false };

const report = (overrides: Partial<Report>): Report => ({
  id: "r1",
  type: "blocked",
  description: "",
  lat: 0,
  lng: 0,
  status: "verified",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("campus data", () => {
  it("links every place to an existing node", () => {
    for (const place of places) expect(nodeById.has(place.nodeId)).toBe(true);
  });

  it("connects every pair of places for every profile", () => {
    for (const profile of PROFILE_LIST) {
      for (const from of places) {
        for (const to of places) {
          const route = findPath(from.nodeId, to.nodeId, { profile: profile.id, avoidUnlit: false });
          expect(route, `${profile.id}: ${from.id} → ${to.id}`).not.toBeNull();
        }
      }
    }
  });
});

describe("findPath", () => {
  it("lets standard walkers take the Senate–Library stairs", () => {
    const path = findPath("n-senate", "n-lib", standard)!;
    expect(path.edgeIds).toEqual(["e10"]);
  });

  it("never gives wheelchair users steps or slopes above 8%", () => {
    for (const from of places) {
      for (const to of places) {
        const path = findPath(from.nodeId, to.nodeId, wheelchair)!;
        for (const id of path.edgeIds) {
          const edge = edgeById.get(id)!;
          expect(edge.steps).toBe(0);
          expect(edge.slopePercent).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it("routes around blocked segments", () => {
    const path = findPath("n-senate", "n-lib", wheelchair, new Set(["e8"]))!;
    expect(path.edgeIds).not.toContain("e8");
    expect(path.nodeIds.at(-1)).toBe("n-lib");
  });

  it("returns null when the only accessible way in is blocked", () => {
    expect(findPath("n-senate", "n-lib", wheelchair, new Set(["e9"]))).toBeNull();
  });

  it("avoids unlit paths after dark when asked", () => {
    expect(findPath("n-sub", "n-sci", standard)!.edgeIds).toContain("e12");
    expect(findPath("n-sub", "n-sci", { ...standard, avoidUnlit: true })!.edgeIds).not.toContain("e12");
  });
});

describe("planRoute", () => {
  it("warns about steps and ends with arrival", () => {
    const route = planRoute("senate", "library", standard)!;
    expect(route.steps.flatMap((s) => s.warnings)).toContain("20 steps");
    expect(route.steps.at(-1)!.instruction).toBe("Arrive at Hezekiah Oluwasanmi Library");
    expect(route.duration).toBeGreaterThan(0);
  });

  it("only blocks segments for verified reports, but still warns about pending ones", () => {
    const pending = planRoute("senate", "library", wheelchair, [report({ edgeId: "e8", status: "pending" })])!;
    expect(pending.edgeIds).toContain("e8");
    expect(pending.steps.flatMap((s) => s.warnings).some((w) => w.startsWith("Unverified report"))).toBe(true);

    const verified = planRoute("senate", "library", wheelchair, [report({ edgeId: "e8" })])!;
    expect(verified.edgeIds).not.toContain("e8");
  });

  it("ignores resolved reports", () => {
    const route = planRoute("senate", "library", wheelchair, [report({ edgeId: "e8", status: "resolved" })])!;
    expect(route.edgeIds).toContain("e8");
  });

  it("lists rest points passed on the way", () => {
    const route = planRoute("shuttle-park", "health-centre", wheelchair)!;
    expect(route.restPoints.length).toBeGreaterThan(0);
  });

  it("flags destinations without step-free entrances", () => {
    const route = planRoute("senate", "fajuyi", wheelchair)!;
    expect(route.advisories).toContain("Fajuyi Hall has no step-free entrance.");
  });
});
