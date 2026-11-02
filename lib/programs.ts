import type { Exercise, Lift, Program } from "./types";

type SeedExercise = Omit<Exercise, "id">;

type SeedProgram = {
  id: string;
  name: string;
  tags: string[];
  exercises: SeedExercise[];
};

/** Terse builder so the program data below stays readable. */
function e(
  name: string,
  sets: string,
  reps: string,
  options: { percent?: number | null; lift?: Lift | null; notes?: string; superset?: boolean } = {},
): SeedExercise {
  return {
    name,
    sets,
    reps,
    percent: options.percent ?? null,
    lift: options.lift ?? null,
    superset: options.superset ?? false,
    ...(options.notes ? { notes: options.notes } : {}),
  };
}

/**
 * Squatober is Pen and Paper Strength's October block: five lifting days a
 * week, a squat variation every session, accessories after. The official
 * daily doses live in their paid app, so this is a reconstruction of the
 * public shape: an 8-rep ladder opener that climbs 5% a week, one theme per
 * day, weekends off. Import the real one in the You tab if you have it.
 */
const SQUATOBER_WEEKS = [65, 70, 75, 80];

const SQUATOBER_DAYS: { day: number; title: string; build: (percent: number) => SeedExercise[] }[] = [
  {
    day: 1,
    title: "Ladder",
    build: (percent) => [
      e("Back Squat", "5", "4, 6, 8, 6, 4", {
        percent,
        lift: "squat",
        notes: "28 reps in the ladder. Rest 2 minutes between sets.",
      }),
      e("Romanian Deadlift", "3", "8", { percent: percent - 5, lift: "deadlift" }),
      e("Barbell Row", "4", "8"),
      e("Plank", "3", "45s"),
    ],
  },
  {
    day: 2,
    title: "Front Rack",
    build: (percent) => [
      e("Back Squat", "5", "5", { percent, lift: "squat" }),
      e("Front Squat", "3", "6", { percent: percent - 10, lift: "squat" }),
      e("Walking Lunge", "3", "10", { notes: "Each leg." }),
      e("Hanging Knee Raise", "3", "12"),
    ],
  },
  {
    day: 3,
    title: "Pause",
    build: (percent) => [
      e("Pause Squat", "5", "4", {
        percent: percent - 5,
        lift: "squat",
        notes: "Two-count pause in the hole. No bounce.",
      }),
      e("Leg Press", "3", "12"),
      e("Hammer Curl", "3", "10"),
      e("Farmer Carry", "3", "40s"),
    ],
  },
  {
    day: 4,
    title: "Single Leg",
    build: (percent) => [
      e("Back Squat", "4", "6", { percent, lift: "squat" }),
      e("Bulgarian Split Squat", "3", "8", { notes: "Each leg." }),
      e("Pull-Up", "4", "6"),
      e("Side Plank", "3", "30s"),
    ],
  },
  {
    day: 5,
    title: "Top Set",
    build: (percent) => [
      e("Back Squat (top triple)", "1", "3", {
        percent: percent + 10,
        lift: "squat",
        notes: "Heaviest set of the week. Stop when bar speed drops.",
      }),
      e("Back Squat (back-offs)", "3", "5", { percent, lift: "squat" }),
      e("Deadlift", "4", "5", { percent, lift: "deadlift" }),
      e("Bench Press", "4", "6", { percent: percent - 5, lift: "bench" }),
      e("Standing Calf Raise", "3", "15"),
    ],
  },
];

const SQUATOBER: SeedProgram[] = SQUATOBER_WEEKS.flatMap((percent, weekIndex) =>
  SQUATOBER_DAYS.map(({ day, title, build }) => ({
    id: `squatober-w${weekIndex + 1}d${day}`,
    name: `Squatober W${weekIndex + 1}D${day} ${title}`,
    tags: ["Squatober"],
    exercises: build(percent),
  })),
);

/** One 5/3/1 day: the 5s wave plus Boring But Big back-off sets. */
function fiveThreeOne(lift: Lift, label: string, note: string): SeedProgram {
  return {
    id: `531-${lift}`,
    name: `5/3/1 ${label} (5s)`,
    tags: ["5/3/1"],
    exercises: [
      e(label, "1", "5", { percent: 65, lift, notes: note }),
      e(label, "1", "5", { percent: 75, lift }),
      e(label, "1", "5+", { percent: 85, lift, notes: "AMRAP, leave one rep in the tank." }),
      e(`${label} (BBB)`, "5", "10", {
        percent: 50,
        lift,
        notes: "Boring But Big: 5×10 at 50% of your training max.",
      }),
    ],
  };
}

const CLASSICS: SeedProgram[] = [
  {
    id: "stronglifts-a",
    name: "StrongLifts A",
    tags: ["StrongLifts"],
    exercises: [
      e("Back Squat", "5", "5", { lift: "squat", notes: "Add 5 lb when all 25 reps are clean." }),
      e("Bench Press", "5", "5", { lift: "bench" }),
      e("Barbell Row", "5", "5"),
    ],
  },
  {
    id: "stronglifts-b",
    name: "StrongLifts B",
    tags: ["StrongLifts"],
    exercises: [
      e("Back Squat", "5", "5", { lift: "squat" }),
      e("Overhead Press", "5", "5", { lift: "press", notes: "Add 5 lb on upper-body lifts, 10 lb on deadlift." }),
      e("Deadlift", "1", "5", { lift: "deadlift" }),
    ],
  },
  {
    id: "starting-strength-a",
    name: "Starting Strength A",
    tags: ["Starting Strength"],
    exercises: [
      e("Back Squat", "3", "5", { lift: "squat", notes: "Add weight every session. After two misses, back off 10%." }),
      e("Bench Press", "3", "5", { lift: "bench" }),
      e("Deadlift", "1", "5", { lift: "deadlift" }),
    ],
  },
  {
    id: "starting-strength-b",
    name: "Starting Strength B",
    tags: ["Starting Strength"],
    exercises: [
      e("Back Squat", "3", "5", { lift: "squat" }),
      e("Overhead Press", "3", "5", { lift: "press" }),
      e("Power Clean", "5", "3", { notes: "Later novice phases swap the deadlift for cleans." }),
    ],
  },
  fiveThreeOne("press", "Overhead Press", "Weeks 2-3: 70/80/90 and 75/85/95. Deload 40/50/60."),
  fiveThreeOne("deadlift", "Deadlift", "Weeks 2-3: 70/80/90 and 75/85/95. Deload 40/50/60."),
  fiveThreeOne("bench", "Bench Press", "Weeks 2-3: 70/80/90 and 75/85/95. Deload 40/50/60."),
  fiveThreeOne("squat", "Back Squat", "Weeks 2-3: 70/80/90 and 75/85/95. Deload 40/50/60."),
  {
    id: "gzclp-1",
    name: "GZCLP Day 1",
    tags: ["GZCLP"],
    exercises: [
      e("Back Squat (T1)", "5", "3+", {
        lift: "squat",
        notes: "Last set AMRAP, 1-2 reps in reserve. Add 10 lb when the stage is cleared.",
      }),
      e("Bench Press (T2)", "3", "10", { lift: "bench", notes: "Add 5 lb when all reps are clean." }),
      e("Lat Pulldown (T3)", "3", "15", { notes: "Last set AMRAP; add 5 lb once you hit 25 reps." }),
    ],
  },
  {
    id: "gzclp-2",
    name: "GZCLP Day 2",
    tags: ["GZCLP"],
    exercises: [
      e("Overhead Press (T1)", "5", "3+", { lift: "press", notes: "Last set AMRAP." }),
      e("Deadlift (T2)", "3", "10", { lift: "deadlift", notes: "Add 10 lb when clean." }),
      e("Bent-Over Row (T3)", "3", "15"),
    ],
  },
  {
    id: "gzclp-3",
    name: "GZCLP Day 3",
    tags: ["GZCLP"],
    exercises: [
      e("Bench Press (T1)", "5", "3+", { lift: "bench", notes: "Last set AMRAP." }),
      e("Back Squat (T2)", "3", "10", { lift: "squat" }),
      e("Lat Pulldown (T3)", "3", "15"),
    ],
  },
  {
    id: "gzclp-4",
    name: "GZCLP Day 4",
    tags: ["GZCLP"],
    exercises: [
      e("Deadlift (T1)", "5", "3+", { lift: "deadlift", notes: "Last set AMRAP. Reset the bar every rep." }),
      e("Overhead Press (T2)", "3", "10", { lift: "press" }),
      e("Bent-Over Row (T3)", "3", "15"),
    ],
  },
  {
    id: "greyskull-a",
    name: "Greyskull A",
    tags: ["Greyskull"],
    exercises: [
      e("Overhead Press", "3", "5, 5, 5+", {
        lift: "press",
        notes: "Last set AMRAP, stop at RPE 8-9. Add 2.5 lb when you hit 10+.",
      }),
      e("Chin-Up", "3", "5, 5, 5+", { notes: "Add weight once the AMRAP set passes 10." }),
      e("Back Squat", "3", "5, 5, 5+", { lift: "squat", notes: "Add 5 lb; double the jump at 10+ on the last set." }),
    ],
  },
  {
    id: "greyskull-b",
    name: "Greyskull B",
    tags: ["Greyskull"],
    exercises: [
      e("Bench Press", "3", "5, 5, 5+", { lift: "bench" }),
      e("Bent-Over Row", "3", "5, 5, 5+"),
      e("Deadlift", "1", "5+", { lift: "deadlift", notes: "One heavy AMRAP set. On failure, drop 10% and rebuild." }),
    ],
  },
  {
    id: "texas-volume",
    name: "Texas Method Volume",
    tags: ["Texas Method"],
    exercises: [
      e("Back Squat", "5", "5", { percent: 77, lift: "squat", notes: "Approximate: around 77% of your 1RM." }),
      e("Bench Press", "5", "5", {
        percent: 77,
        lift: "bench",
        notes: "Alternate weekly with the overhead press.",
      }),
      e("Deadlift", "1", "5", { percent: 80, lift: "deadlift" }),
    ],
  },
  {
    id: "texas-recovery",
    name: "Texas Method Recovery",
    tags: ["Texas Method"],
    exercises: [
      e("Back Squat", "2", "5", { percent: 62, lift: "squat", notes: "80% of the volume-day weight." }),
      e("Overhead Press", "3", "5", { percent: 70, lift: "press" }),
      e("Chin-Up", "3", "5+", { notes: "Add weight when the last set clears 10." }),
      e("Back Extension", "5", "10"),
    ],
  },
  {
    id: "texas-intensity",
    name: "Texas Method Intensity",
    tags: ["Texas Method"],
    exercises: [
      e("Back Squat", "1", "5", { percent: 85, lift: "squat", notes: "New 5RM attempt. Add about 5 lb a week." }),
      e("Bench Press", "1", "5", { percent: 85, lift: "bench", notes: "Alternate weekly with the overhead press." }),
      e("Power Clean", "5", "3", { percent: 70, notes: "Percentage is of your power clean max." }),
    ],
  },
  {
    id: "phul-upper-power",
    name: "PHUL Upper Power",
    tags: ["PHUL"],
    exercises: [
      e("Barbell Bench Press", "3-4", "3-5", { lift: "bench", notes: "Keep one rep in reserve." }),
      e("Incline Dumbbell Bench", "3-4", "6-10"),
      e("Bent-Over Row", "3-4", "3-5"),
      e("Lat Pulldown", "3-4", "6-10"),
      e("Overhead Press", "2-3", "5-8", { lift: "press" }),
      e("Barbell Curl", "2-3", "6-10"),
      e("Skull Crusher", "2-3", "6-10"),
    ],
  },
  {
    id: "phul-lower-power",
    name: "PHUL Lower Power",
    tags: ["PHUL"],
    exercises: [
      e("Back Squat", "3-4", "3-5", { lift: "squat" }),
      e("Deadlift", "3-4", "3-5", { lift: "deadlift" }),
      e("Leg Press", "3-5", "10-15"),
      e("Leg Curl", "3-4", "6-10"),
      e("Standing Calf Raise", "4", "6-10"),
    ],
  },
  {
    id: "phul-upper-hypertrophy",
    name: "PHUL Upper Hypertrophy",
    tags: ["PHUL"],
    exercises: [
      e("Incline Barbell Bench", "3-4", "8-12", { lift: "bench" }),
      e("Dumbbell Flye", "3-4", "8-12"),
      e("Seated Cable Row", "3-4", "8-12"),
      e("One-Arm DB Row", "3-4", "8-12"),
      e("DB Lateral Raise", "3-4", "8-12"),
      e("Incline DB Curl", "3-4", "8-12"),
      e("Cable Triceps Extension", "3-4", "8-12"),
    ],
  },
  {
    id: "phul-lower-hypertrophy",
    name: "PHUL Lower Hypertrophy",
    tags: ["PHUL"],
    exercises: [
      e("Front Squat", "3-4", "8-12", { lift: "squat" }),
      e("Barbell Lunge", "3-4", "8-12", { notes: "Each leg." }),
      e("Leg Extension", "3-4", "10-15"),
      e("Leg Curl", "3-4", "10-15"),
      e("Seated Calf Raise", "3-4", "8-12"),
      e("Calf Press", "3-4", "8-12"),
    ],
  },
  {
    id: "ppl-push",
    name: "Push / Pull / Legs: Push",
    tags: ["PPL"],
    exercises: [
      e("Bench Press", "3", "5-7", { lift: "bench" }),
      e("Seated DB Shoulder Press", "3", "6-8"),
      e("Incline DB Press", "3", "8-10"),
      e("Side Lateral Raise", "2", "10-12"),
      e("Triceps Pressdown", "2", "8-10"),
      e("Overhead Triceps Extension", "2", "8-10"),
    ],
  },
  {
    id: "ppl-pull",
    name: "Push / Pull / Legs: Pull",
    tags: ["PPL"],
    exercises: [
      e("Bent-Over Row", "3", "5-7"),
      e("Pull-Up", "3", "6-8"),
      e("Barbell Shrug", "3", "8-10"),
      e("Face Pull", "2", "10-12"),
      e("Barbell Curl", "2", "8-10"),
      e("DB Hammer Curl", "2", "8-10"),
    ],
  },
  {
    id: "ppl-legs",
    name: "Push / Pull / Legs: Legs",
    tags: ["PPL"],
    exercises: [
      e("Back Squat", "3", "6-8", { lift: "squat" }),
      e("Romanian Deadlift", "2", "8-10", { lift: "deadlift" }),
      e("Leg Press", "2", "10-12"),
      e("Leg Curl", "2", "10-12"),
      e("Standing Calf Raise", "4", "8-10"),
      e("Hanging Leg Raise", "2", "10-15"),
    ],
  },
];

const seed: SeedProgram[] = [...SQUATOBER, ...CLASSICS];

function withIds(program: SeedProgram): Program {
  return {
    ...program,
    exercises: program.exercises.map((exercise, index) => ({
      ...exercise,
      id: `${program.id}-${index}`,
    })),
  };
}

export const DEFAULT_PROGRAMS: Program[] = seed.map(withIds);

export const LIFT_LABEL: Record<Lift, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
  press: "Press",
};

export function programTagList(program: Program) {
  const tags = new Set(program.tags);
  for (const exercise of program.exercises) {
    if (exercise.lift) tags.add(LIFT_LABEL[exercise.lift]);
  }
  return [...tags].slice(0, 3);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

type AnvilWorkout = {
  workout?: string;
  index?: number;
  bench?: boolean;
  squat?: boolean;
  deadlift?: boolean;
  squatober?: boolean;
  freeweights_only?: boolean;
};

type AnvilWorkoutDetail = {
  title?: string;
  order?: number;
  workout?: string;
  sets?: string | number | null;
  reps?: string | number | null;
  percent?: number | null;
  notes?: string | null;
  superset?: boolean;
  superset_2?: boolean;
  bench?: boolean;
  squat?: boolean;
  deadlift?: boolean;
};

function liftFor(detail: AnvilWorkoutDetail): Lift | null {
  if (detail.bench) return "bench";
  if (detail.squat) return "squat";
  if (detail.deadlift) return "deadlift";
  return null;
}

function toText(value: string | number | null | undefined, fallback: string) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

/**
 * Converts an Anvil Data Tables export (`workouts` + `workout_details`) into
 * programs. Export both tables from the Anvil app as JSON and drop the file in.
 */
export function importAnvilTables(raw: unknown): Program[] {
  if (!raw || typeof raw !== "object") throw new Error("That file is not valid JSON.");
  const data = raw as { workouts?: AnvilWorkout[]; workout_details?: AnvilWorkoutDetail[] };
  const workouts = Array.isArray(data.workouts) ? data.workouts : [];
  const details = Array.isArray(data.workout_details) ? data.workout_details : [];

  if (!workouts.length && !details.length) {
    throw new Error("Expected a JSON object with `workouts` and `workout_details` arrays.");
  }

  const titles = workouts.length
    ? [...workouts].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((w) => w.workout ?? "")
    : [...new Set(details.map((d) => d.title ?? ""))];

  const programs: Program[] = [];

  for (const title of titles) {
    if (!title) continue;
    const rows = details
      .filter((detail) => detail.title === title)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const exercises: Exercise[] = rows.map((row, index) => ({
      id: `${slugify(title)}-${index}`,
      name: row.workout?.trim() || "Exercise",
      sets: toText(row.sets, "3"),
      reps: toText(row.reps, "8"),
      percent: typeof row.percent === "number" ? row.percent : null,
      lift: liftFor(row),
      superset: Boolean(row.superset || row.superset_2),
      notes: row.notes ?? undefined,
    }));

    if (!exercises.length) continue;

    const workoutRow = workouts.find((w) => w.workout === title);
    const tags: string[] = [];
    if (workoutRow?.bench) tags.push("Bench");
    if (workoutRow?.squat) tags.push("Squat");
    if (workoutRow?.deadlift) tags.push("Deadlift");
    if (workoutRow?.squatober) tags.push("Squatober");
    if (workoutRow?.freeweights_only) tags.push("Free weights");

    programs.push({
      id: slugify(title) || `program-${programs.length + 1}`,
      name: title,
      tags,
      exercises,
    });
  }

  if (!programs.length) throw new Error("No programs found in that file.");
  return programs;
}
