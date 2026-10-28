import { describe, it, expect } from "vitest";
import { syncEvents, type RemoteEvents } from "../src/sync";
import type { Review } from "../src/model";
const event: Review = {
  id: "r",
  pointId: "p",
  rating: 3,
  at: "2026-10-28T01:00:00Z",
  base: "new",
  day: "2026-10-28",
  pending: true,
};
describe("cloud event exchange", () => {
  it("does not acknowledge local records after a failed upload", async () => {
    const remote: RemoteEvents = {
      push: async () => {
        throw new Error("offline");
      },
      pull: async () => [],
    };
    await expect(syncEvents([event], "u", remote)).rejects.toThrow("offline");
    expect(event.pending).toBe(true);
  });
  it("merges different device events and acknowledges only uploaded IDs", async () => {
    const other = { ...event, id: "second", pending: false };
    const remote: RemoteEvents = {
      push: async () => {},
      pull: async () => [event, other],
    };
    const result = await syncEvents([event], "u", remote);
    expect(result.acknowledged).toEqual(["r"]);
    expect(result.received.map((e) => e.id)).toEqual(["r", "second"]);
  });
  it("rejects records assigned to a different account", async () => {
    const remote: RemoteEvents = { push: async () => {}, pull: async () => [] };
    await expect(
      syncEvents([{ ...event, owner: "other" }], "u", remote),
    ).rejects.toThrow();
  });
});
it("rejects cyclic cloud reviews before returning them to storage", async () => {
  const first = { ...event, id: "a", base: "b" },
    second = { ...event, id: "b", base: "a" };
  await expect(
    syncEvents([], "u", {
      push: async () => {},
      pull: async () => [first, second],
    }),
  ).rejects.toThrow();
});
