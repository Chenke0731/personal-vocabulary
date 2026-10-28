export type Book = "cet6" | "postgraduate" | "ielts";
export type Ability = "meaning" | "listening" | "spelling" | "context";
export type Rating = 1 | 2 | 3 | 4;
export interface Point {
  id: string;
  word: string;
  meaning: string;
  example: string;
  translation: string;
  books: Book[];
  ability: Ability;
  reviewed: boolean;
  phonetic?: string;
  source?: string;
  originId?: string;
  originAbility?: Ability;
}
export interface Review {
  id: string;
  pointId: string;
  rating: Rating;
  at: string;
  base: string;
  day: string;
  pending?: boolean;
  owner?: string;
  activeMs?: number;
}
export interface Setting {
  key: string;
  value: unknown;
}
export const bookNames: Record<Book, string> = {
  cet6: "六级提分",
  postgraduate: "考研强化",
  ielts: "雅思补充",
};
export const abilityNames: Record<Ability, string> = {
  meaning: "认义",
  listening: "听辨",
  spelling: "拼写",
  context: "语境",
};
export function isPoint(x: unknown): x is Point {
  if (!x || typeof x !== "object") return false;
  const p = x as Point;
  return (
    ["id", "word", "meaning", "example", "translation"].every(
      (k) => typeof (p as unknown as Record<string, unknown>)[k] === "string",
    ) &&
    p.id.length > 0 &&
    p.word.length > 0 &&
    Array.isArray(p.books) &&
    p.books.length > 0 &&
    p.books.every((b) => ["cet6", "postgraduate", "ielts"].includes(b)) &&
    ["meaning", "listening", "spelling", "context"].includes(p.ability) &&
    typeof p.reviewed === "boolean" &&
    ["source", "phonetic", "originId"].every(
      (k) =>
        (p as unknown as Record<string, unknown>)[k] === undefined ||
        typeof (p as unknown as Record<string, unknown>)[k] === "string",
    ) &&
    (p.originAbility === undefined ||
      ["meaning", "listening", "spelling", "context"].includes(p.originAbility))
  );
}
