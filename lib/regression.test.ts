import { describe, expect, it } from "vitest";

import { parseWorkoutDescription } from "./parseWorkout";
import { barTotal, plateBreakdown, STANDARD_PLATES, oneRepMax } from "./plates";
import { programFocus, recommendation } from "./recommend";
import { normalizeSupersetFlags, supersetInfo, supersetLabel } from "./supersets";
import type { HistoryEntry, LibraryExercise, Program } from "./types";
import { parseWorkoutCsv } from "./workoutFile";

function libraryExercise(
  name: string,
  options: Partial<LibraryExercise> = {},
): LibraryExercise {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    sets: "3",
    reps: "8",
    percent: null,
    lift: null,
    ...options,
  };
}

function program(id: string, name: string, movements: string[]): Program {
  return {
    id,
    name,
    tags: [],
    exercises: movements.map((movement, index) => ({
      id: `${id}-${index}`,
      name: movement,
      sets: "3",
      reps: "8",
      percent: null,
      lift: null,
      superset: false,
    })),
  };
}

describe("plate math", () => {
  it("rounds to the closest rackable weight and reports the shortfall", () => {
    expect(plateBreakdown(188, 45, STANDARD_PLATES)).toEqual({
      loads: [
        { plate: 45, count: 1 },
        { plate: 25, count: 1 },
      ],
      loadedPerSide: 70,
      achieved: 185,
      short: 3,
    });

    expect(barTotal({ 45: 1, 25: 1, 2.5: 1 }, 45, STANDARD_PLATES)).toBe(190);
    expect(oneRepMax(225, 5)).toBe(263);
  });
});

describe("workout description parser", () => {
  const library = [
    libraryExercise("Back Squat", { sets: "5", reps: "5", percent: 75, lift: "squat" }),
    libraryExercise("Bench Press", { sets: "3", reps: "5", percent: 70, lift: "bench" }),
    libraryExercise("Barbell Row", { sets: "4", reps: "8" }),
  ];

  it("understands dictated numbers, percentages, and titled workout days", () => {
    const draft = parseWorkoutDescription(
      "push day: five by five bench press at eighty percent, then 3 sets of 8 overhead press",
      library,
    );

    expect(draft.name).toBe("Push Day");
    expect(draft.exercises).toMatchObject([
      { name: "Bench Press", sets: "5", reps: "5", percent: 80, lift: "bench" },
      { name: "Overhead Press", sets: "3", reps: "8", percent: null, lift: "press" },
    ]);
  });

  it("turns intent plus equipment into a deterministic starter workout", () => {
    const draft = parseWorkoutDescription("destroy my legs with the smith machine", library);

    expect(draft.name).toBe("Leg Day");
    expect(draft.exercises.slice(0, 3)).toMatchObject([
      { name: "Smith Machine Squat", suggested: true, lift: "squat" },
      { name: "Smith Machine Hip Thrust", suggested: true },
      { name: "Smith Machine Calf Raise", suggested: true },
    ]);
  });
});

describe("CSV workout import", () => {
  it("preserves quoted spreadsheet fields and derives workout tags", () => {
    const programs = parseWorkoutCsv(
      [
        "Workout,Order,Exercise,Sets,Reps,Percent,Lift,Notes,Superset",
        '"Alpha, Heavy",1,"Back Squat",5,5,80%,squat,"pause, brace",yes',
        '"Alpha, Heavy",2,"Bench Press",3,8,,bench,"quoted ""note""",',
        "Beta,1,Deadlift,1,5,90,dead,,false",
      ].join("\n"),
    );

    expect(programs).toHaveLength(2);
    expect(programs[0]).toMatchObject({
      id: "alpha-heavy-1",
      name: "Alpha, Heavy",
      tags: ["Squat", "Bench"],
    });
    expect(programs[0].exercises).toMatchObject([
      {
        id: "alpha-heavy-1",
        name: "Back Squat",
        sets: "5",
        reps: "5",
        percent: 80,
        lift: "squat",
        notes: "pause, brace",
        superset: true,
      },
      {
        id: "alpha-heavy-2",
        name: "Bench Press",
        sets: "3",
        reps: "8",
        percent: null,
        lift: "bench",
        notes: 'quoted "note"',
        superset: false,
      },
    ]);
    expect(programs[1]).toMatchObject({
      name: "Beta",
      tags: ["Deadlift"],
      exercises: [{ name: "Deadlift", percent: 90, lift: "deadlift" }],
    });
  });
});

describe("superset normalization", () => {
  it("pairs legacy single flags and clears true lone supersets", () => {
    const rows = [
      { id: "a", superset: true },
      { id: "b", superset: false },
      { id: "c", superset: false },
      { id: "d", superset: true },
    ];

    const info = supersetInfo(rows);

    expect(info.groupOf).toEqual({ a: 1, b: 1, c: 0, d: 0 });
    expect(supersetLabel(info, "a")).toBe("A1");
    expect(supersetLabel(info, "b")).toBe("A2");
    expect(normalizeSupersetFlags(rows)).toEqual([
      { id: "a", superset: true },
      { id: "b", superset: true },
      { id: "c", superset: false },
      { id: "d", superset: false },
    ]);
  });
});

describe("workout recommendations", () => {
  it("classifies leg press as legs before press and avoids recent repeats", () => {
    const programs = [
      program("leg-a", "Squat Day", ["Back Squat"]),
      program("leg-b", "Pull From Floor", ["Deadlift"]),
      program("push", "Push Day", ["Bench Press"]),
      program("pull", "Pull Day", ["Barbell Row"]),
      program("full", "Full Body", ["Back Squat", "Bench Press", "Barbell Row"]),
    ];
    const date = new Date(1970, 0, 1, 12);
    const history: HistoryEntry[] = [
      {
        id: "history-1",
        programId: "leg-a",
        programName: "Squat Day",
        finishedAt: date.getTime() - 60 * 60 * 1000,
        durationMs: 45 * 60 * 1000,
        completedCount: 3,
        totalCount: 3,
      },
    ];

    expect(programFocus(program("leg-press", "Leg Press", ["Leg Press"]))).toBe("legs");
    expect(recommendation(programs, history, date)).toMatchObject({
      focus: "legs",
      cycleDay: 1,
      program: { id: "leg-b" },
    });
  });
});
