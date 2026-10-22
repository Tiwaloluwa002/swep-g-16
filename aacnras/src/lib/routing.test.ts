import { describe, expect, it } from "vitest";
import { campus } from "@/data/campus";
import { planRoute } from "./advisory";
import { distance } from "./geo";
import { nearestEdge } from "./graph";
import { PROFILE_LIST } from "./profiles";
import { findPath } from "./routing";
import { fixture } from "./test-fixture";
import type { Report, RouteOptions } from "./types";

const standard: RouteOptions = { profile: "standard", avoidUnlit: false };
const wheelchair: RouteOptions = { profile: "wheelchair", avoidUnlit: false };
const node = (placeId: string) => fixture.places.get(placeId)!.nodeId;

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

describe("findPath", () => {
  it("lets standard walkers take the stairs shortcut", () => {
    expect(findPath(fixture, node("senate"), node("library"), standard)!.edgeIds).toEqual(["e10"]);
  });

  it("never gives wheelchair users steps or slopes above 8%", () => {
    for (const from of fixture.places.values()) {
      for (const to of fixture.places.values()) {
        const path = findPath(fixture, from.nodeId, to.nodeId, wheelchair)!;
        expect(path, `${from.id} → ${to.id}`).not.toBeNull();
        for (const id of path.edgeIds) {
          const edge = fixture.edges.get(id)!;
          expect(edge.steps).toBe(0);
          expect(edge.slopePercent).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it("routes around blocked segments", () => {
    const path = findPath(fixture, node("senate"), node("library"), wheelchair, new Set(["e8"]))!;
    expect(path.edgeIds).not.toContain("e8");
    expect(path.nodeIds.at(-1)).toBe(node("library"));
  });

  it("returns null when the only accessible way in is blocked", () => {
    expect(findPath(fixture, node("senate"), node("library"), wheelchair, new Set(["e9"]))).toBeNull();
  });

  it("avoids unlit paths after dark when asked", () => {
    expect(findPath(fixture, node("sub"), node("science"), standard)!.edgeIds).toContain("e12");
    const lit = findPath(fixture, node("sub"), node("science"), { ...standard, avoidUnlit: true })!;
    expect(lit.edgeIds).not.toContain("e12");
  });
});

describe("planRoute", () => {
  it("warns about steps and ends with arrival", () => {
    const route = planRoute(fixture, "senate", "library", standard)!;
    expect(route.steps.flatMap((s) => s.warnings)).toContain("20 steps");
    expect(route.steps.at(-1)!.instruction).toBe("Arrive at Library");
    expect(route.duration).toBeGreaterThan(0);
  });

  it("gives turn directions after the first step", () => {
    const route = planRoute(fixture, "senate", "library", wheelchair)!;
    expect(route.steps[0].instruction).toMatch(/^Head (north|south|east|west)/);
    expect(route.steps[1].instruction).toMatch(/^(Turn|Bear|Continue)/);
  });

  it("only blocks segments for verified reports, but still warns about pending ones", () => {
    const pending = planRoute(fixture, "senate", "library", wheelchair, [report({ edgeId: "e8", status: "pending" })])!;
    expect(pending.edgeIds).toContain("e8");
    expect(pending.steps.flatMap((s) => s.warnings).some((w) => w.startsWith("Unverified report"))).toBe(true);

    const verified = planRoute(fixture, "senate", "library", wheelchair, [report({ edgeId: "e8" })])!;
    expect(verified.edgeIds).not.toContain("e8");
  });

  it("ignores resolved reports", () => {
    const route = planRoute(fixture, "senate", "library", wheelchair, [report({ edgeId: "e8", status: "resolved" })])!;
    expect(route.edgeIds).toContain("e8");
  });

  it("lists rest points passed on the way", () => {
    expect(planRoute(fixture, "senate", "library", wheelchair)!.restPoints).toEqual(["Senate square benches"]);
  });

  it("flags destinations without step-free entrances", () => {
    const route = planRoute(fixture, "senate", "fajuyi", wheelchair)!;
    expect(route.advisories).toContain("Fajuyi Hall has no step-free entrance.");
  });
});

describe("nearestEdge", () => {
  it("finds the segment closest to a point", () => {
    expect(nearestEdge(fixture, { lat: 7.51965, lng: 4.5238 }).edge.id).toBe("e9");
  });
});

describe("OAU campus data", () => {
  it("connects every pair of places for standard walking", () => {
    for (const from of campus.places.values()) {
      for (const to of campus.places.values()) {
        expect(findPath(campus, from.nodeId, to.nodeId, standard), `${from.id} → ${to.id}`).not.toBeNull();
      }
    }
  });

  it("adds a walking leg for buildings away from the mapped paths", () => {
    const offNetwork = [...campus.places.values()].find((p) => distance(p, campus.nodes.get(p.nodeId)!) > 25)!;
    const other = [...campus.places.values()].find((p) => p.nodeId !== offNetwork.nodeId)!;
    const route = planRoute(campus, other.id, offNetwork.id, standard)!;
    expect(route.steps.at(-2)!.instruction).toMatch(new RegExp(`^Walk about \\d+ m to the entrance of ${offNetwork.name}`));
  });

  it("gives every profile a route between the main academic buildings", () => {
    const core = ["senate", "library", "sub", "arts", "technology"];
    for (const profile of PROFILE_LIST) {
      for (const from of core) {
        for (const to of core) {
          const route = planRoute(campus, from, to, { profile: profile.id, avoidUnlit: false });
          expect(route, `${profile.id}: ${from} → ${to}`).not.toBeNull();
        }
      }
    }
  });
});
