import { describe, expect, it } from "vitest";
import { campus } from "@/data/campus";
import { planRoute } from "./advisory";
import { routeDetails } from "./route-details";
import { fixture, fixtureElevation } from "./test-fixture";

const wheelchair = { profile: "wheelchair" as const, avoidUnlit: false };

describe("routeDetails", () => {
  const netClimb = (from: string, to: string) =>
    fixtureElevation(fixture.nodes.get(fixture.places.get(to)!.nodeId)!) -
    fixtureElevation(fixture.nodes.get(fixture.places.get(from)!.nodeId)!);

  it("builds an elevation profile from start to end", () => {
    const route = planRoute(fixture, "senate", "library", wheelchair)!;
    const details = routeDetails(fixture, route, "senate", "library");
    expect(details.profile[0]).toEqual({ distance: 0, elevation: fixtureElevation(fixture.nodes.get("n-senate")!) });
    expect(details.profile.at(-1)!.distance).toBeCloseTo(route.distance, 0);
    expect(details.ascent - details.descent).toBeCloseTo(netClimb("senate", "library"), 0);
  });

  it("reverses elevations when edges are walked backwards", () => {
    const route = planRoute(fixture, "library", "senate", wheelchair)!;
    const details = routeDetails(fixture, route, "library", "senate");
    expect(details.ascent - details.descent).toBeCloseTo(netClimb("library", "senate"), 0);
    expect(details.descent).toBeGreaterThan(details.ascent);
  });

  it("totals steps and surfaces over the route", () => {
    const route = planRoute(fixture, "senate", "library", { profile: "standard", avoidUnlit: false })!;
    const details = routeDetails(fixture, route, "senate", "library");
    expect(details.steps).toBe(20);
    const surfaced = details.surfaces.paved + details.surfaces.rough + details.surfaces.unpaved;
    expect(surfaced).toBeCloseTo(details.footpaths + details.roads, 5);
  });

  it("reports the steepest section by name", () => {
    const route = planRoute(fixture, "senate", "library", wheelchair)!;
    expect(routeDetails(fixture, route, "senate", "library").steepest).toEqual({
      percent: 6,
      name: "Library ramp",
    });
  });

  it("lists landmarks passed but not the start or end", () => {
    const route = planRoute(campus, "sub", "technology", wheelchair)!;
    const { landmarks } = routeDetails(campus, route, "sub", "technology");
    expect(landmarks).not.toContain("Student Union Building (SUB)");
    expect(landmarks).not.toContain("Faculty of Technology");
    expect(landmarks.length).toBeLessThanOrEqual(5);
  });
});
