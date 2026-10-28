import { isPoint } from "./model";
import type { Point } from "./model";
export function parseWordPack(input: unknown): Point[] {
  const p = input as { format?: unknown; version?: unknown; points?: unknown };
  if (
    !p ||
    p.format !== "cijian-wordpack" ||
    p.version !== 1 ||
    !Array.isArray(p.points) ||
    !p.points.length ||
    p.points.length > 50000 ||
    !p.points.every(isPoint)
  )
    throw new Error(
      "词包无效：需要版本1的词包及完整词条字段。未改变原有词库。",
    );
  const points = p.points as Point[];
  if (new Set(points.map((p) => p.id)).size !== points.length)
    throw new Error("词包存在重复知识点ID，请先修正。");
  return points;
}
export function mergePoints(existing: Point[], incoming: Point[]): Point[] {
  const merged = new Map(existing.map((p) => [p.id, p]));
  for (const p of incoming) {
    const old = merged.get(p.id);
    if (old && (old.word !== p.word || old.ability !== p.ability))
      throw new Error(`知识点ID冲突：${p.id}。请为不同内容分配不同ID。`);
    merged.set(p.id, p);
  }
  return [...merged.values()];
}
