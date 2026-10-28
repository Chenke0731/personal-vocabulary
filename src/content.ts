import { isPoint } from "./model";
import type { Point } from "./model";
export function independentSense(point: Point, id: string): Point {
  const {
    originId: _originId,
    originAbility: _originAbility,
    ...content
  } = point;
  return { ...content, id, ability: "meaning" };
}
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
/** WordEditor 保存校对时会在 source 后追加该标记，见 src/WordEditor.tsx。 */
export function isUserEdited(point: Point): boolean {
  return (point.source ?? "").includes("义项由用户校对");
}
function contentDiffers(a: Point, b: Point): boolean {
  return (
    a.meaning !== b.meaning ||
    a.example !== b.example ||
    a.translation !== b.translation ||
    a.phonetic !== b.phonetic ||
    a.source !== b.source ||
    a.reviewed !== b.reviewed ||
    a.books.join(",") !== b.books.join(",")
  );
}
export interface MergeConflict {
  id: string;
  word: string;
}
export interface MergeReport {
  points: Point[];
  conflicts: MergeConflict[];
}
/**
 * 合并词包：用户已校对的内容优先保留。
 * 只有当已有内容是用户校对、且导入内容不是用户本次校对、且两者内容不同时，
 * 才保留已有内容并把该 ID 记入 conflicts，供界面明确提示，不得静默覆盖。
 * 用户在编辑器里新保存的校对内容（incoming 本身含校对标记）仍可覆盖旧内容。
 */
export function mergePointsWithReport(
  existing: Point[],
  incoming: Point[],
): MergeReport {
  const merged = new Map(existing.map((p) => [p.id, p]));
  const conflicts: MergeConflict[] = [];
  for (const p of incoming) {
    const old = merged.get(p.id);
    if (old && (old.word !== p.word || old.ability !== p.ability))
      throw new Error(`知识点ID冲突：${p.id}。请为不同内容分配不同ID。`);
    if (
      old &&
      isUserEdited(old) &&
      !isUserEdited(p) &&
      contentDiffers(old, p)
    ) {
      conflicts.push({ id: p.id, word: p.word });
      continue;
    }
    merged.set(p.id, p);
  }
  return { points: [...merged.values()], conflicts };
}
export function mergePoints(existing: Point[], incoming: Point[]): Point[] {
  return mergePointsWithReport(existing, incoming).points;
}
