import { describe, expect, it } from "vitest";
import { parseCount } from "./library";
import { barTotal, oneRepMax, plateBreakdown } from "./plates";
import { parseWorkoutDescription } from "./parseWorkout";
import { CYCLE, localDayNumber, programFocus, recommendation } from "./recommend";
import { exerciseTarget, isExerciseComplete, workingMaxFor } from "./state";
import { normalizeSupersetFlags, supersetInfo, supersetLabel } from "./supersets";
import type { AppSettings, Exercise, HistoryEntry, LibraryExercise, Program } from "./types";
import { parseWorkoutCsv } from "./workoutFile";

const library: LibraryExercise[] = [
  { id: "back-squat", name: "Back Squat", sets: "5", reps: "5", percent: 75, lift: "squat" },
  { id: "bench", name: "Bench Press", sets: "5", reps: "5", percent: 70, lift: "bench" },
  { id: "romanian-deadlift", name: "Romanian Deadlift", sets: "3", reps: "8", percent: null, lift: "deadlift" },
  { id: "barbell-row", name: "Barbell Row", sets: "4", reps: "8", percent: null, lift: null },
  { id: "lat-pulldown", name: "Lat Pulldown", sets: "3", reps: "10", percent: null, lift: null },
  { id: "smith-squat", name: "Smith Machine Squat", sets: "4", reps: "8", percent: null, lift: "squat" },
  { id: "smith-hip-thrust", name: "Smith Machine Hip Thrust", sets: "3", reps: "10", percent: null, lift: null },
  { id: "smith-calf-raise", name: "Smith Machine Calf Raise", sets: "3", reps: "15", percent: null, lift: null },
];

function exercise(partial: Partial<Exercise> & Pick<Exercise, "name">): Exercise {
  return {
    id: partial.id ?? partial.name.toLowerCase().replace(/\s+/g, "-"),
    name: partial.name,
    sets: partial.sets ?? "3",
    reps: partial.reps ?? "8",
    percent: partial.percent ?? null,
    lift: partial.lift ?? null,
    superset: partial.superset ?? false,
  };
}

function program(id: string, exercises: Exercise[]): Program {
  return { id, name: id, tags: [], exercises };
}

describe("workout description parsing", () => {
  it("normalizes spoken numbers, percentages, and shorthand lift names", () => {
    const draft = parseWorkoutDescription(
      "Workout: Heavy day\nfive by five bench at eighty percent, three sets of ten Romanian deadlift",
      library,
    );

    expect(draft.name).toBe("Heavy day");
    expect(draft.exercises).toHaveLength(2);
    expect(draft.exercises[0]).toMatchObject({
      name: "Bench Press",
      sets: "5",
      reps: "5",
      percent: 80,
      lift: "bench",
    });
    expect(draft.exercises[1]).toMatchObject({
      name: "Romanian Deadlift",
      sets: "3",
      reps: "10",
      lift: "deadlift",
    });
  });

  it("turns body-part and equipment intent into specific suggested movements", () => {
    const draft = parseWorkoutDescription("Destroy my legs, let's hit the smith machine", library);

    expect(draft.name).toBe("Leg Day");
    expect(draft.exercises.slice(0, 3).map((item) => item.name)).toEqual([
      "Smith Machine Squat",
      "Smith Machine Hip Thrust",
      "Smith Machine Calf Raise",
    ]);
    expect(draft.exercises.every((item) => item.suggested)).toBe(true);
  });
});

describe("CSV workout imports", () => {
  it("honors quoted commas and newlines while grouping rows into workouts", () => {
    const csv = [
      "workout,exercise,sets,reps,percent,lift,notes,superset",
      '"Launch Day","Back Squat",5,5,82.6%,squat,"pause, then drive",yes',
      '"Launch Day","Bench Press",3,8,,bench,"keep elbows',
      'tucked",no',
      '"Pull Day","Lat Pulldown",4,10,,,"wide grip",',
    ].join("\n");

    const programs = parseWorkoutCsv(csv);

    expect(programs).toHaveLength(2);
    expect(programs[0]).toMatchObject({ id: "launch-day-1", name: "Launch Day", tags: ["Squat", "Bench"] });
    expect(programs[0].exercises[0]).toMatchObject({
      id: "launch-day-1",
      name: "Back Squat",
      percent: 83,
      lift: "squat",
      notes: "pause, then drive",
      superset: true,
    });
    expect(programs[0].exercises[1].notes).toBe("keep elbows\ntucked");
    expect(programs[1]).toMatchObject({ name: "Pull Day", tags: ["Free weights"] });
  });

  it("rejects files without the required workout and exercise columns", () => {
    expect(() => parseWorkoutCsv("session,sets,reps\nA,3,5")).toThrow(
      'The template needs a "workout" column and an "exercise" column in the header row.',
    );
  });
});

describe("recommendations", () => {
  it("classifies leg press as lower-body work before generic press matching", () => {
    expect(programFocus(program("leg-press-day", [exercise({ name: "Leg Press" })]))).toBe("legs");
  });

  it("avoids recommending a workout finished in the last 36 hours", () => {
    const date = new Date(2026, 0, 5, 12);
    const todayFocus = CYCLE[localDayNumber(date) % CYCLE.length];
    const exercisesByFocus = {
      legs: [exercise({ name: "Back Squat" })],
      push: [exercise({ name: "Bench Press" })],
      pull: [exercise({ name: "Barbell Row" })],
      upper: [exercise({ name: "Bench Press" }), exercise({ name: "Barbell Row" })],
      full: [
        exercise({ name: "Back Squat" }),
        exercise({ name: "Bench Press" }),
        exercise({ name: "Barbell Row" }),
      ],
    } satisfies Record<typeof todayFocus, Exercise[]>;
    const recent = program("recent", exercisesByFocus[todayFocus]);
    const fresh = program("fresh", exercisesByFocus[todayFocus]);
    const history: HistoryEntry[] = [
      {
        id: "history-1",
        programId: recent.id,
        programName: recent.name,
        finishedAt: date.getTime() - 60 * 60 * 1000,
        durationMs: 1_800_000,
        completedCount: 3,
        totalCount: 3,
      },
    ];

    expect(recommendation([recent, fresh], history, date).program?.id).toBe("fresh");
  });
});

describe("supersets", () => {
  it("pairs legacy single flags and clears orphan flags when normalized", () => {
    const rows = [
      { id: "a", superset: true },
      { id: "b", superset: false },
      { id: "c", superset: true },
    ];

    const info = supersetInfo(rows);

    expect(info.groups).toEqual([{ index: 1, letter: "A", ids: ["a", "b"] }]);
    expect(supersetLabel(info, "a")).toBe("A1");
    expect(supersetLabel(info, "b")).toBe("A2");
    expect(normalizeSupersetFlags(rows)).toEqual([
      { id: "a", superset: true },
      { id: "b", superset: true },
      { id: "c", superset: false },
    ]);
  });

  it("labels groups beyond Z without collisions", () => {
    const rows = Array.from({ length: 54 }, (_, index) => ({
      id: `move-${index + 1}`,
      superset: index % 2 === 0,
    }));

    expect(supersetInfo(rows).groups[26]).toEqual({
      index: 27,
      letter: "AA",
      ids: ["move-53", "move-54"],
    });
  });
});

describe("plate and session math", () => {
  it("reports the closest achievable bar load when plates cannot hit the target exactly", () => {
    expect(plateBreakdown(226, 45, [45, 25, 10, 5])).toEqual({
      loads: [{ plate: 45, count: 2 }],
      loadedPerSide: 90,
      achieved: 225,
      short: 1,
    });
  });

  it("keeps bar totals, one-rep maxes, and parsed set counts bounded", () => {
    expect(barTotal({ 45: 2, 10: 1, 2.5: 1 }, 45, [45, 25, 10, 5, 2.5])).toBe(250);
    expect(oneRepMax(225, 5)).toBe(263);
    expect(parseCount("AMRAP", 4)).toBe(4);
    expect(parseCount("100", 4)).toBe(50);
  });

  it("uses working maxes for exercise targets and never counts skipped work complete", () => {
    const settings: AppSettings = {
      maxes: { squat: 405, bench: null, deadlift: null, press: null },
      workingMax: true,
      barWeight: 45,
      plates: [45, 35, 25, 10, 5],
    };
    const squat = exercise({ name: "Back Squat", sets: "3", percent: 80, lift: "squat" });

    expect(workingMaxFor(settings, "squat")).toBe(365);
    expect(exerciseTarget(settings, squat)).toBe(290);
    expect(isExerciseComplete(squat, { setsDone: 99, skipped: true, note: "" })).toBe(false);
  });
});
