import { expect, it } from "vitest";
import { assessmentItems, assessmentSummary } from "../src/assessment";
import { demoPoints } from "../src/demo";
it("selects at most 24 reviewed points with separated abilities", () => {
  const items = assessmentItems([
    ...demoPoints,
    { ...demoPoints[0], id: "unchecked", reviewed: false },
  ]);
  expect(items).toHaveLength(24);
  expect(new Set(items.map((p) => p.id)).size).toBe(24);
  expect(items.filter((p) => p.ability === "spelling")).toHaveLength(4);
});
it("does not fabricate a rate for an untested ability", () =>
  expect(assessmentSummary([]).listening).toBeNull());
it("summarizes observed answers without predicting an exam grade", () =>
  expect(
    assessmentSummary([
      {
        pointId: "p",
        ability: "meaning",
        correct: true,
        at: "2026-10-28T00:00:00Z",
      },
      {
        pointId: "q",
        ability: "meaning",
        correct: false,
        at: "2026-10-28T00:00:00Z",
      },
    ]).meaning,
  ).toEqual({ correct: 1, total: 2 }));
