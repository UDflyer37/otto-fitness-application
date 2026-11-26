import { describe, expect, it } from "vitest";

import { libraryFromPrograms } from "./library";
import { parseWorkoutDescription } from "./parseWorkout";
import { plateBreakdown, barTotal, oneRepMax } from "./plates";
import { DEFAULT_PROGRAMS } from "./programs";
import { CYCLE, localDayNumber, recommendation, programFocus } from "./recommend";
import { normalizeSupersetFlags, supersetInfo, supersetLabel } from "./supersets";
import type { Program } from "./types";
import { looksLikeCsv, parseWorkoutCsv } from "./workoutFile";

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

function dateForFocus(focus: (typeof CYCLE)[number]) {
  const date = new Date(2024, 0, 1, 12);
  while (CYCLE[localDayNumber(date) % CYCLE.length] !== focus) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

describe("workout description parsing", () => {
  it("normalizes speech-style numbers and preserves explicitly named movements", () => {
    const draft = parseWorkoutDescription(
      "push day: five by five bench at eighty percent then three sets of twelve barbell row",
      library,
    );

    expect(draft.name).toBe("Push Day");
    expect(draft.exercises).toHaveLength(2);
    expect(draft.exercises[0]).toMatchObject({
      name: "Barbell Bench Press",
      sets: "5",
      reps: "5",
      percent: 80,
      lift: "bench",
    });
    expect(draft.exercises[1]).toMatchObject({
      name: "Barbell Row",
      sets: "3",
      reps: "12",
    });
  });

  it("turns body-part and equipment intent into a bounded editable draft", () => {
    const draft = parseWorkoutDescription("destroy my legs with the smith machine", library);

    expect(draft.name).toBe("Leg Day");
    expect(draft.exercises).toHaveLength(6);
    expect(draft.exercises.map((exercise) => exercise.name)).toEqual(
      expect.arrayContaining(["Smith Machine Squat", "Smith Machine Hip Thrust"]),
    );
    expect(draft.exercises.every((exercise) => exercise.suggested)).toBe(true);
  });
});

describe("workout file import", () => {
  it("parses quoted CSV fields, aliases, lift tags, and supersets", () => {
    const csv = [
      "session,order,movement,sets,reps,intensity,focus,note,pair",
      'Heavy Day,1,"Back Squat",5,5,82.4,squat,"first line',
      'second line",yes',
      'Heavy Day,2,"Bench Press",3,8,75%,bench,"pause, then press",true',
      'Pull Day,1,"Barbell Row",4,10,,dead,strict,no',
    ].join("\n");

    expect(looksLikeCsv(csv)).toBe(true);
    const programs = parseWorkoutCsv(csv);

    expect(programs).toHaveLength(2);
    expect(programs[0]).toMatchObject({
      name: "Heavy Day",
      tags: ["Squat", "Bench"],
    });
    expect(programs[0].exercises[0]).toMatchObject({
      id: "heavy-day-1",
      name: "Back Squat",
      sets: "5",
      reps: "5",
      percent: 82,
      lift: "squat",
      notes: "first line\nsecond line",
      superset: true,
    });
    expect(programs[0].exercises[1]).toMatchObject({
      id: "heavy-day-2",
      notes: "pause, then press",
      superset: true,
    });
    expect(programs[1].tags).toEqual(["Deadlift"]);
  });

  it("rejects files missing required workout or exercise columns", () => {
    expect(() => parseWorkoutCsv("name,sets,reps\nBack Squat,5,5")).toThrow(
      /workout.*exercise/i,
    );
  });
});

describe("plate and max calculations", () => {
  it("computes achievable per-side loads without going below an empty bar", () => {
    expect(plateBreakdown(317, 45, [45, 25, 10, 5, 2.5])).toEqual({
      loads: [
        { plate: 45, count: 3 },
      ],
      loadedPerSide: 135,
      achieved: 315,
      short: 2,
    });

    expect(plateBreakdown(35, 45, [45, 25, 10])).toEqual({
      loads: [],
      loadedPerSide: 0,
      achieved: 45,
      short: 0,
    });
  });

  it("totals manually entered plates and estimates one-rep maxes", () => {
    expect(barTotal({ 45: 2, 10: 1 }, 45, [45, 35, 25, 10, 5])).toBe(245);
    expect(oneRepMax(225, 5)).toBe(263);
    expect(oneRepMax(225, 1)).toBe(225);
  });
});

describe("superset grouping", () => {
  it("normalizes legacy single-flag pairs while clearing true lone flags", () => {
    const rows = [
      { id: "a", superset: true },
      { id: "b" },
      { id: "c" },
      { id: "d", superset: true },
    ];

    const info = supersetInfo(rows);
    expect(info.groups).toEqual([{ index: 1, letter: "A", ids: ["a", "b"] }]);
    expect(supersetLabel(info, "a")).toBe("A1");
    expect(supersetLabel(info, "b")).toBe("A2");
    expect(supersetLabel(info, "d")).toBeNull();
    expect(normalizeSupersetFlags(rows).map((row) => row.superset)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("daily recommendations", () => {
  const programs = [
    program("push-a", "Bench Day", ["Bench Press"]),
    program("push-b", "Press Day", ["Overhead Press"]),
    program("pull", "Pull Day", ["Barbell Row"]),
    program("legs", "Leg Day", ["Back Squat", "Romanian Deadlift"]),
    program("upper", "Upper Day", ["Bench Press", "Barbell Row"]),
    program("full", "Full Body", ["Back Squat", "Bench Press", "Barbell Row"]),
  ];

  it("classifies mixed movement days by blast-radius focus rules", () => {
    expect(programFocus(program("leg-press", "Leg Press", ["Leg Press"]))).toBe("legs");
    expect(programFocus(program("upper", "Upper", ["Bench Press", "Barbell Row"]))).toBe(
      "upper",
    );
    expect(programFocus(program("full", "Full", ["Back Squat", "Bench Press"]))).toBe(
      "full",
    );
  });

  it("avoids recently completed workouts inside the current recommendation cycle", () => {
    const date = dateForFocus("push");
    const baseline = recommendation(programs, [], date);
    expect(baseline.focus).toBe("push");
    expect(baseline.program).not.toBeNull();

    const next = recommendation(
      programs,
      [
        {
          id: "history-1",
          programId: baseline.program!.id,
          programName: baseline.program!.name,
          finishedAt: date.getTime() - 60 * 60_000,
          durationMs: 45 * 60_000,
          completedCount: 3,
          totalCount: 3,
        },
      ],
      date,
    );

    expect(next.program?.id).not.toBe(baseline.program?.id);
    expect(next.program?.id).toBe("push-b");
  });
});
