import type { HistoryEntry, Program } from "./types";

/**
 * The recommendation walks a fixed five day cycle so a lifter who simply
 * follows it never trains the same pattern every session. Focus is read from
 * the movement names, since that is the only thing every program has in common.
 */
export type Focus = "legs" | "push" | "pull" | "upper" | "full";

export const CYCLE: Focus[] = ["legs", "push", "pull", "upper", "full"];

export const FOCUS_LABEL: Record<Focus, string> = {
  legs: "Lower body",
  push: "Push",
  pull: "Pull",
  upper: "Upper body",
  full: "Full body",
};

const LEGS =
  /\b(squat|deadlift|romanian|\brdl\b|lunge|leg press|leg curl|leg extension|calf|calves|hip thrust|glute|step-?up|split squat|good morning|hamstring|hack)\b/i;
const PUSH =
  /\b(bench|press|overhead|incline|decline|fly|flye|pushdown|push-?down|dip|push-?up|skull|lateral raise|front raise|rear delt|pec)\b/i;
const PULL =
  /\b(row|pulldown|pull-?down|pull-?up|chin-?up|curl|shrug|face pull|pull-?apart|farmer|carry|pullover)\b/i;

function movementFocus(name: string): Focus | null {
  // Order matters: "Leg Press" is a leg movement, not a press.
  if (LEGS.test(name)) return "legs";
  if (PUSH.test(name)) return "push";
  if (PULL.test(name)) return "pull";
  return null;
}

export function programFocus(program: Program): Focus {
  let legs = 0;
  let push = 0;
  let pull = 0;

  for (const exercise of program.exercises) {
    const focus = movementFocus(exercise.name);
    if (focus === "legs") legs += 1;
    else if (focus === "push") push += 1;
    else if (focus === "pull") pull += 1;
  }

  if (!legs && !push && !pull) return "full";
  if (legs > 0 && push > 0 && pull > 0) return "full";
  if (!legs) {
    if (push > 0 && pull > 0) return "upper";
    return push > pull ? "push" : "pull";
  }
  // One lower body lift beside one upper body lift is a full body day, not a
  // lower body day with a token press.
  if (legs === push && pull === 0) return "full";
  if (legs >= push + pull) return "legs";
  if (push > pull) return "push";
  if (pull > push) return "pull";
  return "legs";
}

/** Whole days since the epoch in the lifter's own timezone, DST safe. */
export function localDayNumber(date = new Date()) {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round(midnight.getTime() / 86_400_000);
}

export type Recommendation = {
  program: Program | null;
  focus: Focus;
  nextFocus: Focus;
  /** 1-based position in the five day cycle. */
  cycleDay: number;
  dayNumber: number;
};

/** Programs that suit a day's focus, in library order. */
function poolFor(programs: Program[], focus: Focus): Program[] {
  const direct = programs.filter((program) => programFocus(program) === focus);
  if (!direct.length) return programs;
  // Push, pull and upper days are thin in most libraries, so neighbouring
  // focuses stand in rather than meeting the same workout every cycle.
  const support: Focus[] =
    focus === "push" || focus === "pull"
      ? ["upper"]
      : focus === "upper"
        ? ["push", "pull"]
        : [];
  if (support.length && direct.length < 4) {
    return [
      ...direct,
      ...programs.filter(
        (program) =>
          support.includes(programFocus(program)) && !direct.includes(program),
      ),
    ];
  }
  return direct;
}

function choose(
  programs: Program[],
  focus: Focus,
  dayNumber: number,
  avoid: Set<string>,
): Program | null {
  const pool = poolFor(programs, focus);
  if (!pool.length) return null;

  // One full turn of the cycle advances the pick inside the pool, so every
  // matching workout gets a turn instead of the same one every five days.
  const visit = Math.floor(dayNumber / CYCLE.length);
  const start = ((visit % pool.length) + pool.length) % pool.length;

  for (let step = 0; step < pool.length; step += 1) {
    const candidate = pool[(start + step) % pool.length];
    if (!avoid.has(candidate.id)) return candidate;
  }

  // Every matching workout was already used this cycle: borrow any spare one
  // rather than showing the same session twice in a row.
  return programs.find((program) => !avoid.has(program.id)) ?? pool[start];
}

/** Walks one whole cycle, refusing to reuse a workout inside it. */
function cyclePicks(programs: Program[], startDay: number, avoid: Set<string>) {
  const used = new Set(avoid);
  return CYCLE.map((focus, index) => {
    const pick = choose(programs, focus, startDay + index, used);
    if (pick) used.add(pick.id);
    return pick;
  });
}

export function recommendation(
  programs: Program[],
  history: HistoryEntry[] = [],
  date = new Date(),
): Recommendation {
  const dayNumber = localDayNumber(date);
  const cycleIndex = ((dayNumber % CYCLE.length) + CYCLE.length) % CYCLE.length;
  const focus = CYCLE[cycleIndex];
  const nextFocus = CYCLE[(cycleIndex + 1) % CYCLE.length];
  const cycleDay = cycleIndex + 1;

  const avoid = new Set(
    history
      .filter((entry) => date.getTime() - entry.finishedAt < 36 * 3_600_000)
      .map((entry) => entry.programId),
  );

  // Seed from the last day of the previous cycle so a workout never lands on
  // two days in a row, including across a push and a pull day.
  const startDay = dayNumber - cycleIndex;
  const previous = cyclePicks(programs, startDay - CYCLE.length, avoid);
  const last = previous[CYCLE.length - 1];
  if (last) avoid.add(last.id);

  const picks = cyclePicks(programs, startDay, avoid);

  return { program: picks[cycleIndex], focus, nextFocus, cycleDay, dayNumber };
}
