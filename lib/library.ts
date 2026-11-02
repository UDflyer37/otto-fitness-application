import { autoDemo } from "./demos";
import { slugify } from "./programs";
import type { Exercise, LibraryExercise, Lift, Program } from "./types";

export const LIFT_OPTIONS: { value: Lift | null; label: string }[] = [
  { value: "squat", label: "Squat" },
  { value: "bench", label: "Bench" },
  { value: "deadlift", label: "Deadlift" },
  { value: "press", label: "Press" },
  { value: null, label: "By feel" },
];

/** "6" -> 6, "3-4" -> 3, "AMRAP" -> fallback. */
export function parseCount(value: string, fallback = 3) {
  const match = /(\d+)/.exec(value ?? "");
  if (!match) return fallback;
  return Math.max(1, Math.min(50, Number(match[1])));
}

export function guessLift(name: string): Lift | null {
  const text = name.toLowerCase();
  if (/deadlift|\brdl\b|romanian/.test(text)) return "deadlift";
  if (/squat|lunge|leg press/.test(text)) return "squat";
  if (/bench|floor press|\bcgb\b|close.grip/.test(text)) return "bench";
  if (/overhead press|military press|strict press|push press|shoulder press|\bohp\b/.test(text)) {
    return "press";
  }
  return null;
}

/**
 * Builds a de-duplicated exercise library out of whatever programs exist.
 * Used on first load and whenever an imported file has no library of its own.
 */
export function libraryFromPrograms(programs: Program[]): LibraryExercise[] {
  const seen = new Map<string, LibraryExercise>();
  const score = new Map<string, number>();

  // A movement shows up with different prescriptions across programs; keep the
  // plainest one, so "add Back Squat" defaults to 5 × 5 rather than a ladder.
  const rank = (exercise: Exercise) =>
    (/^\d+$/.test(exercise.sets) && /^\d+$/.test(exercise.reps) ? 2 : 0) +
    (exercise.percent === null ? 1 : 0);

  for (const program of programs) {
    for (const exercise of program.exercises) {
      // Wave/stage suffixes ("Back Squat (T1)") describe a set, not a movement.
      const name = exercise.name
        .split(/\s+\u2014\s+/)[0]
        .replace(/\s*\((T[123]|top triple|back-offs|BBB)\)\s*$/i, "")
        .trim();
      const key = name.toLowerCase();
      if (!key) continue;

      const previous = score.get(key);
      const next = rank(exercise);
      if (previous !== undefined && previous >= next) continue;

      score.set(key, next);
      seen.set(key, {
        id: slugify(name) || `exercise-${seen.size + 1}`,
        name,
        sets: exercise.sets,
        reps: exercise.reps,
        percent: exercise.percent,
        lift: exercise.lift,
        notes: exercise.notes,
        demo: exercise.demo ?? autoDemo(name),
      });
    }
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function newExerciseId(name: string) {
  return `${slugify(name) || "exercise"}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Turns a library movement into a program exercise. */
export function exerciseFromLibrary(item: LibraryExercise, index: number): Exercise {
  return {
    id: `${item.id}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    name: item.name,
    sets: item.sets,
    reps: item.reps,
    percent: item.percent,
    lift: item.lift,
    superset: false,
    notes: item.notes,
    demo: item.demo ?? autoDemo(item.name),
  };
}

export function defaultLibraryExercise(name = ""): LibraryExercise {
  return {
    id: newExerciseId(name || "exercise"),
    name,
    sets: "3",
    reps: "8",
    percent: null,
    lift: guessLift(name),
    demo: autoDemo(name),
  };
}
