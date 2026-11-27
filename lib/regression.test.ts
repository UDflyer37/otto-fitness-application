import { describe, expect, it } from "vitest";

import { libraryFromPrograms } from "./library";
import { parseWorkoutDescription } from "./parseWorkout";
import { barTotal, oneRepMax, plateBreakdown } from "./plates";
import { DEFAULT_PROGRAMS } from "./programs";
import { CYCLE, localDayNumber, programFocus, recommendation } from "./recommend";
import { normalizeSupersetFlags, supersetInfo, supersetLabel } from "./supersets";
import type { Program } from "./types";
import { parseWorkoutCsv } from "./workoutFile";

const library = libraryFromPrograms(DEFAULT_PROGRAMS);

function program(id: string, name: string, exercises: string[]): Program {
  return {
    id,
    name,
    tags: [],
    exercises: exercises.map((exercise, index) => ({
      id: `${id}-${index}`,
      name: exercise,
      sets: "3",
      reps: "8",
      percent: null,
      lift: null,
      superset: false,
    })),
  };
}

const focusPrograms: Record<(typeof CYCLE)[number], Program[]> = {
  legs: [
    program("legs-a", "Lower A", ["Back Squat", "Romanian Deadlift"]),
    program("legs-b", "Lower B", ["Leg Press", "Leg Curl"]),
  ],
  push: [
    program("push-a", "Push A", ["Bench Press", "Overhead Press"]),
    program("push-b", "Push B", ["Incline DB Press", "Triceps Pushdown"]),
  ],
  pull: [
    program("pull-a", "Pull A", ["Barbell Row", "Lat Pulldown"]),
    program("pull-b", "Pull B", ["Pull-Up", "Hammer Curl"]),
  ],
  upper: [
    program("upper-a", "Upper A", ["Bench Press", "Barbell Row"]),
    program("upper-b", "Upper B", ["Overhead Press", "Pull-Up"]),
  ],
  full: [
    program("full-a", "Full A", ["Back Squat", "Bench Press", "Barbell Row"]),
    program("full-b", "Full B", ["Deadlift", "Overhead Press", "Pull-Up"]),
  ],
};

function dateForFocus(focus: (typeof CYCLE)[number]) {
  const date = new Date(2026, 0, 1, 9);
  while (CYCLE[localDayNumber(date) % CYCLE.length] !== focus) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

describe("natural-language workout parsing", () => {
  it("normalizes spoken numbers, percentages, and library movement names", () => {
    const draft = parseWorkoutDescription(
      "Push day: five by five bench press at eighty percent then three sets of ten rows",
      library,
    );

    expect(draft.name).toBe("Push Day");
    expect(draft.exercises).toMatchObject([
      { name: "Bench Press", sets: "5", reps: "5", percent: 80, lift: "bench" },
      { name: "Barbell Row", sets: "3", reps: "10", percent: null },
    ]);
  });

  it("turns vague body-part and equipment intent into deterministic suggestions", () => {
    const draft = parseWorkoutDescription(
      "destroy my legs, let's hit the smith machine",
      library,
    );

    expect(draft.name).toBe("Leg Day");
    expect(draft.exercises).toHaveLength(6);
    expect(draft.exercises[0]).toMatchObject({
      name: "Smith Machine Squat",
      suggested: true,
      lift: "squat",
    });
    expect(draft.exercises.map((exercise) => exercise.name)).toEqual(
      expect.arrayContaining(["Smith Machine Hip Thrust", "Smith Machine Calf Raise"]),
    );
  });
});

describe("CSV workout import", () => {
  it("honors quoted fields, escaped quotes, rounded percentages, and superset flags", () => {
    const csv = [
      "Workout,Exercise,Sets,Reps,Percent,Lift,Notes,Superset",
      'Hypertrophy,"Bench Press",4,8,82.6%,bench,"pause, then drive",yes',
      'Hypertrophy,"DB Row",3,12,,,"cue ""elbows back"""',
      'Conditioning,"Farmer Carry",3,40s,,,"turn at the cone\nkeep ribs down",no',
    ].join("\n");

    const programs = parseWorkoutCsv(csv);

    expect(programs).toHaveLength(2);
    expect(programs[0]).toMatchObject({
      id: "hypertrophy-1",
      name: "Hypertrophy",
      tags: ["Bench"],
    });
    expect(programs[0].exercises).toMatchObject([
      {
        id: "hypertrophy-1",
        name: "Bench Press",
        sets: "4",
        reps: "8",
        percent: 83,
        lift: "bench",
        notes: "pause, then drive",
        superset: true,
      },
      {
        id: "hypertrophy-2",
        name: "DB Row",
        notes: 'cue "elbows back"',
        superset: false,
      },
    ]);
    expect(programs[1].exercises[0].notes).toBe("turn at the cone\nkeep ribs down");
  });

  it("rejects templates missing the required grouping or movement columns", () => {
    expect(() => parseWorkoutCsv("Program,Sets,Reps\nA,3,8")).toThrow(
      'The template needs a "workout" column and an "exercise" column in the header row.',
    );
  });
});

describe("superset compatibility", () => {
  it("pairs legacy one-sided flags and clears lone flags when pair-up is disabled", () => {
    const rows = [
      { id: "bench", superset: true },
      { id: "row" },
      { id: "curl", superset: true },
    ];

    const info = supersetInfo(rows);
    expect(info.groups).toEqual([{ index: 1, letter: "A", ids: ["bench", "row"] }]);
    expect(supersetLabel(info, "bench")).toBe("A1");
    expect(supersetLabel(info, "row")).toBe("A2");
    expect(normalizeSupersetFlags(rows, { pairUp: false }).map((row) => row.superset)).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe("workout recommendation rotation", () => {
  it("classifies leg press as lower-body work before press matching", () => {
    expect(programFocus(program("legs", "Leg Press", ["Leg Press"]))).toBe("legs");
    expect(programFocus(program("full", "Squat and Bench", ["Back Squat", "Bench Press"]))).toBe(
      "full",
    );
  });

  it("avoids recently finished workouts while choosing today's focus", () => {
    const date = dateForFocus("legs");
    const todayFocus = CYCLE[localDayNumber(date) % CYCLE.length];
    const recentlyFinished = `${todayFocus}-a`;
    const programs = CYCLE.flatMap((focus) => focusPrograms[focus]);

    const pick = recommendation(
      programs,
      [
        {
          id: "history-1",
          programId: recentlyFinished,
          programName: recentlyFinished,
          finishedAt: date.getTime() - 60 * 60 * 1000,
          durationMs: 45 * 60 * 1000,
          completedCount: 4,
          totalCount: 4,
        },
      ],
      date,
    );

    expect(pick.focus).toBe(todayFocus);
    expect(pick.program?.id).not.toBe(recentlyFinished);
    expect(pick.program?.id).toBe(`${todayFocus}-b`);
  });
});

describe("plate math", () => {
  it("reports closest achievable weight and shortfall when a rack cannot hit the target", () => {
    expect(plateBreakdown(258, 45, [45, 25, 10, 5])).toEqual({
      loads: [
        { plate: 45, count: 2 },
        { plate: 10, count: 1 },
        { plate: 5, count: 1 },
      ],
      loadedPerSide: 105,
      achieved: 255,
      short: 3,
    });
  });

  it("totals per-side plate counts and estimates maxes without fractional drift", () => {
    expect(barTotal({ 45: 1, 10: 2 }, 45, [45, 35, 25, 10, 5, 2.5])).toBe(175);
    expect(oneRepMax(175, 5)).toBe(204);
  });
});
