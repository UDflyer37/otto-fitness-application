"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  exerciseTarget,
  isExerciseComplete,
  progressOf,
  resolvedExercise,
  timerElapsed,
  useApp,
  useNow,
  workingMaxFor,
} from "@/lib/state";
import { programTagList } from "@/lib/programs";
import { plateBreakdown } from "@/lib/plates";
import { formatDuration, formatWeight } from "@/lib/format";
import { CYCLE, FOCUS_LABEL, recommendation, type Recommendation } from "@/lib/recommend";
import { supersetInfo } from "@/lib/supersets";
import type { Lift, Program } from "@/lib/types";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  PlayIcon,
  PlusIcon,
} from "./Icons";
import { useDragScroll } from "./motion";
import { NumericInput, Toggle } from "./ui";
import { PlateEmblem, PlateStack } from "./PlateStack";
import { ArcDial } from "./Charts";
import { ExerciseDemo } from "./ExerciseDemo";

const MAX_FIELDS: { lift: Lift; label: string }[] = [
  { lift: "squat", label: "Squat" },
  { lift: "bench", label: "Bench" },
  { lift: "deadlift", label: "Deadlift" },
  { lift: "press", label: "Press" },
];

export function HomeView({
  onOpenProgram,
  onNewWorkout,
}: {
  onOpenProgram: (id: string, rect: DOMRect | null) => void;
  onNewWorkout: () => void;
}) {
  const { data, settings, setMax, startProgram, updateSettings } = useApp();
  const [filter, setFilter] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const railDrag = useDragScroll<HTMLDivElement>(railRef);
  const filterDrag = useDragScroll<HTMLDivElement>();
  const now = useNow(Boolean(data.session?.timer.running));

  const programs = useMemo(() => {
    if (!filter) return data.programs;
    return data.programs.filter((program) => programTagList(program).includes(filter));
  }, [data.programs, filter]);

  // The chips follow the library, so a new program family filters itself.
  const filterTags = useMemo(() => {
    const seen = new Set<string>();
    for (const program of data.programs) {
      for (const tag of programTagList(program)) seen.add(tag);
    }
    return [...seen].slice(0, 16);
  }, [data.programs]);

  const hasMaxes = Boolean(
    settings.maxes.squat || settings.maxes.bench || settings.maxes.deadlift || settings.maxes.press,
  );

  // Today's pick walks a five day cycle, so following it rotates the pattern.
  // It reads the device's date, so it is resolved after mount: a page rendered
  // at build time would otherwise carry the build day's recommendation.
  const [pick, setPick] = useState<Recommendation | null>(null);
  useEffect(() => {
    setPick(recommendation(data.programs, data.history));
  }, [data.programs, data.history]);

  const pickProgram = pick?.program ?? null;
  const pickGroups = useMemo(
    () => (pickProgram ? supersetInfo(pickProgram.exercises).groups.length : 0),
    [pickProgram],
  );

  const stats = useMemo(() => {
    const history = data.history;
    const totalMs = history.reduce((sum, entry) => sum + entry.durationMs, 0);
    const completed = history.reduce((sum, entry) => sum + entry.completedCount, 0);
    // Skipped movements leave the rate alone entirely: they are not work you
    // missed, so they should not sit in the denominator either. Older entries
    // saved before skips were tracked simply carry no figure.
    const planned = history.reduce(
      (sum, entry) => sum + Math.max(0, entry.totalCount - (entry.skippedCount ?? 0)),
      0,
    );
    const bars = history.slice(0, 8).map((entry) => entry.durationMs);
    const peak = Math.max(...bars, 1);
    return {
      sessions: history.length,
      hours: Math.round((totalMs / 3_600_000) * 10) / 10,
      rate: planned ? Math.round((completed / planned) * 100) : 0,
      bars: bars.map((value) => Math.max(12, Math.round((value / peak) * 100))),
    };
  }, [data.history]);

  const sessionProgram = data.programs.find((item) => item.id === data.session?.programId) ?? null;
  const elapsed = data.session ? timerElapsed(data.session.timer, now) : 0;
  // Skipped movements settle the workout but are counted on their own line, so
  // the progress figure only reflects finished work.
  const doneCount =
    data.session && sessionProgram
      ? sessionProgram.exercises.filter((exercise) => {
          const progress = progressOf(data.session, exercise.id);
          return isExerciseComplete(resolvedExercise(exercise, progress), progress);
        }).length
      : 0;
  const skippedCount =
    data.session && sessionProgram
      ? sessionProgram.exercises.filter(
          (exercise) => progressOf(data.session, exercise.id).skipped,
        ).length
      : 0;

  const scrollRail = (direction: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * rail.clientWidth * 0.84, behavior: "smooth" });
  };

  return (
    <>
      <section className="hero">
        <div className="hero-head reveal">
          <span className="kicker">
            <span className="kicker-index">01</span> Training maxes
          </span>
          <span className="hero-date">
            Your numbers,
            <br />
            in pounds
          </span>
        </div>

        <h1 className="type-display hero-statement reveal" style={{ "--d": 1 } as CSSProperties}>
          {hasMaxes ? (
            <>
              Five more
              <br />
              on the bar<em>.</em>
            </>
          ) : (
            <>
              Start with
              <br />
              your numbers<em>.</em>
            </>
          )}
        </h1>

        <p className="hero-lede reveal" style={{ "--d": 2 } as CSSProperties}>
          {hasMaxes
            ? "Every program runs your percentages and rounds to the nearest 5 lb, so the plates match the plan."
            : "Add a recent single or a set you could grind out. Percentages and plate math follow from there."}
        </p>

        <div className="maxes reveal" style={{ "--d": 3 } as CSSProperties}>
          {MAX_FIELDS.map(({ lift, label }) => {
            const value = settings.maxes[lift];
            const working = workingMaxFor(settings, lift);
            return (
              <label key={lift} className="maxcell">
                <span className="maxcell-label">{label}</span>
                <span className="maxcell-value">
                  <NumericInput
                    className="maxcell-input"
                    value={value}
                    onChange={(next) => setMax(lift, next)}
                                        ariaLabel={`${label} max in pounds`}
                    allowDecimal={false}
                  />
                  <span className="maxcell-unit">lb</span>
                </span>
                <span className="maxcell-sub">
                  {value && working ? (
                    <>
                      working <b>{formatWeight(working)}</b>
                    </>
                  ) : (
                    "not set"
                  )}
                </span>
              </label>
            );
          })}
        </div>

        <div className="dialrow reveal" style={{ "--d": 4 } as CSSProperties}>
          <ArcDial value={settings.workingMax ? 90 : 100} size={62} label={settings.workingMax ? "90%" : "100%"} />
          <div className="dialrow-body">
            <Toggle
              checked={settings.workingMax}
              onChange={(checked) => updateSettings({ workingMax: checked })}
              label={settings.workingMax ? "Working from 90%" : "Working from your true max"}
              hint={
                settings.workingMax
                  ? "Training percentages come off 90% of your true max."
                  : "Training percentages come off your full max."
              }
            />
          </div>
        </div>

        {stats.sessions ? (
          <div className="stats reveal" style={{ "--d": 5 } as CSSProperties}>
            <div className="stat">
              <span className="stat-value">{stats.sessions}</span>
              <span className="stat-label">sessions</span>
              <span className="stat-bars" aria-hidden="true">
                {stats.bars.map((height, index) => (
                  <i
                    key={index}
                    className={index === stats.bars.length - 1 ? "is-on" : ""}
                    style={{ "--h": `${height}%` } as CSSProperties}
                  />
                ))}
              </span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.hours}</span>
              <span className="stat-label">hours under bar</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.rate}%</span>
              <span className="stat-label">sets finished</span>
            </div>
          </div>
        ) : null}

        {data.session && sessionProgram ? (
          <button
            type="button"
            className="livebar reveal"
            data-cursor="link"
            onClick={() => onOpenProgram(sessionProgram.id, null)}
            style={{ "--d": 6 } as CSSProperties}
          >
            <span className="livebar-main">
              <span className="livebar-title">In progress · {sessionProgram.name}</span>
              <span className="livebar-sub">
                {doneCount} of {sessionProgram.exercises.length} moves done
                {skippedCount ? ` · ${skippedCount} skipped` : ""}
              </span>
            </span>
            <span className="livebar-time mono">{formatDuration(elapsed)}</span>
            <ChevronRightIcon size={15} />
          </button>
        ) : null}
      </section>

      {pick && pickProgram ? (
        <section className="today" aria-labelledby="today-title">
          <div className="today-head reveal">
            <span className="today-stamp">
              <span className="today-dot" aria-hidden="true" />
              Today
            </span>
            <span className="today-cycle">
              <span className="today-ticks" aria-hidden="true">
                {CYCLE.map((step, index) => (
                  <i key={step} className={index === pick.cycleDay - 1 ? "is-on" : ""} />
                ))}
              </span>
              {FOCUS_LABEL[pick.focus]}
            </span>
          </div>

          <div className="today-body reveal" style={{ "--d": 1 } as CSSProperties}>
            <h2 className="today-title" id="today-title">
              {pickProgram.name}
            </h2>
            <p className="today-meta">
              {pickProgram.exercises.length} movements
              {pickGroups ? ` · ${pickGroups} superset${pickGroups === 1 ? "" : "s"}` : ""}
              {pickProgram.exercises[0]
                ? ` · opens with ${pickProgram.exercises[0].name}`
                : ""}
            </p>

            <div className="today-art" aria-hidden="true">
              {pickProgram.exercises.slice(0, 3).map((exercise) => (
                <span key={exercise.id} className="today-thumb">
                  <ExerciseDemo name={exercise.name} demo={exercise.demo} variant="thumb" />
                </span>
              ))}
            </div>

            <div className="today-actions">
              {data.session ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onOpenProgram(pickProgram.id, null)}
                >
                  Look inside
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      startProgram(pickProgram.id);
                      onOpenProgram(pickProgram.id, null);
                    }}
                  >
                    <PlayIcon size={15} />
                    Start workout
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onOpenProgram(pickProgram.id, null)}
                  >
                    Look inside
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="today-foot reveal" style={{ "--d": 2 } as CSSProperties}>
            Next in the cycle: <b>{FOCUS_LABEL[pick.nextFocus]}</b>. Lower, push, pull, upper and full,
            one a day, so no week lands on the same pattern twice in a row.
          </p>
        </section>
      ) : null}

      <section className="band">
        <div className="band-head reveal">
          <span className="kicker kicker--ink">
            <span className="kicker-index">02</span> The work
          </span>
          <h2 className="band-title">
            Pick today&apos;s <em>work</em>.
          </h2>
          <p className="band-sub">
            Each program carries your maxes through sets, reps and the exact plates to load. Tap a
            card to open it.
          </p>
        </div>

        <div
          className="filters reveal"
          ref={filterDrag.ref}
          {...filterDrag.dragProps}
          style={{ "--d": 1 } as CSSProperties}
        >
          <button
            type="button"
            className={`filter ${filter === null ? "is-on" : ""}`}
            onClick={() => setFilter(null)}
          >
            All
          </button>
          {filterTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`filter ${filter === tag ? "is-on" : ""}`}
              onClick={() => setFilter(filter === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="rail" ref={railDrag.ref} {...railDrag.dragProps}>
          <button
            type="button"
            className="poster poster--new"
            onClick={onNewWorkout}
            data-cursor="link"
            data-cursor-label="Build"
          >
            <span className="poster-index" aria-hidden="true">
              <PlusIcon size={34} />
            </span>
            <span className="poster-art" aria-hidden="true">
              <PlateEmblem seed={2} />
            </span>
            <span className="poster-body">
              <span className="poster-name">New workout</span>
              <span className="poster-meta">
                <span>compose or describe</span>
              </span>
            </span>
          </button>

          {programs.map((program, index) => (
            <Poster
              key={program.id}
              program={program}
              index={index}
              onOpen={onOpenProgram}
            />
          ))}
        </div>

        {!programs.length ? (
          <div className="empty">
            <p className="empty-title">Nothing tagged “{filter}”</p>
            <p className="empty-text">Clear the filter, or import your own programs in the You tab.</p>
          </div>
        ) : null}

        <div className="band-foot">
          <span className="band-note">
            {programs.length} program{programs.length === 1 ? "" : "s"} · drag to browse
          </span>
          <div className="rail-nav">
            <button
              type="button"
              className="railbtn"
              aria-label="Previous programs"
              onClick={() => scrollRail(-1)}
            >
              <ArrowLeftIcon size={15} />
            </button>
            <button
              type="button"
              className="railbtn"
              aria-label="More programs"
              onClick={() => scrollRail(1)}
            >
              <ArrowRightIcon size={15} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function Poster({
  program,
  index,
  onOpen,
}: {
  program: Program;
  index: number;
  onOpen: (id: string, rect: DOMRect | null) => void;
}) {
  const { settings } = useApp();

  const loads = useMemo(() => {
    const anchor = program.exercises.find((exercise) => exercise.lift && exercise.percent);
    if (!anchor) return [];
    const target = exerciseTarget(settings, anchor);
    if (target === null) return [];
    return plateBreakdown(target, settings.barWeight, settings.plates).loads;
  }, [program, settings]);

  const tags = programTagList(program);

  return (
    <button
      type="button"
      className="poster poster--program"
      data-cursor="plate"
      data-cursor-label="Open"
      onClick={(event) => onOpen(program.id, event.currentTarget.getBoundingClientRect())}
    >
      <span className="poster-index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>

      <span className="poster-art" aria-hidden="true">
        {loads.length ? <PlateStack loads={loads} /> : <PlateEmblem seed={index} />}
      </span>

      <span className="poster-body">
        <span className="poster-name">{program.name}</span>
        <span className="poster-meta">
          <span>{program.exercises.length} moves</span>
          {tags.slice(0, 2).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </span>
      </span>

      <span className="poster-reveal" aria-hidden="true">
        <span className="poster-reveal-list">
          {program.exercises.slice(0, 3).map((exercise) => (
            <span key={exercise.id}>
              {exercise.name}
              <b>
                {exercise.sets} × {exercise.reps}
              </b>
            </span>
          ))}
        </span>
        <span className="poster-cta">
          Open program <ArrowUpRightIcon size={12} />
        </span>
      </span>
    </button>
  );
}
