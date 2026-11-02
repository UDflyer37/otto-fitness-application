import type { Lift, Program } from "./types";
import { autoDemo } from "./demos";
import { LIFT_LABEL, slugify } from "./programs";

/**
 * Reads the spreadsheet template people fill in: one row per movement, the
 * workout name repeated down the first column so rows group into sessions.
 */
export type CsvRow = {
  workout: string;
  order: number;
  exercise: string;
  sets: string;
  reps: string;
  percent: number | null;
  lift: Lift | null;
  notes: string;
  superset: boolean;
};

const COLUMNS: Record<string, keyof CsvRow> = {
  workout: "workout",
  program: "workout",
  day: "workout",
  session: "workout",
  order: "order",
  exercise: "exercise",
  movement: "exercise",
  name: "exercise",
  sets: "sets",
  reps: "reps",
  percent: "percent",
  percentage: "percent",
  intensity: "percent",
  lift: "lift",
  focus: "lift",
  "main lift": "lift",
  notes: "notes",
  note: "notes",
  superset: "superset",
  pair: "superset",
};

const LIFTS: Record<string, Lift> = {
  squat: "squat",
  bench: "bench",
  "bench press": "bench",
  deadlift: "deadlift",
  dead: "deadlift",
  press: "press",
  "overhead press": "press",
};

/** Splits CSV text into rows, honouring quoted fields and quoted newlines. */
function readRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim().length));
}

export function looksLikeCsv(text: string) {
  const head = text.trimStart();
  return !head.startsWith("{") && !head.startsWith("[") && head.includes(",");
}

export function parseWorkoutCsv(text: string): Program[] {
  const rows = readRows(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    throw new Error("That file only has a header row. Add at least one movement below it.");
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const positions = new Map<keyof CsvRow, number>();
  header.forEach((cell, index) => {
    const key = COLUMNS[cell];
    if (key && !positions.has(key)) positions.set(key, index);
  });

  if (!positions.has("workout") || !positions.has("exercise")) {
    throw new Error(
      'The template needs a "workout" column and an "exercise" column in the header row.',
    );
  }

  const cell = (row: string[], key: keyof CsvRow) => {
    const index = positions.get(key);
    return index === undefined ? "" : (row[index] ?? "").trim();
  };

  const groups = new Map<string, Program>();
  let order = 0;

  for (const row of rows.slice(1)) {
    const workout = cell(row, "workout") || "My workout";
    const exercise = cell(row, "exercise");
    if (!exercise) continue;

    order += 1;
    const percentText = cell(row, "percent").replace("%", "");
    const percent = percentText ? Number(percentText) : null;
    const liftText = cell(row, "lift").toLowerCase();

    const exerciseEntry = {
      id: `${slugify(workout) || "program"}-${order}`,
      name: exercise,
      sets: cell(row, "sets") || "3",
      reps: cell(row, "reps") || "8",
      percent: percent !== null && Number.isFinite(percent) ? Math.round(percent) : null,
      lift: LIFTS[liftText] ?? null,
      superset: /^(true|yes|y|1)$/i.test(cell(row, "superset")),
      notes: cell(row, "notes") || undefined,
      demo: autoDemo(exercise),
    };

    const existing = groups.get(workout);
    if (existing) {
      existing.exercises.push(exerciseEntry);
    } else {
      groups.set(workout, {
        id: `${slugify(workout) || "program"}-${groups.size + 1}`,
        name: workout,
        tags: [],
        exercises: [exerciseEntry],
      });
    }
  }

  const programs = [...groups.values()];
  if (!programs.length) throw new Error("No movements found. Put one movement name per row.");

  return programs.map((program) => {
    const lifts = program.exercises.map((exercise) => exercise.lift);
    const tags = [...new Set(lifts.filter(Boolean))].map((lift) => LIFT_LABEL[lift as Lift]);
    return { ...program, tags: tags.length ? tags.slice(0, 3) : ["Free weights"] };
  });
}
