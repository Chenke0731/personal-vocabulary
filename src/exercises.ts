export function checkSpelling(answer: string, expected: string) {
  return (
    answer.trim().toLocaleLowerCase("en-US") ===
    expected.trim().toLocaleLowerCase("en-US")
  );
}
export function cloze(example: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return example.replace(
    new RegExp(`(?<![a-zA-Z])${escaped}(?![a-zA-Z])`, "gi"),
    "_____",
  );
}
import type { Point, Ability } from "./model";
export function makeExercise(point: Point, ability: Ability): Point {
  const originId = point.originId ?? point.id;
  const originAbility = point.originAbility ?? point.ability;
  return {
    ...point,
    originId,
    originAbility,
    id: ability === originAbility ? originId : originId + "::" + ability,
    ability,
  };
}
