"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_PROGRAMS } from "./programs";
import { libraryFromPrograms, parseCount } from "./library";
import type {
  AppData,
  AppSettings,
  Exercise,
  ExerciseProgress,
  Lift,
  LibraryExercise,
  Program,
  Session,
  TimerState,
} from "./types";

const STORAGE_KEY = "otto-fitness.v1";

export const DEFAULT_SETTINGS: AppSettings = {
  maxes: { squat: null, bench: null, deadlift: null, press: null },
  workingMax: true,
  barWeight: 45,
  plates: [45, 35, 25, 10, 5],
};

const DEFAULT_DATA: AppData = {
  version: 2,
  settings: DEFAULT_SETTINGS,
  programs: DEFAULT_PROGRAMS,
  library: libraryFromPrograms(DEFAULT_PROGRAMS),
  session: null,
  history: [],
};

function emptyProgress(): ExerciseProgress {
  return { setsDone: 0, skipped: false, note: "" };
}

function migrateSession(raw: unknown): Session | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Partial<Session> & { completed?: Record<string, boolean> };
  const progress: Record<string, ExerciseProgress> = {};

  if (source.progress && typeof source.progress === "object") {
    for (const [id, value] of Object.entries(source.progress)) {
      progress[id] = { ...emptyProgress(), ...(value as ExerciseProgress) };
    }
  }

  // Older saves stored a single "done" flag per exercise.
  for (const [id, done] of Object.entries(source.completed ?? {})) {
    if (done && !progress[id]) progress[id] = { setsDone: 99, skipped: false, note: "" };
  }

  return {
    programId: String(source.programId ?? ""),
    startedAt: Number(source.startedAt ?? Date.now()),
    timer: source.timer ?? { running: false, accumulatedMs: 0, resumedAt: null },
    progress,
  };
}

function dedupeLibrary(items: LibraryExercise[]): LibraryExercise[] {
  const seen = new Map<string, LibraryExercise>();
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.set(key, item);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Saves written before the copy pass used a dash separator between a program and
 * its stage ("Squatober <sep> W1D1", "Back Squat <sep> T1"). Retitle them on load
 * so a device does not have to be reset to see the new names. Idempotent.
 */
const OLD_SEPARATOR = " \u2014 ";
const GLUED_HEADS = /^(5\/3\/1|GZCLP|Texas Method|PHUL|Squatober)$/i;
const STAGE_TAILS = /^(T[123]|BBB|top triple|back-offs)$/i;

function retitle(name: string) {
  if (!name.includes(OLD_SEPARATOR)) return name;
  const [head, ...rest] = name.split(OLD_SEPARATOR);
  const tail = rest.join(" ");
  if (STAGE_TAILS.test(tail)) return `${head} (${tail})`;
  if (GLUED_HEADS.test(head.trim())) return `${head} ${tail}`;
  return `${head}: ${tail}`;
}

function loadData(): AppData {
  if (typeof window === "undefined") return DEFAULT_DATA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as Partial<AppData> & { session?: unknown };
    const settings = parsed.settings ?? DEFAULT_SETTINGS;
    const programs =
      Array.isArray(parsed.programs) && parsed.programs.length ? parsed.programs : DEFAULT_PROGRAMS;

    const library =
      Array.isArray(parsed.library) && parsed.library.length
        ? dedupeLibrary(parsed.library)
        : libraryFromPrograms(programs);

    const retitled = programs.map((program) => ({
      ...program,
      name: retitle(program.name),
      exercises: program.exercises.map((exercise) => ({
        ...exercise,
        name: retitle(exercise.name),
      })),
    }));

    return {
      version: 2,
      settings: {
        ...DEFAULT_SETTINGS,
        ...settings,
        maxes: { ...DEFAULT_SETTINGS.maxes, ...(settings.maxes ?? {}) },
        plates: Array.isArray(settings.plates) ? settings.plates : DEFAULT_SETTINGS.plates,
      },
      programs: retitled,
      library: library.map((item) => ({ ...item, name: retitle(item.name) })),
      session: migrateSession(parsed.session),
      history: Array.isArray(parsed.history)
        ? parsed.history.map((entry) => ({ ...entry, programName: retitle(entry.programName) }))
        : [],
    };
  } catch {
    return DEFAULT_DATA;
  }
}

export function timerElapsed(timer: TimerState, now = Date.now()) {
  return timer.accumulatedMs + (timer.running && timer.resumedAt ? now - timer.resumedAt : 0);
}

export function workingMaxFor(settings: AppSettings, lift: Lift) {
  const max = settings.maxes[lift];
  if (!max) return null;
  return settings.workingMax ? Math.round(max * 0.9) : max;
}

/** Weight to put on the bar for an exercise, rounded to a plate-friendly 5 lb. */
export function exerciseTarget(settings: AppSettings, exercise: Exercise) {
  if (!exercise.lift || !exercise.percent) return null;
  const base = workingMaxFor(settings, exercise.lift);
  if (!base) return null;
  return Math.max(0, Math.round((base * exercise.percent) / 100 / 5) * 5);
}

export function progressOf(session: Session | null, exerciseId: string): ExerciseProgress {
  return session?.progress[exerciseId] ?? emptyProgress();
}

/** The exercise as performed, honouring a mid-session swap. */
export function resolvedExercise(exercise: Exercise, progress: ExerciseProgress): Exercise {
  if (!progress.swap) return exercise;
  return {
    ...exercise,
    name: progress.swap.name,
    sets: progress.swap.sets,
    reps: progress.swap.reps,
    percent: progress.swap.percent,
    lift: progress.swap.lift,
    notes: exercise.notes,
    demo: progress.swap.demo ?? null,
  };
}

export function setCountFor(exercise: Exercise) {
  return parseCount(exercise.sets, 3);
}

/** Every set is in. Skipping never counts as finished work. */
export function isExerciseComplete(exercise: Exercise, progress: ExerciseProgress) {
  if (progress.skipped) return false;
  return progress.setsDone >= setCountFor(exercise);
}

/** Settled either way, so a skip still moves the workout along. */
export function isExerciseDone(exercise: Exercise, progress: ExerciseProgress) {
  return progress.skipped || isExerciseComplete(exercise, progress);
}

type AppContextValue = {
  data: AppData;
  hydrated: boolean;
  settings: AppSettings;
  programById: (id: string | null) => Program | null;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setMax: (lift: Lift, value: number | null) => void;
  startProgram: (programId: string) => void;
  setSetsDone: (exerciseId: string, count: number) => void;
  toggleSkip: (exerciseId: string) => void;
  setExerciseNote: (exerciseId: string, note: string) => void;
  swapExercise: (exerciseId: string, replacement: LibraryExercise | null) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  finishWorkout: () => void;
  cancelWorkout: () => void;
  saveProgram: (program: Program) => void;
  deleteProgram: (id: string) => void;
  addLibraryExercise: (item: LibraryExercise) => void;
  removeLibraryExercise: (id: string) => void;
  replacePrograms: (programs: Program[]) => void;
  resetPrograms: () => void;
  clearHistory: () => void;
  resetAll: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

/** Keeps the library in sync with movements introduced by a new program. */
function withLibrary(data: AppData, exercises: Exercise[]): LibraryExercise[] {
  const known = new Set(data.library.map((item) => item.name.trim().toLowerCase()));
  const additions: LibraryExercise[] = [];

  for (const exercise of exercises) {
    const key = exercise.name.trim().toLowerCase();
    if (!key || known.has(key)) continue;
    known.add(key);
    additions.push({
      id: `${exercise.id}-lib`,
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      percent: exercise.percent,
      lift: exercise.lift,
      notes: exercise.notes,
      demo: exercise.demo ?? null,
    });
  }

  if (!additions.length) return data.library;
  return [...data.library, ...additions].sort((a, b) => a.name.localeCompare(b.name));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [hydrated, setHydrated] = useState(false);
  const running = data.session?.timer.running ?? false;

  useEffect(() => {
    setData(loadData());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage can be full or blocked (private mode); the app still works in memory.
    }
  }, [data, hydrated]);

  // While the stopwatch runs, persist a snapshot now and then so a reload
  // doesn't lose the last few minutes of work.
  useEffect(() => {
    if (!hydrated || !running) return;
    const interval = window.setInterval(() => {
      setData((prev) => {
        if (!prev.session?.timer.running || !prev.session.timer.resumedAt) return prev;
        const elapsed = timerElapsed(prev.session.timer);
        return {
          ...prev,
          session: {
            ...prev.session,
            timer: { running: true, accumulatedMs: elapsed, resumedAt: Date.now() },
          },
        };
      });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [hydrated, running]);

  const update = useCallback((updater: (current: AppData) => AppData) => {
    setData((current) => updater(current));
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      update((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
    },
    [update],
  );

  const setMax = useCallback(
    (lift: Lift, value: number | null) => {
      update((current) => ({
        ...current,
        settings: {
          ...current.settings,
          maxes: { ...current.settings.maxes, [lift]: value },
        },
      }));
    },
    [update],
  );

  const startProgram = useCallback(
    (programId: string) => {
      const session: Session = {
        programId,
        startedAt: Date.now(),
        timer: { running: true, accumulatedMs: 0, resumedAt: Date.now() },
        progress: {},
      };
      update((current) => ({ ...current, session }));
    },
    [update],
  );

  const patchProgress = useCallback(
    (exerciseId: string, patch: Partial<ExerciseProgress>) => {
      update((current) => {
        if (!current.session) return current;
        const previous = current.session.progress[exerciseId] ?? emptyProgress();
        return {
          ...current,
          session: {
            ...current.session,
            progress: {
              ...current.session.progress,
              [exerciseId]: { ...previous, ...patch },
            },
          },
        };
      });
    },
    [update],
  );

  const setSetsDone = useCallback(
    (exerciseId: string, count: number) => {
      patchProgress(exerciseId, { setsDone: Math.max(0, count) });
    },
    [patchProgress],
  );

  const toggleSkip = useCallback(
    (exerciseId: string) => {
      update((current) => {
        if (!current.session) return current;
        const previous = current.session.progress[exerciseId] ?? emptyProgress();
        return {
          ...current,
          session: {
            ...current.session,
            progress: {
              ...current.session.progress,
              [exerciseId]: { ...previous, skipped: !previous.skipped },
            },
          },
        };
      });
    },
    [update],
  );

  const setExerciseNote = useCallback(
    (exerciseId: string, note: string) => {
      patchProgress(exerciseId, { note: note.slice(0, 400) });
    },
    [patchProgress],
  );

  const swapExercise = useCallback(
    (exerciseId: string, replacement: LibraryExercise | null) => {
      if (!replacement) {
        patchProgress(exerciseId, { swap: undefined });
        return;
      }
      patchProgress(exerciseId, {
        swap: {
          name: replacement.name,
          sets: replacement.sets,
          reps: replacement.reps,
          percent: replacement.percent,
          lift: replacement.lift,
          demo: replacement.demo ?? null,
        },
      });
    },
    [patchProgress],
  );

  const pauseTimer = useCallback(() => {
    update((current) => {
      if (!current.session) return current;
      const timer = current.session.timer;
      return {
        ...current,
        session: {
          ...current.session,
          timer: { running: false, accumulatedMs: timerElapsed(timer), resumedAt: null },
        },
      };
    });
  }, [update]);

  const resumeTimer = useCallback(() => {
    update((current) => {
      if (!current.session) return current;
      return {
        ...current,
        session: {
          ...current.session,
          timer: { ...current.session.timer, running: true, resumedAt: Date.now() },
        },
      };
    });
  }, [update]);

  const resetTimer = useCallback(() => {
    update((current) => {
      if (!current.session) return current;
      return {
        ...current,
        session: { ...current.session, timer: { running: false, accumulatedMs: 0, resumedAt: null } },
      };
    });
  }, [update]);

  const finishWorkout = useCallback(() => {
    update((current) => {
      if (!current.session) return current;
      const program = current.programs.find((item) => item.id === current.session?.programId) ?? null;
      const exercises = program?.exercises ?? [];
      // Skipped movements advance the workout but land in their own column, so
      // the completion total only ever counts work that was actually done.
      const progressFor = (exercise: Exercise) =>
        current.session?.progress[exercise.id] ?? emptyProgress();
      const completedCount = exercises.filter((exercise) =>
        isExerciseComplete(resolvedExercise(exercise, progressFor(exercise)), progressFor(exercise)),
      ).length;
      const skippedCount = exercises.filter((exercise) => progressFor(exercise).skipped).length;
      return {
        ...current,
        session: null,
        history: [
          {
            id: `${current.session.startedAt}`,
            programId: current.session.programId,
            programName: program?.name ?? "Workout",
            finishedAt: Date.now(),
            durationMs: timerElapsed(current.session.timer),
            completedCount,
            skippedCount,
            totalCount: exercises.length || completedCount,
          },
          ...current.history,
        ].slice(0, 50),
      };
    });
  }, [update]);

  const cancelWorkout = useCallback(() => {
    update((current) => ({ ...current, session: null }));
  }, [update]);

  const saveProgram = useCallback(
    (program: Program) => {
      update((current) => {
        const exists = current.programs.some((item) => item.id === program.id);
        const programs = exists
          ? current.programs.map((item) => (item.id === program.id ? program : item))
          : [program, ...current.programs];
        return { ...current, programs, library: withLibrary(current, program.exercises) };
      });
    },
    [update],
  );

  const deleteProgram = useCallback(
    (id: string) => {
      update((current) => {
        const programs = current.programs.filter((item) => item.id !== id);
        const session = current.session?.programId === id ? null : current.session;
        return { ...current, programs, session };
      });
    },
    [update],
  );

  const addLibraryExercise = useCallback(
    (item: LibraryExercise) => {
      update((current) => {
        const key = item.name.trim().toLowerCase();
        const existing = current.library.find(
          (entry) => entry.id === item.id || entry.name.trim().toLowerCase() === key,
        );
        // Same movement under two ids: keep one entry rather than growing duplicates.
        const library = existing
          ? current.library.map((entry) => (entry === existing ? { ...item, id: existing.id } : entry))
          : [...current.library, item];
        return { ...current, library: library.sort((a, b) => a.name.localeCompare(b.name)) };
      });
    },
    [update],
  );

  const removeLibraryExercise = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        library: current.library.filter((entry) => entry.id !== id),
      }));
    },
    [update],
  );

  const replacePrograms = useCallback(
    (programs: Program[]) => {
      update((current) => ({
        ...current,
        programs,
        library: libraryFromPrograms(programs),
        session: null,
      }));
    },
    [update],
  );

  const resetPrograms = useCallback(() => {
    update((current) => ({
      ...current,
      programs: DEFAULT_PROGRAMS,
      library: libraryFromPrograms(DEFAULT_PROGRAMS),
      session: null,
    }));
  }, [update]);

  const clearHistory = useCallback(() => {
    update((current) => ({ ...current, history: [] }));
  }, [update]);

  const resetAll = useCallback(() => {
    setData({ ...DEFAULT_DATA });
  }, []);

  const programById = useCallback(
    (id: string | null) => data.programs.find((program) => program.id === id) ?? null,
    [data.programs],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      hydrated,
      settings: data.settings,
      programById,
      updateSettings,
      setMax,
      startProgram,
      setSetsDone,
      toggleSkip,
      setExerciseNote,
      swapExercise,
      pauseTimer,
      resumeTimer,
      resetTimer,
      finishWorkout,
      cancelWorkout,
      saveProgram,
      deleteProgram,
      addLibraryExercise,
      removeLibraryExercise,
      replacePrograms,
      resetPrograms,
      clearHistory,
      resetAll,
    }),
    [
      data,
      hydrated,
      programById,
      updateSettings,
      setMax,
      startProgram,
      setSetsDone,
      toggleSkip,
      setExerciseNote,
      swapExercise,
      pauseTimer,
      resumeTimer,
      resetTimer,
      finishWorkout,
      cancelWorkout,
      saveProgram,
      deleteProgram,
      addLibraryExercise,
      removeLibraryExercise,
      replacePrograms,
      resetPrograms,
      clearHistory,
      resetAll,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside <AppProvider>");
  return context;
}

/** Re-renders every second while `active`, for live timers. */
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  const timeout = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    timeout.current = interval;
    return () => {
      if (timeout.current) window.clearInterval(timeout.current);
    };
  }, [active]);

  return now;
}
