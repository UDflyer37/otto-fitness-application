import { guessLift, newExerciseId } from "./library";
import type { Lift, LibraryExercise } from "./types";

export type DraftExercise = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  percent: number | null;
  lift: Lift | null;
  /** Bundled demo slug or uploaded image, stamped when the draft is built. */
  demo?: string | null;
  /** True when the movement is linked to the next one in a superset. */
  superset?: boolean;
  /** True when we inferred it from a body part or piece of equipment. */
  suggested?: boolean;
};

export type DraftProgram = {
  name: string;
  exercises: DraftExercise[];
};

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

/** Words that mean "give me something", not "do this movement". */
const FILLER =
  /\b(destroy|wreck|smash|crush|kill|murder|annihilate|burn|hammer|hit|work|train|do|let'?s|lets|let us|i want to|i wanna|wanna|want to|need to|give me|make me|set me up|today|today's|please|maybe|some|a bit of|bit of|my|me|up|out|the|a|an|and|then|also|with|for|on|at|to|of|day|session|workout|program|routine|stuff|things)\b/gi;

const BODY_PARTS: { key: BodyPart; label: string; title: string; pattern: RegExp }[] = [
  {
    key: "legs",
    label: "legs",
    title: "Leg Day",
    pattern:
      /\b(leg|legs|lower body|quads?|hams?|hamstrings?|glutes?|calves?|calf|squat|squats|deadlift|deadlifts|lunge|lunges|rdl|hip thrust)\b/i,
  },
  {
    key: "push",
    label: "chest and shoulders",
    title: "Push Day",
    pattern: /\b(push|chest|pecs?|shoulders?|delts?|triceps?|press|presses|overhead)\b/i,
  },
  {
    key: "pull",
    label: "back",
    title: "Pull Day",
    pattern: /\b(pull|back|lats?|biceps?|rows?|row|chin ?ups?|pull ?ups?|shrugs?)\b/i,
  },
  {
    key: "arms",
    label: "arms",
    title: "Arm Day",
    pattern: /\b(arms?|biceps?|triceps?|curls?|guns)\b/i,
  },
  {
    key: "core",
    label: "core",
    title: "Core Day",
    pattern: /\b(core|abs?|abdominals?|obliques?|planks?|crunches?|six ?pack)\b/i,
  },
  {
    key: "full",
    label: "full body",
    title: "Full Body",
    pattern: /\b(full body|whole body|everything|total body)\b/i,
  },
];

type BodyPart = "legs" | "push" | "pull" | "arms" | "core" | "full";

type Equipment = {
  key: string;
  label: string;
  pattern: RegExp;
  moves: string[];
};

const EQUIPMENT: Equipment[] = [
  {
    key: "smith",
    label: "Smith machine",
    pattern: /\bsmith\b/i,
    moves: [
      "Smith Machine Squat",
      "Smith Machine Bench Press",
      "Smith Machine Overhead Press",
      "Smith Machine Hip Thrust",
      "Smith Machine Calf Raise",
      "Smith Machine Row",
    ],
  },
  {
    key: "dumbbell",
    label: "dumbbell",
    pattern: /\b(dumbbells?|dbs?)\b/i,
    moves: [
      "Dumbbell Bench Press",
      "One-Arm DB Row",
      "DB Overhead Press",
      "DB Walking Lunge",
      "DB Romanian Deadlift",
      "Hammer Curl",
    ],
  },
  {
    key: "kettlebell",
    label: "kettlebell",
    pattern: /\b(kettlebells?|kbs?)\b/i,
    moves: ["Goblet Squat", "Kettlebell Swing", "Kettlebell Press", "Kettlebell Row"],
  },
  {
    key: "cable",
    label: "cable",
    pattern: /\b(cables?|pulley|lat pulldown|pushdown)\b/i,
    moves: [
      "Cable Row",
      "Lat Pulldown",
      "Cable Fly",
      "Triceps Pushdown",
      "Cable Curl",
      "Face Pull",
    ],
  },
  {
    key: "machine",
    label: "machine",
    pattern: /\bmachines?\b/i,
    moves: ["Leg Press", "Leg Curl", "Leg Extension", "Chest Press Machine", "Lat Pulldown"],
  },
  {
    key: "bodyweight",
    label: "bodyweight",
    pattern: /\b(bodyweight|body weight|calisthenics?|no equipment|nothing but me)\b/i,
    moves: ["Push-Up", "Pull-Up", "Walking Lunge", "Glute Bridge", "Plank", "Dip"],
  },
  {
    key: "band",
    label: "band",
    pattern: /\bbands?\b/i,
    moves: ["Band Pull-Apart", "Band Face Pull", "Band Row", "Band Press"],
  },
  {
    key: "barbell",
    label: "barbell",
    pattern: /\b(barbells?|oly|olympic)\b/i,
    moves: [
      "Back Squat",
      "Bench Press",
      "Deadlift",
      "Barbell Row",
      "Overhead Press",
      "Romanian Deadlift",
    ],
  },
];

/** Movements to fall back on when the request names a body part but no movement. */
const BODY_MOVES: Record<BodyPart, string[]> = {
  legs: ["Back Squat", "Romanian Deadlift", "Leg Press", "Walking Lunge", "Leg Curl", "Standing Calf Raise"],
  push: ["Bench Press", "Overhead Press", "Incline DB Press", "Cable Fly", "Triceps Pushdown"],
  pull: ["Barbell Row", "Lat Pulldown", "Pull-Up", "Face Pull", "Hammer Curl"],
  arms: ["Barbell Curl", "Hammer Curl", "Triceps Pushdown", "Skull Crusher"],
  core: ["Plank", "Hanging Knee Raise", "Cable Crunch", "Side Plank"],
  full: ["Back Squat", "Bench Press", "Barbell Row", "Overhead Press", "Romanian Deadlift"],
};

const TAG_PATTERNS: { part: BodyPart; pattern: RegExp }[] = [
  { part: "legs", pattern: /squat|deadlift|lunge|leg|calf|calves|hip thrust|step ?up|glute/i },
  { part: "push", pattern: /bench|press|fly|pushdown|dip|push-?up|overhead|raise/i },
  { part: "pull", pattern: /row|pulldown|pull-?up|chin|curl|shrug|face pull|pull-apart/i },
  { part: "arms", pattern: /curl|pushdown|extension|skull/i },
  { part: "core", pattern: /plank|crunch|raise|sit-?up|carry|rollout/i },
];

function partsOf(name: string): BodyPart[] {
  // "curl" says arms, except for the hamstring one.
  if (/nordic|leg curl|hamstring/i.test(name)) return ["legs"];
  const found = TAG_PATTERNS.filter((entry) => entry.pattern.test(name)).map((entry) => entry.part);
  return found.length ? found : ["full"];
}

/**
 * Speech recognition returns words far more often than digits
 * ("five by five bench at eighty percent"), so normalise them first.
 */
function normalizeSpoken(text: string) {
  return text
    .replace(
      /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](one|two|three|four|five|six|seven|eight|nine)\b/gi,
      (_match, tens: string, unit: string) =>
        String(NUMBER_WORDS[tens.toLowerCase()] + NUMBER_WORDS[unit.toLowerCase()]),
    )
    .replace(/\b(a\s+)?hundred\b/gi, "100")
    .replace(
      /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/gi,
      (match) => String(NUMBER_WORDS[match.toLowerCase()]),
    )
    .replace(/\b(\d{1,3})\s+by\s+(\d{1,3})\b/gi, "$1x$2")
    .replace(/\bpercent\b/gi, "%");
}

function splitSegments(text: string) {
  const rough = text.split(
    /\n|;|\.|!|\?|(?:\s+\+\s+)|(?:,?\s*\band\s+then\b\s*)|(?:,?\s*\bthen\b\s*)|(?:,?\s*\bafter that\b\s*)/i,
  );
  const pieces: string[] = [];

  for (const block of rough) {
    // Split "3x5 squat, 3x8 bench" and "3x12 pull, 3 sets of 10 press"
    // but leave "3 sets, 5 reps" together.
    for (const part of block.split(/,\s*(?=[^,]*\d{1,2}\s*(?:x\s*\d|sets?\b|rounds?\b))/i)) {
      const trimmed = part.trim();
      if (trimmed) pieces.push(trimmed);
    }
  }

  // "4 sets of rows and some curls" is two movements, not one.
  const movementish = (text: string) =>
    /(squat|bench|deadlift|press|row|lunge|curl|plank|raise|pull|push|dip|fly|thrust|jump|carry|swing|extension|pulldown|pushdown|calves|calf|shrug)/i.test(
      text,
    );

  return pieces.flatMap((piece) => {
    if (!/\sand\s/i.test(piece)) return [piece];
    const halves = piece.split(/\sand\s/i).map((half) => half.trim());
    return halves.filter(movementish).length > 1 ? halves.filter(Boolean) : [piece];
  });
}

function polishName(raw: string) {
  const cleaned = raw
    .split(",")[0]
    .replace(FILLER, " ")
    .replace(/^[-\u2013\u2014:,.%]+/, "")
    .replace(/[.,;:%!?]+$/g, "")
    .replace(/%/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (cleaned !== cleaned.toLowerCase()) return cleaned;
  return cleaned.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

type ParsedNumbers = {
  sets: string | null;
  reps: string | null;
  percent: number | null;
  rest: string;
};

function readNumbers(segment: string): ParsedNumbers {
  let rest = ` ${segment} `;
  let sets: string | null = null;
  let reps: string | null = null;
  let percent: number | null = null;

  const percentMatch =
    /\b(\d{1,3})\s*%/i.exec(rest) ??
    /\b(\d{1,3})\s*percent\b/i.exec(rest) ??
    /@\s*(\d{1,3})\b/.exec(rest) ??
    /\bat\s+(\d{1,3})\b/i.exec(rest);
  if (percentMatch) {
    const value = Number(percentMatch[1]);
    if (value >= 20 && value <= 130) {
      percent = value;
      rest = rest.replace(percentMatch[0], " ");
    }
  }

  const pair = /\b(\d{1,2})\s*[x×]\s*(\d{1,3})(?:\s*(?:reps?|times))?/i.exec(rest);
  if (pair) {
    sets = pair[1];
    reps = pair[2];
    rest = rest.replace(pair[0], " ");
  } else {
    const setFirst = /\b(\d{1,2})\s*(?:sets?|rounds?)\s*(?:of|x|×)?\s*(\d{1,3})?\s*(?:reps?)?/i.exec(rest);
    if (setFirst) {
      sets = setFirst[1];
      if (setFirst[2]) reps = setFirst[2];
      rest = rest.replace(setFirst[0], " ");
    } else {
      const repOnly = /\b(\d{1,3})\s*(?:reps?|times)\b/i.exec(rest);
      if (repOnly) {
        reps = repOnly[1];
        rest = rest.replace(repOnly[0], " ");
      }
    }
  }

  if (!reps && /\bamrap\b/i.test(rest)) {
    reps = "AMRAP";
    rest = rest.replace(/\bamrap\b/gi, " ");
  }

  return { sets, reps, percent, rest };
}

function matchLibrary(text: string, library: LibraryExercise[]) {
  const haystack = text.toLowerCase();
  let best: LibraryExercise | null = null;

  for (const item of library) {
    const needle = item.name.toLowerCase();
    if (needle.length < 3) continue;
    if (!haystack.includes(needle)) continue;
    if (!best || needle.length > best.name.length) best = item;
  }

  if (best) return best;

  // Singular/plural and shorthand fallback: "squats" -> "Back Squat".
  const keyword = /(squat|bench|deadlift|press|row|lunge|curl|plank|jump|lift)/.exec(haystack);
  if (!keyword) return null;
  return library.find((item) => item.name.toLowerCase().includes(keyword[1])) ?? null;
}

type Request = {
  parts: BodyPart[];
  equipment: Equipment | null;
  moves: string[];
};

/** Prefers the library's own wording when the user said something close to it. */
function preferName(nameText: string, inferred: LibraryExercise | null) {
  if (!inferred) return nameText;
  const said = nameText.toLowerCase().replace(/s$/, "");
  const known = inferred.name.toLowerCase();
  if (!said) return inferred.name;
  if (known.includes(said) || said.includes(known.replace(/s$/, ""))) return inferred.name;
  return nameText;
}

/** Reads the intent out of a description: what to train, and with what. */
function readTheme(text: string): Request {
  const parts = BODY_PARTS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.key);
  const equipment = EQUIPMENT.find((entry) => entry.pattern.test(text)) ?? null;
  const moves: string[] = [];

  if (equipment) {
    const wanted: BodyPart[] = parts.length ? parts : ["full"];
    for (const move of equipment.moves) {
      if (partsOf(move).some((part) => wanted.includes(part) || part === "full")) moves.push(move);
    }
  }

  return { parts, equipment, moves };
}

/** Movements the user actually named, whether or not they gave numbers. */
function readExplicit(text: string, library: LibraryExercise[]) {
  const explicit: DraftExercise[] = [];
  const leftovers: string[] = [];
  const seen = new Set<string>();

  for (const raw of splitSegments(text)) {
    const segment = raw.trim();
    if (segment.length < 3) continue;
    if (/^(and|also|warm\s?up|finish|notes?)\b[:\s]*$/i.test(segment)) continue;

    const { sets, reps, percent, rest } = readNumbers(segment);
    const candidate = matchLibrary(segment, library);
    const exact =
      candidate && segment.toLowerCase().includes(candidate.name.toLowerCase()) ? candidate : null;

    const nameText = polishName(
      rest
        .replace(/\b(reps?|sets?|rounds?|of|at|for|each side|per side|superset|with|each|leg|side)\b/gi, " ")
        .replace(/\b\d{1,3}\b/g, " "),
    );

    const keyword = /(squat|bench|deadlift|press|row|lunge|curl|plank|jump|raise|pull|push)/i.exec(segment);
    const inferred = keyword ? (library.find((item) => item.name.toLowerCase().includes(keyword[1])) ?? null) : null;

    if (!/\d/.test(segment) && !exact && !inferred) {
      leftovers.push(segment);
      continue;
    }
    if (!nameText && !exact) continue;

    const finalName = exact?.name ?? preferName(nameText, inferred);
    if (!finalName) continue;

    const key = finalName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    explicit.push({
      id: newExerciseId(finalName),
      name: finalName,
      sets: sets ?? exact?.sets ?? inferred?.sets ?? "3",
      reps: reps ?? (exact?.reps || inferred?.reps || "8"),
      percent: percent ?? exact?.percent ?? null,
      lift: exact?.lift ?? guessLift(finalName),
    });
  }

  return { explicit, leftovers };
}

const DAY_TITLES: Record<string, string> = {
  leg: "Leg Day",
  legs: "Leg Day",
  lower: "Lower Body",
  upper: "Upper Body",
  push: "Push Day",
  pull: "Pull Day",
  arm: "Arm Day",
  arms: "Arm Day",
  chest: "Chest Day",
  back: "Back Day",
  shoulder: "Shoulder Day",
  shoulders: "Shoulder Day",
  core: "Core Day",
  "full body": "Full Body",
  "full-body": "Full Body",
};

/**
 * Turns a plain-language description into a draft program. It understands
 * numbers ("5x5 squat at 80%") and intent ("destroy my legs, let's hit the
 * smith machine"), and it is deliberately deterministic: no API key, works
 * offline, and every field stays editable before saving.
 */
export function parseWorkoutDescription(text: string, library: LibraryExercise[]): DraftProgram {
  const normalised = normalizeSpoken(
    text
      .replace(/[×✕]/g, "x")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\b(imma|ima|gonna|wanna)\b/gi, " "),
  );
  let name = "";
  let body = normalised;

  const titled = /^\s*(?:workout|program|session|day)\s*[:\-]\s*(.+)\n/i.exec(normalised);
  if (titled) {
    name = titled[1].trim();
    body = normalised.slice(titled[0].length);
  } else {
    // "Tuesday squat day: 5x5 ..." -> title from the leading clause.
    const colon = /^\s*([^:\n]{3,48}):\s*([\s\S]+)$/.exec(normalised);
    if (colon && !/\d/.test(colon[1]) && !/^(warm|finish|note|superset)/i.test(colon[1])) {
      name = colon[1].trim();
      body = colon[2];
    }
  }

  const { explicit, leftovers } = readExplicit(body, library);
  // "push day:" as a title still deserves the proper name.
  const bare = name.trim().toLowerCase().replace(/\s+day$/, "");
  if (name && DAY_TITLES[bare]) name = DAY_TITLES[bare];

  const request = readTheme(leftovers.join(". "));
  const exercises: DraftExercise[] = [...explicit];
  const seen = new Set(exercises.map((item) => item.name.toLowerCase()));

  // Only fill in from the theme when the request left room for it. Naming
  // movements explicitly should not drag in a template on top.
  const themed = request.parts.length > 0 || request.equipment !== null;
  const limit = explicit.length ? Math.min(6, explicit.length + 3) : 6;

  if (themed && exercises.length < limit) {
    const wanted: BodyPart[] = request.parts.length ? request.parts : ["full"];

    const candidates: string[] = [];
    // First choice: whatever the library already holds for that body part.
    for (const item of library) {
      const tags = partsOf(item.name);
      if (tags.some((part) => wanted.includes(part))) candidates.push(item.name);
    }
    // Then the equipment-led movements, which read more specific.
    candidates.unshift(...request.moves);
    // Then plain defaults, so a request with no numbers still produces a session.
    for (const part of wanted) candidates.push(...BODY_MOVES[part]);

    for (const candidateName of candidates) {
      if (exercises.length >= limit) break;
      const key = candidateName.toLowerCase();
      if (seen.has(key)) continue;
      const fromLibrary = library.find((item) => item.name.toLowerCase() === key);
      seen.add(key);
      exercises.push({
        id: newExerciseId(candidateName),
        name: fromLibrary?.name ?? candidateName,
        sets: fromLibrary?.sets ?? "3",
        reps: fromLibrary?.reps ?? "8",
        percent: fromLibrary?.percent ?? null,
        lift: fromLibrary?.lift ?? guessLift(candidateName),
        suggested: true,
      });
    }
  }

  if (!name) {
    const day = /\b(legs?|lower|upper|push|pull|arms?|chest|back|shoulders?|core|full[- ]body)\s+day\b/i.exec(
      normalised,
    );
    if (day) name = DAY_TITLES[day[1].toLowerCase()] ?? "";
  }

  if (!name) {
    if (request.parts.length === 1) {
      name = BODY_PARTS.find((entry) => entry.key === request.parts[0])?.title ?? "";
    } else if (request.parts.length > 1) {
      name = "Full Body";
    }
    if (!name) name = exercises.length ? "My workout" : "";
  }

  return { name, exercises };
}
