"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  exerciseTarget,
  isExerciseComplete,
  isExerciseDone,
  progressOf,
  resolvedExercise,
  setCountFor,
  timerElapsed,
  useApp,
  useNow,
  workingMaxFor,
} from "@/lib/state";
import { formatDuration, formatWeight } from "@/lib/format";
import { plateBreakdown } from "@/lib/plates";
import { LIFT_LABEL, programTagList } from "@/lib/programs";
import { supersetInfo } from "@/lib/supersets";
import type { Exercise, ExerciseProgress, LibraryExercise, Program } from "@/lib/types";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PauseIcon,
  PlatesIcon,
  PlayIcon,
  ResetIcon,
  ShuffleIcon,
} from "./Icons";
import { PlateStack } from "./PlateStack";
import { ArcDial } from "./Charts";
import { ExerciseDemo } from "./ExerciseDemo";
import { PlateDrawer } from "./PlateDrawer";

type RowState = "current" | "past" | "upcoming" | "idle";

export function ProgramScreen({
  program,
  from,
  onBack,
  onUseAsBase,
}: {
  program: Program;
  from: DOMRect | null;
  onBack: () => void;
  onUseAsBase: (programId: string) => void;
}) {
  const {
    data,
    settings,
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
  } = useApp();

  const sheetRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [plates, setPlates] = useState<{ title: string; target: number | null } | null>(null);

  const session = data.session?.programId === program.id ? data.session : null;
  const otherSession = data.session && data.session.programId !== program.id ? data.session : null;
  const now = useNow(Boolean(session?.timer.running));
  const elapsed = session ? timerElapsed(session.timer, now) : 0;

  const rows = useMemo(
    () =>
      program.exercises.map((exercise) => {
        const progress = progressOf(session, exercise.id);
        const resolved = resolvedExercise(exercise, progress);
        return {
          exercise,
          resolved,
          progress,
          done: isExerciseDone(resolved, progress),
          target: exerciseTarget(settings, resolved),
          breakdown:
            exerciseTarget(settings, resolved) !== null
              ? plateBreakdown(
                  exerciseTarget(settings, resolved) as number,
                  settings.barWeight,
                  settings.plates,
                )
              : null,
        };
      }),
    [program.exercises, session, settings],
  );

  // Skipped rows settle the list but are not finished work, so they never add
  // to the count or the ring.
  const completed = rows.filter((row) => isExerciseComplete(row.resolved, row.progress)).length;
  const skipped = rows.filter((row) => row.progress.skipped).length;
  const total = rows.length;
  const progress = total ? (completed / total) * 100 : 0;
  const currentIndex = session ? rows.findIndex((row) => !row.done) : -1;
  const focus = rows[currentIndex >= 0 ? currentIndex : 0];
  const swapping = swapFor ? program.exercises.find((item) => item.id === swapFor) ?? null : null;

  const supersets = useMemo(() => supersetInfo(program.exercises), [program.exercises]);
  // Both halves of a superset stay live at once; you alternate between them.
  const activeGroup =
    currentIndex >= 0 ? supersets.groupOf[rows[currentIndex].exercise.id] ?? 0 : 0;

  // Morph the sheet out of the poster that was tapped.
  useEffect(() => {
    const node = sheetRef.current;
    if (!node || !from) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const open = node.animate(
      [
        {
          clipPath: `inset(${Math.max(0, from.top)}px ${Math.max(0, width - from.right)}px ${Math.max(
            0,
            height - from.bottom,
          )}px ${Math.max(0, from.left)}px)`,
          opacity: 0.4,
        },
        { clipPath: "inset(0px 0px 0px 0px)", opacity: 1 },
      ],
      { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );

    return () => open.cancel();
  }, [from]);

  // Lock the page behind the sheet.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const close = () => {
    const node = sheetRef.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onBack();
      return;
    }
    const exit = node.animate(
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(12px)" }],
      { duration: 220, easing: "ease-in" },
    );
    exit.finished.then(onBack, onBack);
  };

  // Escape closes the topmost layer only: drawer, then picker, then the sheet.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (plates !== null) {
        setPlates(null);
        return;
      }
      if (swapFor !== null) {
        setSwapFor(null);
        return;
      }
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plates, swapFor]);

  const discard = () => {
    if (window.confirm("Discard this workout? Completed sets won't be saved.")) cancelWorkout();
  };

  return (
    <div
      className="sheet"
      ref={sheetRef}
      onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 28)}
    >
      <div className="sheet-glow" aria-hidden="true" />

      <div className={`sheet-inner ${session ? "sheet-inner--live" : ""}`}>
        <header className={`proghead ${scrolled ? "is-scrolled" : ""}`}>
          <div className="proghead-top">
            <button
              type="button"
              className="backbtn"
              onClick={close}
              aria-label="Back to programs"
              data-cursor="link"
            >
              <ChevronLeftIcon size={18} />
            </button>
            <div className="proghead-meta">
              <span className="proghead-kicker">{session ? "Live" : "Program"}</span>
              <span className="proghead-title">{program.name}</span>
            </div>
            {session ? (
              <div className="proghead-progress">
                <span className="proghead-count">
                  {completed}/{total}
                </span>
                <ArcDial value={progress} size={40} tone="lime" />
              </div>
            ) : null}
            {session && focus ? (
              <button
                type="button"
                className="backbtn"
                aria-label="Open plate calculator"
                onClick={() => setPlates({ title: focus.resolved.name, target: focus.target })}
              >
                <PlatesIcon size={17} />
              </button>
            ) : null}
          </div>
        </header>

        {/* A running session skips the cover art: the current set belongs near the top. */}
        {session ? null : (
          <section className="prog-hero">
            <span className="kicker">
              <span className="kicker-index">{String(total).padStart(2, "0")}</span> movements
            </span>
            <h1 className="prog-hero-title">{program.name}</h1>
            <div className="prog-hero-tags">
              {programTagList(program).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </section>
        )}

        {focus && !session ? (
          <figure className="nowcard">
            <div className="nowcard-stage">
              <ExerciseDemo
                name={focus.resolved.name}
                demo={focus.resolved.demo}
                variant="hero"
                eager
                label={`${focus.resolved.name}, start and end position`}
              />
              <figcaption className="nowcard-caption">
                <span className="nowcard-kicker">First up</span>
                <p className="nowcard-name">{focus.resolved.name}</p>
                <p className="nowcard-meta">
                  {focus.resolved.sets} × {focus.resolved.reps}
                  {focus.resolved.percent ? ` · ${focus.resolved.percent}%` : " · by feel"}
                  {focus.resolved.superset ? " · superset" : ""}
                </p>
              </figcaption>
            </div>
            {focus.target !== null || (focus.breakdown && focus.breakdown.loads.length) ? (
              <div className="nowcard-bar">
                {focus.target !== null ? (
                  <p className="nowcard-weight">
                    {formatWeight(focus.target)}
                    <small>lb</small>
                  </p>
                ) : (
                  <p className="nowcard-weight nowcard-weight--muted">{focus.resolved.reps} reps</p>
                )}
                {focus.breakdown && focus.breakdown.loads.length ? (
                  <span className="nowcard-plates" aria-hidden="true">
                    <PlateStack loads={focus.breakdown.loads} />
                  </span>
                ) : null}
                <span className="nowcard-load">
                  {focus.breakdown && focus.breakdown.loads.length
                    ? `${focus.breakdown.loads
                        .map((load) => `${load.count}×${formatWeight(load.plate)}`)
                        .join(" + ")} / side`
                    : focus.target !== null
                      ? "bar only"
                      : "no weight prescribed"}
                </span>
              </div>
            ) : null}
          </figure>
        ) : null}

        {session ? (
          <div className="timer timer--live" style={{ margin: "0 var(--gutter) 14px" }}>
            <div className="timer-main">
              <span className="timer-time">{formatDuration(elapsed)}</span>
              <span className="timer-caption">
                {completed} of {total} done{skipped ? ` · ${skipped} skipped` : ""} ·{" "}
                {session.timer.running ? "running" : "paused"}
              </span>
            </div>
            <div className="timer-actions">
              <button
                type="button"
                className={`roundbtn ${session.timer.running ? "" : "roundbtn--solid"}`}
                aria-label={session.timer.running ? "Pause timer" : "Resume timer"}
                onClick={session.timer.running ? pauseTimer : resumeTimer}
              >
                {session.timer.running ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
              </button>
              <button type="button" className="roundbtn" aria-label="Reset timer" onClick={resetTimer}>
                <ResetIcon size={16} />
              </button>
            </div>
          </div>
        ) : (
          <p className="note" style={{ margin: "0 var(--gutter) 18px" }}>
            Weights come from your maxes{settings.workingMax ? ", taken from 90% of each true max" : ""}.
            Starting the workout turns on set counting, notes and swaps.
            {otherSession ? " Another workout is running. Starting this one replaces it." : ""}
          </p>
        )}

        <div className="ex-list" style={{ margin: "0 var(--gutter)" }}>
          {rows.map((row, index) => {
            const group = supersets.groupOf[row.exercise.id] ?? 0;
            const slot = supersets.slotOf[row.exercise.id] ?? 0;
            const entry = group
              ? supersets.groups.find((item) => item.index === group) ?? null
              : null;
            const inFocusGroup = group !== 0 && group === activeGroup;

            const state: RowState = !session
              ? "idle"
              : row.done
                ? "past"
                : index === currentIndex || inFocusGroup
                  ? "current"
                  : "upcoming";

            return (
              <div
                key={row.exercise.id}
                className={`exslot ${group ? "exslot--group" : ""}`}
              >
                {slot === 1 && entry ? (
                  <div className="exgroup-head">
                    <span className="exgroup-letter">{entry.letter}</span>
                    <span className="exgroup-title">Superset</span>
                    <span className="exgroup-note">
                      {entry.ids.length} movements, alternate them, rest after the last
                    </span>
                  </div>
                ) : null}

                <ExerciseRow
                  exercise={row.exercise}
                  resolved={row.resolved}
                  progress={row.progress}
                  index={index}
                  state={state}
                  live={Boolean(session)}
                  noteOpen={noteFor === row.exercise.id}
                  groupLabel={slot ? `${entry?.letter ?? ""}${slot}` : null}
                  onToggleComplete={() => {
                    // A skipped movement reads as done, so its check reopens it
                    // rather than clearing the set count.
                    if (row.progress.skipped) {
                      toggleSkip(row.exercise.id);
                      return;
                    }
                    setSetsDone(row.exercise.id, row.done ? 0 : setCountFor(row.resolved));
                  }}
                  onChangeSets={(count) => setSetsDone(row.exercise.id, count)}
                  onToggleNote={() =>
                    setNoteFor((current) => (current === row.exercise.id ? null : row.exercise.id))
                  }
                  onNote={(note) => setExerciseNote(row.exercise.id, note)}
                  onSwap={() => setSwapFor(row.exercise.id)}
                  onSkip={() => toggleSkip(row.exercise.id)}
                  onPlates={() =>
                    setPlates({ title: row.resolved.name, target: row.target })
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      <footer className="sheet-action">
        {session ? (
          <>
            <div className="sheet-action-meta">
              <span>
                {completed}/{total} complete
              </span>
              {skipped ? <span className="sheet-action-skip">{skipped} skipped</span> : null}
              <span>{formatDuration(elapsed)}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => {
                finishWorkout();
                onBack();
              }}
            >
              <CheckIcon size={18} />
              Finish workout
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={discard}>
              Discard workout
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => startProgram(program.id)}
            >
              <PlayIcon size={17} />
              Start workout
            </button>
            <p className="sheet-action-note">Starts the timer · saves to your history</p>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => onUseAsBase(program.id)}
            >
              <CopyIcon size={15} />
              Duplicate and edit
            </button>
          </>
        )}
      </footer>

      {swapping ? (
        <ExercisePicker
          title={swapping.name}
          current={progressOf(session, swapping.id).swap?.name ?? null}
          onPick={(item) => {
            swapExercise(swapping.id, item);
            setSwapFor(null);
          }}
          onClose={() => setSwapFor(null)}
        />
      ) : null}

      <PlateDrawer
        open={plates !== null}
        title={plates?.title ?? ""}
        target={plates?.target ?? null}
        barWeight={settings.barWeight}
        plates={settings.plates}
        onClose={() => setPlates(null)}
      />
    </div>
  );
}

function ExerciseRow({
  exercise,
  resolved,
  progress,
  index,
  state,
  live,
  noteOpen,
  groupLabel,
  onToggleComplete,
  onChangeSets,
  onToggleNote,
  onNote,
  onSwap,
  onSkip,
  onPlates,
}: {
  exercise: Exercise;
  resolved: Exercise;
  progress: ExerciseProgress;
  index: number;
  state: RowState;
  live: boolean;
  noteOpen: boolean;
  /** "A1" style label when the movement belongs to a superset. */
  groupLabel: string | null;
  onToggleComplete: () => void;
  onChangeSets: (count: number) => void;
  onToggleNote: () => void;
  onNote: (note: string) => void;
  onSwap: () => void;
  onSkip: () => void;
  onPlates: () => void;
}) {
  const { settings } = useApp();
  const target = exerciseTarget(settings, resolved);
  const breakdown =
    target !== null ? plateBreakdown(target, settings.barWeight, settings.plates) : null;
  const base = resolved.lift && resolved.percent ? workingMaxFor(settings, resolved.lift) : null;
  const setCount = setCountFor(resolved);
  const done = isExerciseDone(resolved, progress);
  const isCurrent = state === "current";
  const compact = state === "past";

  const loadCaption = breakdown
    ? breakdown.loads.length
      ? `${breakdown.loads.map((load) => `${load.count}×${formatWeight(load.plate)}`).join(" + ")} / side`
      : "bar only"
    : null;

  return (
    <article
      className={`ex ex--${state} ${progress.skipped ? "is-skipped" : ""} ${
        progress.swap ? "is-swapped" : ""
      }`}
    >
      <div className="ex-top">
        <span className={`ex-index ${groupLabel ? "is-grouped" : ""}`}>
          {groupLabel ?? String(index + 1).padStart(2, "0")}
        </span>
        <div className="ex-headings">
          {isCurrent ? <span className="ex-badge">Now</span> : null}
          {progress.skipped && !isCurrent ? <span className="ex-badge ex-badge--skip">Skipped</span> : null}
          <h3 className="ex-name">
            {resolved.name}
            {progress.swap ? <span className="ex-swaptag">swapped</span> : null}
          </h3>
          <p className="ex-sub">
            {resolved.sets} × {resolved.reps}
            {resolved.percent ? ` · ${resolved.percent}%` : " · by feel"}
            {progress.note ? " · noted" : ""}
          </p>
        </div>

        {live ? (
          <button
            type="button"
            className={`ex-check ${done ? "is-on" : ""}`}
            aria-label={
              progress.skipped
                ? `Unskip ${resolved.name}`
                : done
                  ? `Reopen ${resolved.name}`
                  : `Finish ${resolved.name}`
            }
            aria-pressed={done}
            onClick={onToggleComplete}
            data-cursor="check"
          >
            <CheckIcon size={16} />
          </button>
        ) : null}
      </div>

      {isCurrent && live ? (
        <div className="ex-demo">
          <ExerciseDemo name={resolved.name} demo={resolved.demo} variant="strip" />
          <span className="ex-demo-tag">{progress.setsDone ? "Next set" : "Start here"}</span>
        </div>
      ) : null}

      {compact ? (
        <div className="ex-compact-row">
          <p className="ex-compact">
            {progress.skipped
              ? "Skipped this session"
              : `${Math.min(progress.setsDone, setCount)} of ${setCount} sets${
                  target !== null ? ` · ${formatWeight(target)} lb` : ""
                }`}
          </p>
          {progress.skipped && live ? (
            <button
              type="button"
              className="ex-unship"
              onClick={onSkip}
              aria-label={`Unskip ${resolved.name}`}
            >
              Unskip
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {target !== null || resolved.percent ? (
            <div className={`ex-load ${isCurrent ? "ex-load--lead" : ""}`}>
              <div>
                {target !== null ? (
                  <>
                    <p className="ex-weight">
                      {formatWeight(target)}
                      <small>lb</small>
                    </p>
                    {loadCaption ? <p className="ex-caption">{loadCaption}</p> : null}
                  </>
                ) : (
                  <>
                    <p className="ex-weight ex-weight--muted">
                      {resolved.reps}
                      <small>reps</small>
                    </p>
                    <p className="ex-caption">
                      {!resolved.percent
                        ? "by feel · no weight prescribed"
                        : !resolved.lift
                          ? `${resolved.percent}% · no lift picked`
                          : `${resolved.percent}% · set your ${LIFT_LABEL[resolved.lift]} max`}
                    </p>
                  </>
                )}
              </div>

              {breakdown && breakdown.loads.length ? (
                <div className="ex-art" aria-hidden="true">
                  <PlateStack loads={breakdown.loads} />
                </div>
              ) : null}
            </div>
          ) : null}

          {isCurrent ? (
            <div className="ex-sets">
              <div className="ex-sets-head">
                <span className="ex-sets-label">
                  Sets <b>{Math.min(progress.setsDone, setCount)}</b>/{setCount}
                </span>
                <span className="ex-sets-hint">tap a square as you finish</span>
              </div>
              <div className="pips">
                {Array.from({ length: setCount }, (_, pip) => {
                  const on = pip < progress.setsDone;
                  return (
                    <button
                      key={pip}
                      type="button"
                      className={`pip ${on ? "is-on" : ""}`}
                      aria-pressed={on}
                      aria-label={`Set ${pip + 1} of ${setCount}`}
                      onClick={() => onChangeSets(on ? pip : pip + 1)}
                    >
                      {pip + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isCurrent ? (
            <div className="ex-tools">
              <button type="button" className="tool" onClick={onToggleNote}>
                {noteOpen ? "Hide note" : progress.note ? "Edit note" : "Add note"}
              </button>
              <button type="button" className="tool" onClick={onSwap}>
                <ShuffleIcon size={12} /> Swap
              </button>
              <button type="button" className="tool" onClick={onPlates}>
                <PlatesIcon size={12} /> Plates
              </button>
              <button
                type="button"
                className={`tool ${progress.skipped ? "tool--on" : ""}`}
                onClick={onSkip}
              >
                {progress.skipped ? "Unskip" : "Skip"}
              </button>
            </div>
          ) : null}

          {noteOpen ? (
            <div className="ex-notebox">
              <textarea
                className="ex-notefield"
                value={progress.note}
                placeholder="Bar speed, a cue that worked, how it felt…"
                rows={2}
                onChange={(event) => onNote(event.target.value)}
              />
              <span className="ex-notehint">{progress.note.length}/400 · saved to this session</span>
            </div>
          ) : null}

          {exercise.notes && !progress.swap ? <p className="ex-note">{exercise.notes}</p> : null}
          {breakdown && breakdown.short > 0 && target !== null ? (
            <p className="ex-warn">
              closest with your rack: {formatWeight(breakdown.achieved)} lb ·{" "}
              {formatWeight(breakdown.short)} lb short
            </p>
          ) : null}
        </>
      )}
    </article>
  );
}

function ExercisePicker({
  title,
  current,
  onPick,
  onClose,
}: {
  title: string;
  current: string | null;
  onPick: (item: LibraryExercise | null) => void;
  onClose: () => void;
}) {
  const { data } = useApp();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return data.library;
    return data.library.filter((item) => item.name.toLowerCase().includes(term));
  }, [data.library, query]);

  return (
    <div className="picker">
      <button type="button" className="picker-scrim" aria-label="Close picker" onClick={onClose} />
      <div className="picker-panel" role="dialog" aria-modal="true" aria-label={`Swap ${title}`}>
        <div className="picker-head">
          <div>
            <span className="kicker">Swap</span>
            <p className="picker-title">{title}</p>
          </div>
          <button type="button" className="linkbtn" onClick={onClose}>
            Done
          </button>
        </div>

        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your exercises"
          aria-label="Search exercises"
          autoComplete="off"
        />

        <div className="picker-list">
          {results.map((item) => (              <button
                key={item.id}
                type="button"
                className={`picker-row ${current === item.name ? "is-on" : ""}`}
                onClick={() => onPick(item)}
              >
                <span className="picker-thumb" aria-hidden="true">
                  <ExerciseDemo name={item.name} demo={item.demo} variant="thumb" />
                </span>
                <span className="picker-row-name">{item.name}</span>
              <span className="picker-row-meta">
                {item.sets} × {item.reps}
                {item.percent ? ` · ${item.percent}%` : " · by feel"}
              </span>
              <ChevronRightIcon size={14} />
            </button>
          ))}
          {!results.length ? (
            <p className="note">
              No match. Add movements to your library in the You tab, then come back.
            </p>
          ) : null}
        </div>

        {current ? (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => onPick(null)}>
            Restore {title}
          </button>
        ) : null}
      </div>
    </div>
  );
}
