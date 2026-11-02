export type Lift = "squat" | "bench" | "deadlift" | "press";

export type Exercise = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  /** Percentage of the lifter's (working) max, or null for "by feel" work. */
  percent: number | null;
  lift: Lift | null;
  superset: boolean;
  notes?: string;
  /**
   * Movement demo: a bundled art slug, an uploaded image data URL, or null to
   * fall back to the name lookup. Stamped when a movement is added.
   */
  demo?: string | null;
};

export type Program = {
  id: string;
  name: string;
  tags: string[];
  exercises: Exercise[];
};

/** A reusable movement kept in the exercise library. */
export type LibraryExercise = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  percent: number | null;
  lift: Lift | null;
  notes?: string;
  /** Bundled art slug or an uploaded image data URL. */
  demo?: string | null;
};

export type Maxes = Record<Lift, number | null>;

export type AppSettings = {
  maxes: Maxes;
  /** When true, percentages are taken from 90% of the entered max. */
  workingMax: boolean;
  barWeight: number;
  plates: number[];
};

export type TimerState = {
  running: boolean;
  accumulatedMs: number;
  resumedAt: number | null;
};

/** What you actually did with one movement during a session. */
export type ExerciseProgress = {
  /** Completed sets, counted by tapping the set pips. */
  setsDone: number;
  skipped: boolean;
  note: string;
  /** Replacement movement picked from the library mid-session. */
  swap?: {
    name: string;
    sets: string;
    reps: string;
    percent: number | null;
    lift: Lift | null;
    demo?: string | null;
  };
};

export type Session = {
  programId: string;
  startedAt: number;
  timer: TimerState;
  progress: Record<string, ExerciseProgress>;
};

export type HistoryEntry = {
  id: string;
  programId: string;
  programName: string;
  finishedAt: number;
  durationMs: number;
  completedCount: number;
  totalCount: number;
  /** Movements skipped during the session. Older saves do not have it. */
  skippedCount?: number;
};

export type AppData = {
  version: 2;
  settings: AppSettings;
  programs: Program[];
  library: LibraryExercise[];
  session: Session | null;
  history: HistoryEntry[];
};
