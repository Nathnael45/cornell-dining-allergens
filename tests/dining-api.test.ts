import { describe, expect, it } from "vitest";
import { DiningApiError, parseEateries } from "@/lib/cornell/dining-api";
import { classifyStation, isDiningRoom } from "@/lib/ingest/scope";
import { rawSnapshot, snapshot } from "./fixtures";

describe("parseEateries (real 2026-11-20 snapshot)", () => {
  const snap = snapshot();
  const rooms = snap.data.eateries.filter(isDiningRoom);

  it("parses all eateries and the 10 dining rooms", () => {
    expect(snap.data.eateries).toHaveLength(32);
    expect(rooms.map((r) => r.id).sort((a, b) => a - b)).toEqual([3, 4, 20, 25, 26, 27, 29, 30, 31, 43]);
  });

  it("classifies every station name seen in the snapshot", () => {
    const names = new Set(rooms.flatMap((e) => e.operatingHours.flatMap((d) => d.events.flatMap((ev) => ev.menu.map((c) => c.category)))));
    const unclassified = [...names].filter((n) => classifyStation(n).kind === "unclassified");
    expect(unclassified).toEqual([]);
  });

  it("rejects the SPA HTML / wrong shapes instead of ingesting garbage", () => {
    expect(() => parseEateries("<!DOCTYPE html>")).toThrow(DiningApiError);
    expect(() => parseEateries({ status: "success", data: { eateries: [] } })).toThrow(DiningApiError);
    const broken = structuredClone(rawSnapshot()) as { data: { eateries: { operatingHours: unknown }[] } };
    broken.data.eateries[0].operatingHours = "nope";
    expect(() => parseEateries(broken)).toThrow(DiningApiError);
  });
});
