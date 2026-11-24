import { describe, expect, it } from "vitest";
import { libraryFromPrograms } from "./library";
import { parseWorkoutDescription } from "./parseWorkout";
import { plateBreakdown } from "./plates";
import { DEFAULT_PROGRAMS } from "./programs";
import { programFocus, recommendation } from "./recommend";
import type { HistoryEntry, Program } from "./types";
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

describe("workout parsing regressions", () => {
  it("normalizes spoken numbers and explicit percentages without adding a template", () => {
    const draft = parseWorkoutDescription(
      "push day: five by five bench at eighty percent then three sets of twelve overhead press",
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
      name: "Overhead Press",
      sets: "3",
      reps: "12",
      lift: "press",
    });
  });

  it("turns equipment and body-part intent into suggested movements", () => {
    const draft = parseWorkoutDescription("Destroy my legs with the smith machine", library);

    expect(draft.name).toBe("Leg Day");
    expect(draft.exercises.length).toBeGreaterThanOrEqual(3);
    expect(draft.exercises[0]).toMatchObject({
      name: "Smith Machine Squat",
      suggested: true,
      lift: "squat",
    });
    expect(draft.exercises.some((exercise) => exercise.name === "Smith Machine Hip Thrust")).toBe(
      true,
    );
  });
});

describe("CSV import regressions", () => {
  it("honors quoted commas/newlines and groups imported workouts", () => {
    const programs = parseWorkoutCsv(
      [
        "workout,order,exercise,sets,reps,percent,lift,notes,superset",
        'Heavy Day,2,"Bench Press",5,5,80,bench,"Pause, then press",yes',
        '"Pump Day",1,"Cable Row",3,12,,,"Keep ribs down',
        'and squeeze",no',
      ].join("\n"),
    );

    expect(programs).toHaveLength(2);
    expect(programs[0]).toMatchObject({
      id: "heavy-day-1",
      name: "Heavy Day",
      tags: ["Bench"],
    });
    expect(programs[0].exercises[0]).toMatchObject({
      id: "heavy-day-1",
      name: "Bench Press",
      sets: "5",
      reps: "5",
      percent: 80,
      lift: "bench",
      notes: "Pause, then press",
      superset: true,
    });
    expect(programs[1].exercises[0]).toMatchObject({
      name: "Cable Row",
      notes: "Keep ribs down\nand squeeze",
      superset: false,
    });
  });

  it("rejects a spreadsheet missing required workout or exercise columns", () => {
    expect(() => parseWorkoutCsv("day,sets,reps\nLegs,3,8")).toThrow(
      'The template needs a "workout" column and an "exercise" column in the header row.',
    );
  });
});

describe("plate and recommendation regressions", () => {
  it("reports the closest achievable plate load without going over target", () => {
    expect(plateBreakdown(203, 45, [45, 25, 10, 5])).toEqual({
      loads: [
        { plate: 45, count: 1 },
        { plate: 25, count: 1 },
        { plate: 5, count: 1 },
      ],
      loadedPerSide: 75,
      achieved: 195,
      short: 8,
    });
  });

  it("classifies leg press as lower body before generic press matching", () => {
    expect(programFocus(program("legs", "Legs", ["Leg Press", "Leg Curl"]))).toBe("legs");
    expect(programFocus(program("upper", "Upper", ["Bench Press", "Cable Row"]))).toBe("upper");
  });

  it("avoids workouts already completed inside the recent history window", () => {
    const programs = [
      program("legs-1", "Legs A", ["Back Squat"]),
      program("legs-2", "Legs B", ["Front Squat"]),
      program("push-1", "Push", ["Bench Press"]),
      program("pull-1", "Pull", ["Cable Row"]),
      program("upper-1", "Upper", ["Bench Press", "Cable Row"]),
      program("full-1", "Full", ["Back Squat", "Bench Press", "Cable Row"]),
    ];
    const date = new Date("2026-11-23T12:00:00");
    const recentLegsA: HistoryEntry = {
      id: "history-1",
      programId: "legs-1",
      programName: "Legs A",
      finishedAt: date.getTime() - 2 * 3_600_000,
      durationMs: 3_600_000,
      completedCount: 1,
      totalCount: 1,
    };

    const pick = recommendation(programs, [recentLegsA], date);

    expect(pick.focus).toBe("legs");
    expect(pick.program?.id).toBe("legs-2");
  });
});
