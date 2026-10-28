import type { Point, Ability } from "./model";
export interface AssessmentAnswer {
  pointId: string;
  ability: Ability;
  correct: boolean;
  at: string;
}
export interface AssessmentState {
  items: Point[];
  answers: AssessmentAnswer[];
}
export function assessmentItems(points: Point[]): Point[] {
  return points
    .filter((p) => p.reviewed && p.ability === "meaning")
    .slice(0, 24)
    .map((p, i) => ({
      ...p,
      ability: i < 16 ? "meaning" : i < 20 ? "listening" : "spelling",
    }));
}
export function assessmentSummary(answers: AssessmentAnswer[]) {
  const result: Record<Ability, { correct: number; total: number } | null> = {
    meaning: null,
    listening: null,
    spelling: null,
    context: null,
  };
  for (const a of answers) {
    const s = result[a.ability] ?? { correct: 0, total: 0 };
    s.total++;
    if (a.correct) s.correct++;
    result[a.ability] = s;
  }
  return result;
}
