import { describe, expect, it } from "vitest";

import { barTotal, oneRepMax, plateBreakdown } from "./plates";
import { parseWorkoutDescription } from "./parseWorkout";
import { programFocus, recommendation, type Focus } from "./recommend";
import { normalizeSupersetFlags, supersetInfo, supersetLabel } from "./supersets";
import type { Exercise, HistoryEntry, LibraryExercise, Program } from "./types";
import { parseWorkoutCsv } from "./workoutFile";

const library: LibraryExercise[] = [
  { id: "back-squat", name: "Back Squat", sets: "5", reps: "5", percent: 75, lift: "squat" },
  { id: "bench-press", name: "Bench Press", sets: "5", reps: "5", percent: 70, lift: "bench" },
  {
    id: "romanian-deadlift",
    name: "Romanian Deadlift",
    sets: "3",
    reps: "8",
    percent: null,
    lift: "deadlift",
  },
  { id: "plank", name: "Plank", sets: "3", reps: "30s", percent: null, lift: null },
];

function exercise(name: string): Exercise {
  return {
    id: name.toLowerCase().replaceAll(/\W+/g, "-"),
    name,
    sets: "3",
    reps: "8",
    percent: null,
    lift: null,
    superset: false,
  };
}

function program(id: string, name: string, exercises: string[]): Program {
  return { id, name, tags: [], exercises: exercises.map(exercise) };
}

function dateForFocus(focus: Focus) {
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(2026, 0, day, 12);
    if (recommendation([], [], date).focus === focus) return date;
  }
  throw new Error(`No ${focus} date found in search window`);
}

describe("plate calculations", () => {
  it("reports the closest achievable rack load and shortage", () => {
    expect(plateBreakdown(197, 45, [45, 25, 10, 5])).toEqual({
      loads: [
        { plate: 45, count: 1 },
        { plate: 25, count: 1 },
        { plate: 5, count: 1 },
      ],
      loadedPerSide: 75,
      achieved: 195,
      short: 2,
    });
  });

  it("totals per-side plates and estimates maxes with the Epley formula", () => {
    expect(barTotal({ 45: 2, 10: 1 }, 45, [45, 25, 10, 5])).toBe(245);
    expect(oneRepMax(225, 5)).toBe(263);
  });
});

describe("natural-language workout parsing", () => {
  it("normalizes spoken numbers, percentages, and known movement names", () => {
    const draft = parseWorkoutDescription(
      "Leg day: five by five squats at eighty percent, then 3 sets of 8 romanian deadlifts",
      library,
    );

    expect(draft.name).toBe("Leg Day");
    expect(draft.exercises).toMatchObject([
      { name: "Back Squat", sets: "5", reps: "5", percent: 80, lift: "squat" },
      { name: "Romanian Deadlift", sets: "3", reps: "8", percent: null, lift: "deadlift" },
    ]);
  });

  it("turns body-part intent into editable suggested movements", () => {
    const draft = parseWorkoutDescription("destroy my legs with the smith machine", library);

    expect(draft.name).toBe("Leg Day");
    expect(draft.exercises.map((item) => item.name)).toContain("Smith Machine Squat");
    expect(draft.exercises.every((item) => item.suggested)).toBe(true);
  });
});

describe("CSV workout imports", () => {
  it("honors quoted fields, rounds percentages, groups sessions, and derives focus tags", () => {
    const programs = parseWorkoutCsv(`workout,order,exercise,sets,reps,percent,lift,notes,superset
"Push, Heavy",1,"Bench Press",5,5,82.4%,bench,"pause, then press",yes
"Push, Heavy",2,"Cable Fly",3,12,,,"keep elbows soft",no
Pull Day,1,"Barbell Row",4,8,,,"quote ""the lats""",false`);

    expect(programs).toHaveLength(2);
    expect(programs[0]).toMatchObject({
      name: "Push, Heavy",
      tags: ["Bench"],
      exercises: [
        {
          id: "push-heavy-1",
          name: "Bench Press",
          sets: "5",
          reps: "5",
          percent: 82,
          lift: "bench",
          notes: "pause, then press",
          superset: true,
        },
        {
          id: "push-heavy-2",
          name: "Cable Fly",
          sets: "3",
          reps: "12",
          percent: null,
          lift: null,
          notes: "keep elbows soft",
          superset: false,
        },
      ],
    });
    expect(programs[1].exercises[0].notes).toBe('quote "the lats"');
  });

  it("rejects files that do not include the required grouping and movement columns", () => {
    expect(() => parseWorkoutCsv("sets,reps\n5,5\n")).toThrow(
      'The template needs a "workout" column and an "exercise" column',
    );
  });
});

describe("superset groups", () => {
  it("pairs legacy one-sided flags and clears lone flags when normalized", () => {
    const rows = [
      { id: "a", superset: true },
      { id: "b", superset: false },
      { id: "c", superset: true },
    ];
    const info = supersetInfo(rows);

    expect(info.groups).toEqual([{ index: 1, letter: "A", ids: ["a", "b"] }]);
    expect(supersetLabel(info, "a")).toBe("A1");
    expect(supersetLabel(info, "b")).toBe("A2");
    expect(supersetLabel(info, "c")).toBeNull();
    expect(normalizeSupersetFlags(rows)).toEqual([
      { id: "a", superset: true },
      { id: "b", superset: true },
      { id: "c", superset: false },
    ]);
  });
});

describe("workout recommendations", () => {
  it("classifies leg press as lower body before generic press matching", () => {
    expect(programFocus(program("legs", "Legs", ["Leg Press", "Standing Calf Raise"]))).toBe("legs");
    expect(programFocus(program("upper", "Upper", ["Bench Press", "Barbell Row"]))).toBe("upper");
    expect(programFocus(program("full", "Full", ["Back Squat", "Bench Press"]))).toBe("full");
  });

  it("avoids recently completed workouts when another matching option exists", () => {
    const programs = [
      program("bench", "Bench Day", ["Bench Press", "Incline Bench Press"]),
      program("press", "Press Day", ["Overhead Press", "Dips"]),
      program("legs", "Legs", ["Back Squat", "Romanian Deadlift"]),
    ];
    const date = dateForFocus("push");
    const firstPick = recommendation(programs, [], date).program;
    const history: HistoryEntry[] = [
      {
        id: "recent",
        programId: firstPick?.id ?? "",
        programName: firstPick?.name ?? "",
        finishedAt: date.getTime() - 60 * 60 * 1000,
        durationMs: 30 * 60 * 1000,
        completedCount: 2,
        totalCount: 2,
      },
    ];

    expect(firstPick).not.toBeNull();
    expect(recommendation(programs, history, date).program?.id).not.toBe(firstPick?.id);
  });
});
