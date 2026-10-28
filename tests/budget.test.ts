import { it, expect } from "vitest";
import { activeSeconds, newPointTarget, reviewSeconds } from "../src/budget";
import type { Review } from "../src/model";
it("counts visible activity and excludes paused gaps", () => {
  expect(activeSeconds(1000, 4000, true)).toBe(3);
  expect(activeSeconds(1000, 4000, false)).toBe(0);
  expect(activeSeconds(1000, 301000, true)).toBe(0);
});
it("does not raise the initial target without enough history", () =>
  expect(newPointTarget([])).toBe(6));
it("uses observed median review duration but excludes long inactive dwell", () => {
  const base: Review = {
    id: "a",
    pointId: "p",
    rating: 3,
    at: "2026-10-28T01:00:00Z",
    base: "r0",
    day: "2026-10-28",
  };
  expect(
    reviewSeconds([
      { ...base, activeMs: 10000 },
      { ...base, id: "b", activeMs: 30000 },
      { ...base, id: "c", activeMs: 500000 },
    ]),
  ).toBe(20);
});
it("does not treat today unfinished allocation as past failure", () => {
  const plans = [
    { day: "2026-10-26", ids: ["a"] },
    { day: "2026-10-27", ids: ["b"] },
    { day: "2026-10-28", ids: ["c"] },
  ];
  const events: Review[] = [
    {
      id: "a",
      pointId: "a",
      rating: 3,
      at: "2026-10-26T01:00:00Z",
      base: "new",
      day: "2026-10-26",
    },
    {
      id: "b",
      pointId: "b",
      rating: 3,
      at: "2026-10-27T01:00:00Z",
      base: "new",
      day: "2026-10-27",
    },
  ];
  expect(newPointTarget(events, plans, "2026-10-28T12:00:00Z")).toBe(6);
});
