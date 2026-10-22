import { describe, expect, it } from "vitest";
import { campus, places } from "@/data/campus";
import { formatOpeningHours, groupPlaces, nearbyPlaces, osmUrl } from "./places";

describe("places", () => {
  it("formats OpenStreetMap opening hours", () => {
    expect(formatOpeningHours("Mo-Fr 08:00-16:00")).toBe("Mon–Fri 08:00–16:00");
  });

  it("links places to their OpenStreetMap feature", () => {
    expect(osmUrl(campus.places.get("library")!)).toBe("https://www.openstreetmap.org/way/617712369");
  });

  it("groups every place exactly once", () => {
    const grouped = groupPlaces(campus).flatMap((g) => g.places.map((p) => p.id));
    expect(grouped.sort()).toEqual([...campus.places.keys()].sort());
  });

  it("lists nearby places closest first, excluding the place itself", () => {
    const near = nearbyPlaces(campus, campus.places.get("library")!);
    expect(near).toHaveLength(3);
    expect(near.map((n) => n.place.id)).not.toContain("library");
    expect(near[0].distance).toBeLessThanOrEqual(near[2].distance);
  });

  it("gives every place a unique id", () => {
    expect(campus.places.size).toBe(places.length);
  });
});
