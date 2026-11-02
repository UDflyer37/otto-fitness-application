#!/usr/bin/env node
/**
 * Pulls two-frame movement demonstrations from the public-domain
 * free-exercise-db (github.com/yuhonas/free-exercise-db) into public/moves,
 * resizes them with sips, and writes lib/moveArt.ts.
 *
 * Run with: npm run moves
 *
 * Each movement ships as two frames: the start position and the end position.
 * The UI cross-fades between them, which is how the classic exercise GIFs were
 * made in the first place.
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, readdir, stat, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT_DIR = path.join(ROOT, "public", "moves");
const MANIFEST = path.join(ROOT, "lib", "moveArt.ts");
const MIRRORS = [
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises",
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises",
];

const SIZES = [
  { suffix: "160", width: 160, quality: 52 },
  { suffix: "640", width: 640, quality: 59 },
];

/**
 * One entry per movement. `names` are the labels this app (and most gym-goers)
 * use, so the lookup stays forgiving; `id` is the free-exercise-db folder.
 */
const MOVES = [
  { id: "Barbell_Squat", names: ["Back Squat", "Pause Squat", "Belt Squat", "Squat"] },
  { id: "Front_Barbell_Squat", names: ["Front Squat"] },
  { id: "Goblet_Squat", names: ["Goblet Squat"] },
  { id: "Box_Squat", names: ["Box Squat"] },
  { id: "Barbell_Hack_Squat", names: ["Hack Squat"] },
  { id: "Smith_Machine_Squat", names: ["Smith Machine Squat"] },
  { id: "Barbell_Bench_Press_-_Medium_Grip", names: ["Bench Press", "Barbell Bench Press", "Flat Bench"] },
  { id: "Decline_Barbell_Bench_Press", names: ["Decline Bench Press"] },
  { id: "Barbell_Incline_Bench_Press_-_Medium_Grip", names: ["Incline Barbell Bench", "Incline Bench Press"] },
  { id: "Incline_Dumbbell_Press", names: ["Incline DB Press", "Incline Dumbbell Bench", "Incline Dumbbell Press"] },
  { id: "Dumbbell_Bench_Press", names: ["Dumbbell Bench Press", "DB Bench Press", "DB Bench"] },
  { id: "Dumbbell_Flyes", names: ["Dumbbell Flye", "Dumbbell Fly", "DB Fly"] },
  { id: "Incline_Dumbbell_Flyes", names: ["Incline Dumbbell Fly", "Incline DB Fly"] },
  { id: "Cable_Crossover", names: ["Cable Crossover", "Cable Fly", "Cable Flye"] },
  { id: "Barbell_Deadlift", names: ["Deadlift", "Conventional Deadlift"] },
  { id: "Romanian_Deadlift", names: ["Romanian Deadlift", "RDL"] },
  { id: "Sumo_Deadlift", names: ["Sumo Deadlift"] },
  { id: "Good_Morning", names: ["Good Morning"] },
  { id: "Bent_Over_Barbell_Row", names: ["Barbell Row", "Bent-Over Row", "Bent Over Row", "Pendlay Row"] },
  { id: "One-Arm_Dumbbell_Row", names: ["One-Arm DB Row", "Single Arm Row", "One Arm Dumbbell Row"] },
  { id: "Bent_Over_Two-Dumbbell_Row", names: ["Dumbbell Row", "Two-Arm Dumbbell Row"] },
  { id: "Seated_Cable_Rows", names: ["Seated Cable Row", "Cable Row"] },
  { id: "Upright_Barbell_Row", names: ["Upright Row"] },
  { id: "Wide-Grip_Lat_Pulldown", names: ["Lat Pulldown", "Pull Down"] },
  { id: "Pullups", names: ["Pull-Up", "Pull Up", "Pullup"] },
  { id: "Chin-Up", names: ["Chin-Up", "Chin Up"] },
  { id: "Standing_Military_Press", names: ["Overhead Press", "Military Press", "Strict Press", "Press"] },
  { id: "Seated_Dumbbell_Press", names: ["Seated DB Shoulder Press", "Dumbbell Shoulder Press", "DB Shoulder Press"] },
  { id: "Arnold_Dumbbell_Press", names: ["Arnold Press"] },
  { id: "Side_Lateral_Raise", names: ["Side Lateral Raise", "DB Lateral Raise", "Lateral Raise"] },
  { id: "Face_Pull", names: ["Face Pull"] },
  { id: "Barbell_Shrug", names: ["Barbell Shrug"] },
  { id: "Dumbbell_Shrug", names: ["Dumbbell Shrug", "DB Shrug"] },
  { id: "Barbell_Curl", names: ["Barbell Curl"] },
  { id: "Dumbbell_Bicep_Curl", names: ["Dumbbell Curl", "DB Curl"] },
  { id: "Hammer_Curls", names: ["Hammer Curl", "DB Hammer Curl"] },
  { id: "Incline_Dumbbell_Curl", names: ["Incline DB Curl", "Incline Dumbbell Curl"] },
  { id: "Preacher_Curl", names: ["Preacher Curl"] },
  { id: "Concentration_Curls", names: ["Concentration Curl"] },
  { id: "Reverse_Barbell_Curl", names: ["Reverse Curl"] },
  { id: "Standing_Biceps_Cable_Curl", names: ["Cable Curl"] },
  { id: "EZ-Bar_Skullcrusher", names: ["Skull Crusher", "Skullcrusher", "Lying Triceps Extension"] },
  { id: "Triceps_Pushdown", names: ["Triceps Pressdown", "Triceps Pushdown", "Pressdown"] },
  { id: "Triceps_Pushdown_-_Rope_Attachment", names: ["Cable Triceps Extension", "Rope Pushdown"] },
  { id: "Standing_Dumbbell_Triceps_Extension", names: ["Overhead Triceps Extension", "Dumbbell Overhead Extension"] },
  { id: "Cable_Rope_Overhead_Triceps_Extension", names: ["Cable Overhead Triceps Extension"] },
  { id: "Lying_Triceps_Press", names: ["Lying Triceps Press"] },
  { id: "Lying_Leg_Curls", names: ["Leg Curl", "Lying Leg Curl"] },
  { id: "Seated_Leg_Curl", names: ["Seated Leg Curl"] },
  { id: "Leg_Extensions", names: ["Leg Extension"] },
  { id: "Leg_Press", names: ["Leg Press"] },
  { id: "Calf_Press_On_The_Leg_Press_Machine", names: ["Calf Press"] },
  { id: "Standing_Calf_Raises", names: ["Standing Calf Raise"] },
  { id: "Seated_Calf_Raise", names: ["Seated Calf Raise"] },
  { id: "Barbell_Seated_Calf_Raise", names: ["Barbell Seated Calf Raise"] },
  { id: "Split_Squats", names: ["Bulgarian Split Squat", "Split Squat"] },
  { id: "Barbell_Lunge", names: ["Barbell Lunge"] },
  { id: "Barbell_Walking_Lunge", names: ["Walking Lunge"] },
  { id: "Dumbbell_Lunges", names: ["Dumbbell Lunge"] },
  { id: "Dumbbell_Step_Ups", names: ["Step Up", "Step-Up"] },
  { id: "Barbell_Hip_Thrust", names: ["Hip Thrust"] },
  { id: "Barbell_Glute_Bridge", names: ["Glute Bridge"] },
  { id: "Hyperextensions_Back_Extensions", names: ["Back Extension", "Hyperextension"] },
  { id: "Hanging_Leg_Raise", names: ["Hanging Leg Raise"] },
  { id: "Bent-Knee_Hip_Raise", names: ["Hanging Knee Raise", "Knee Raise"] },
  { id: "Plank", names: ["Plank"] },
  { id: "Side_Bridge", names: ["Side Plank"] },
  { id: "Crunches", names: ["Crunch", "Crunches"] },
  { id: "Russian_Twist", names: ["Russian Twist"] },
  { id: "Pallof_Press", names: ["Pallof Press"] },
  { id: "Dead_Bug", names: ["Dead Bug"] },
  { id: "Mountain_Climbers", names: ["Mountain Climber"] },
  { id: "Farmers_Walk", names: ["Farmer Carry", "Farmers Walk", "Farmer's Walk"] },
  { id: "Power_Clean", names: ["Power Clean", "Clean"] },
  { id: "Hang_Clean", names: ["Hang Clean"] },
  { id: "Clean_and_Jerk", names: ["Clean and Jerk"] },
  { id: "Snatch", names: ["Snatch"] },
  { id: "Parallel_Bar_Dip", names: ["Dip", "Dips"] },
  { id: "Pushups", names: ["Push-Up", "Push Up", "Pushup"] },
  { id: "Box_Jump_Multiple_Response", names: ["Box Jump"] },
  { id: "Rope_Jumping", names: ["Jump Rope"] },
  { id: "One-Arm_Kettlebell_Swings", names: ["Kettlebell Swing", "KB Swing"] },
];

const slugFor = (id) => id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Kept in sync with the copy written into lib/moveArt.ts. */
const STOP_WORDS = new Set([
  "the",
  "a",
  "of",
  "with",
  "and",
  "machine",
  "medium",
  "grip",
  "barbell",
  "dumbbell",
  "db",
  "bb",
]);

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[-_/&]/g, " ")
    .replace(/\bdb\b/g, "dumbbell")
    .replace(/\bbb\b/g, "barbell")
    .replace(/\brows\b/g, "row")
    .replace(/\bcurls\b/g, "curl")
    .replace(/\bflyes\b|\bflye\b/g, "fly")
    .replace(/\bpresses\b/g, "press")
    .replace(/\bpullups\b|\bpullup\b/g, "pull up")
    .replace(/\bchinups\b|\bchinup\b/g, "chin up")
    .replace(/\bsquats\b/g, "squat")
    .replace(/\bextensions\b/g, "extension")
    .replace(/\braises\b/g, "raise")
    .replace(/\blunges\b/g, "lunge")
    .replace(/\bdeadlifts\b/g, "deadlift")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFrame(id, frame) {
  const errors = [];
  for (const mirror of MIRRORS) {
    const url = `${mirror}/${id}/${frame}.jpg`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) throw new Error(`suspiciously small (${buf.length}b) ${url}`);
      return buf;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join(" | "));
}

function resize(input, output, width, quality) {
  execFileSync("sips", ["-Z", String(width), "-s", "formatOptions", String(quality), input, "--out", output], {
    stdio: "ignore",
  });
}

async function run() {
  if (!existsSync(path.join(ROOT, "node_modules"))) {
    console.warn("warning: node_modules is missing, but this script only needs node + sips");
  }
  await mkdir(OUT_DIR, { recursive: true });

  const wanted = new Set(MOVES.map((move) => slugFor(move.id)));
  // Drop folders for movements that no longer exist so the folder matches the list.
  for (const entry of await readdir(OUT_DIR).catch(() => [])) {
    if (!wanted.has(entry)) await rm(path.join(OUT_DIR, entry), { recursive: true, force: true });
  }

  let done = 0;
  const failures = [];

  const queue = [...MOVES];
  const worker = async () => {
    for (;;) {
      const move = queue.shift();
      if (!move) return;
      const slug = slugFor(move.id);
      const dir = path.join(OUT_DIR, slug);
      const ready = await Promise.all(
        ["a", "b"].flatMap((frame) =>
          SIZES.map(async (size) => {
            const info = await stat(path.join(dir, `${frame}-${size.suffix}.jpg`)).catch(() => null);
            return Boolean(info && info.size > 1500);
          }),
        ),
      );
      if (ready.every(Boolean)) {
        done += 1;
        process.stdout.write(`\r${done}/${MOVES.length} movements`);
        continue;
      }
      try {
        await mkdir(dir, { recursive: true });
        for (const frame of ["a", "b"]) {
          const source = frame === "a" ? "0" : "1";
          const tmp = path.join(dir, `_${frame}.jpg`);
          const buf = await fetchFrame(move.id, source);
          await writeFile(tmp, buf);
          for (const size of SIZES) {
            resize(tmp, path.join(dir, `${frame}-${size.suffix}.jpg`), size.width, size.quality);
          }
          await rm(tmp, { force: true });
        }
        for (const frame of ["a", "b"]) {
          for (const size of SIZES) {
            const file = path.join(dir, `${frame}-${size.suffix}.jpg`);
            const info = await stat(file).catch(() => null);
            if (!info || info.size < 1500) throw new Error(`empty output ${file}`);
          }
        }
      } catch (error) {
        failures.push(`${move.id}: ${error instanceof Error ? error.message : error}`);
        await rm(dir, { recursive: true, force: true });
      }
      done += 1;
      process.stdout.write(`\r${done}/${MOVES.length} movements`);
    }
  };

  // Four at a time keeps jsDelivr happy without dragging the run out.
  await Promise.all([worker(), worker(), worker(), worker()]);
  process.stdout.write("\n");

  const shipped = MOVES.filter((move) => existsSync(path.join(OUT_DIR, slugFor(move.id), "a-640.jpg")));
  const aliases = {};
  const entries = [];
  for (const move of shipped) {
    const slug = slugFor(move.id);
    entries.push({ slug, id: move.id, label: move.names[0], names: move.names });
    for (const name of move.names) aliases[normalize(name)] = slug;
  }

  const stopLiteral = JSON.stringify([...STOP_WORDS]);

  const source = `// Generated by scripts/fetch-move-art.mjs. Do not edit by hand.
// Frames: public/moves/<slug>/{a,b}-{160,480}.jpg
// Source: github.com/yuhonas/free-exercise-db (public domain).

export type MoveArt = {
  /** Folder under /moves. */
  slug: string;
  /** Display label for the movement. */
  name: string;
  /** Every label this movement answers to, outside the alias table. */
  names: string[];
};

export const MOVE_ART: MoveArt[] = [
${entries
  .map(
    (entry) =>
      `  { slug: ${JSON.stringify(entry.slug)}, name: ${JSON.stringify(entry.label)}, names: ${JSON.stringify(
        entry.names,
      )} },`,
  )
  .join("\n")}
];

const BY_NAME: Record<string, string> = ${JSON.stringify(aliases, null, 2)};

/**
 * Resolves an exercise name to a movement demo. Tolerates the suffixes the
 * program data uses ("Back Squat (T1)"), plurals and extra words.
 */
export function moveArtFor(name: string): MoveArt | null {
  const base = name
    .replace(/\\s*[\\u2014\\u2013-]\\s*(T[123]|top triple|back-offs|back offs|top set|amrap|pause)\\b.*$/i, "")
    .replace(/\\([^)]*\\)/g, " ")
    .trim();
  const direct = BY_NAME[normalize(base)] ?? BY_NAME[normalize(name)];
  if (direct) return MOVE_ART.find((entry) => entry.slug === direct) ?? null;

  // Fall back to the movement that shares the most meaningful words.
  const wanted = words(base);
  if (!wanted.size) return null;
  let best = null;
  let bestScore = 0;
  for (const entry of MOVE_ART) {
    let score = 0;
    for (const label of entry.names) {
      const have = words(label);
      let hits = 0;
      for (const word of wanted) if (have.has(word)) hits += 1;
      const misses = [...have].filter((word) => !wanted.has(word)).length;
      score = Math.max(score, hits === wanted.size && hits > 0 ? hits * 2 - misses : 0);
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
}

const STOP = new Set(${stopLiteral});

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[-_/&]/g, " ")
    .replace(/\\bdb\\b/g, "dumbbell")
    .replace(/\\bbb\\b/g, "barbell")
    .replace(/\\brows\\b/g, "row")
    .replace(/\\bcurls\\b/g, "curl")
    .replace(/\\bflyes\\b|\\bflye\\b/g, "fly")
    .replace(/\\bpresses\\b/g, "press")
    .replace(/\\bpullups\\b|\\bpullup\\b/g, "pull up")
    .replace(/\\bchinups\\b|\\bchinup\\b/g, "chin up")
    .replace(/\\bsquats\\b/g, "squat")
    .replace(/\\bextensions\\b/g, "extension")
    .replace(/\\braises\\b/g, "raise")
    .replace(/\\blunges\\b/g, "lunge")
    .replace(/\\bdeadlifts\\b/g, "deadlift")
    .replace(/\\s+/g, " ")
    .trim();
}

function words(value: string) {
  return new Set(normalize(value).split(" ").filter((word) => word && !STOP.has(word)));
}
`;

  await writeFile(MANIFEST, source);
  console.log(`wrote ${shipped.length} movements to public/moves and ${path.relative(ROOT, MANIFEST)}`);
  if (failures.length) {
    console.error(`\n${failures.length} failed:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
