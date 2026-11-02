"use client";

import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { useApp, workingMaxFor } from "@/lib/state";
import { formatDate, formatDuration, formatWeight } from "@/lib/format";
import { oneRepMax } from "@/lib/plates";
import { importAnvilTables } from "@/lib/programs";
import { looksLikeCsv, parseWorkoutCsv } from "@/lib/workoutFile";
import { stampDemos } from "@/lib/demos";
import { offlineSavedAt, saveDemosOffline } from "@/lib/offline";
import type { AppData, Lift, Program } from "@/lib/types";
import { DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from "./Icons";
import { Field, NumericInput } from "./ui";
import { BarStrip, RepsCurve } from "./Charts";
import { useAnimatedNumber } from "./motion";

const SAVE_TARGETS: { lift: Lift; label: string }[] = [
  { lift: "squat", label: "Squat" },
  { lift: "bench", label: "Bench" },
  { lift: "deadlift", label: "Deadlift" },
  { lift: "press", label: "Press" },
];

export function YouView({
  onNewWorkout,
  onOpenProgram,
}: {
  onNewWorkout: () => void;
  onOpenProgram: (id: string, rect: DOMRect | null) => void;
}) {
  const {
    data,
    settings,
    setMax,
    deleteProgram,
    replacePrograms,
    resetPrograms,
    clearHistory,
    resetAll,
    updateSettings,
  } = useApp();
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(5);
  const [saved, setSaved] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [offline, setOffline] = useState({
    saving: false,
    done: 0,
    total: 0,
    savedAt: null as string | null,
    error: null as string | null,
    available: null as boolean | null,
  });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOffline((current) => ({ ...current, savedAt: offlineSavedAt() }));
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      setOffline((current) => ({ ...current, available: false }));
      return;
    }
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (!cancelled) setOffline((current) => ({ ...current, available: Boolean(registration) }));
      })
      .catch(() => {
        if (!cancelled) setOffline((current) => ({ ...current, available: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveOffline = async () => {
    setOffline((current) => ({ ...current, saving: true, error: null, done: 0, total: 0 }));
    try {
      const total = await saveDemosOffline((progress) =>
        setOffline((current) => ({ ...current, done: progress.done, total: progress.total })),
      );
      setOffline((current) => ({
        ...current,
        saving: false,
        done: total,
        total,
        savedAt: offlineSavedAt(),
        error: null,
      }));
    } catch (error) {
      setOffline((current) => ({
        ...current,
        saving: false,
        error: error instanceof Error ? error.message : "Could not save the demos.",
      }));
    }
  };

  const estimate = weight && reps ? oneRepMax(weight, reps) : null;
  const animatedEstimate = useAnimatedNumber(estimate);

  const saveAs = (lift: Lift, label: string) => {
    if (!estimate) return;
    setMax(lift, estimate);
    setSaved(`${label} max set to ${formatWeight(estimate)} lb`);
    window.setTimeout(() => setSaved(null), 2600);
  };

  const exportData = () => {
    const payload = {
      app: "Otto Fitness",
      version: 2,
      exportedAt: new Date().toISOString(),
      settings: data.settings,
      programs: data.programs,
      history: data.history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `otto-fitness-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportMessage(null);
    setImportError(null);

    try {
      const text = await file.text();
      let programs: Program[];

      if (looksLikeCsv(text)) {
        programs = parseWorkoutCsv(text);
      } else {
        const raw = JSON.parse(text) as Partial<AppData> & { programs?: Program[] };
        if (
          Array.isArray(raw.programs) &&
          raw.programs.every((program) => Array.isArray(program.exercises))
        ) {
          programs = raw.programs;
          if (raw.settings) updateSettings(raw.settings);
        } else {
          programs = importAnvilTables(raw);
        }
      }

      // Every movement gets its demo now, and the message says what was missing.
      const { programs: stamped, found, total } = stampDemos(programs);
      replacePrograms(stamped);

      const demos =
        found === total
          ? "Every movement has a demo."
          : `Demos for ${found} of ${total}. Add the rest in the builder.`;
      setImportMessage(
        `Imported ${stamped.length} workout${stamped.length === 1 ? "" : "s"}, ${total} movement${
          total === 1 ? "" : "s"
        }. ${demos}`,
      );
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not read that file.");
    }
  };

  const historyBars = data.history.slice(0, 10).map((entry) => entry.durationMs);

  return (
    <>
      <section className="section" style={{ paddingTop: 10 }}>
        <span className="kicker">
          <span className="kicker-index">04</span> The log
        </span>
        <h1 className="type-title">Know your ceiling.</h1>
        <p className="note">
          Use it to pick a starting weight, then let the bar settle the argument.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Profile</h2>
          <span className="section-aside">saved on this device</span>
        </div>

        <div className="maxes">
          {SAVE_TARGETS.map(({ lift, label }) => {
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

        <p className="note">
          One profile, used everywhere: Train percentages, plate math and program previews all read
          from these four numbers. They persist in this browser.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">1RM estimate</h2>
          <span className="section-aside">Epley</span>
        </div>

        <div className="pair">
          <Field label="Weight">
            <div className="input-row">
              <NumericInput value={weight} onChange={setWeight} ariaLabel="Weight lifted" />
              <span className="unit">lb</span>
            </div>
          </Field>
          <Field label="Reps">
            <NumericInput
              value={reps}
              onChange={setReps}
              placeholder="5"
              ariaLabel="Reps performed"
              allowDecimal={false}
            />
          </Field>
        </div>

        <div className="readout-top">
          <div>
            <span className="kicker">Estimated max</span>
            {estimate ? (
              <p className="readout-value readout-value--sm">
                {formatWeight(animatedEstimate ?? estimate)}
                <small>lb</small>
              </p>
            ) : (
              <p className="readout-null">enter a weight</p>
            )}
          </div>
          {estimate && weight && reps ? (
            <div className="readout-aside">
              <span className="kicker">From</span>
              <span className="mono" style={{ fontSize: 13 }}>
                {formatWeight(weight)} × {reps}
              </span>
            </div>
          ) : null}
        </div>

        <RepsCurve estimate={estimate} weight={weight} reps={reps} />

        <div className="actions">
          {SAVE_TARGETS.map(({ lift, label }) => (
            <button
              key={lift}
              type="button"
              className="textaction"
              disabled={!estimate}
              onClick={() => saveAs(lift, label)}
            >
              Save as {label}
            </button>
          ))}
        </div>

        {saved ? <p className="note note-good">{saved}</p> : null}
        <p className="note">
          1RM = weight × (1 + reps ÷ 30). Most trustworthy in the 2-8 rep range.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Workouts</h2>
          <div className="section-tools">
            {data.programs.length > 6 ? (
              <button
                type="button"
                className="linkbtn"
                onClick={() => setShowAllWorkouts((show) => !show)}
              >
                {showAllWorkouts ? "Show less" : `All ${data.programs.length}`}
              </button>
            ) : null}
            <button type="button" className="linkbtn" onClick={onNewWorkout}>
              <PlusIcon size={11} /> New
            </button>
          </div>
        </div>

        <div className="ledger">
          {(showAllWorkouts ? data.programs : data.programs.slice(0, 6)).map((program, index) => (
            <div key={program.id} className="ledger-row">
              <span className="ledger-num">{String(index + 1).padStart(2, "0")}</span>
              <button
                type="button"
                className="ledger-main ledger-main--button"
                onClick={(event) =>
                  onOpenProgram(program.id, event.currentTarget.getBoundingClientRect())
                }
              >
                <span className="ledger-name">{program.name}</span>
                <span className="ledger-meta">
                  {program.exercises.length} moves
                  {program.tags.length ? ` · ${program.tags.slice(0, 2).join(" · ")}` : ""}
                </span>
              </button>
              <button
                type="button"
                className="librow-del"
                aria-label={`Delete ${program.name}`}
                onClick={() => {
                  if (window.confirm(`Delete “${program.name}”?`)) deleteProgram(program.id);
                }}
              >
                <TrashIcon size={14} />
              </button>
            </div>
          ))}
        </div>

        <p className="note">
          {data.library.length} movements in your exercise library. Add movements or build a session in
          the builder. The wheel in Train opens it too.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Recent sessions</h2>
          {data.history.length ? (
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                if (window.confirm("Clear your workout history?")) clearHistory();
              }}
            >
              Clear
            </button>
          ) : null}
        </div>

        {data.history.length ? (
          <>
            <BarStrip values={historyBars} />
            <p className="note" style={{ marginTop: -6 }}>
              Time under bar, oldest to newest.
            </p>
            <div className="ledger">
              {data.history.slice(0, 8).map((entry, index) => (
                <div key={entry.id} className="ledger-row">
                  <span className="ledger-num">{String(index + 1).padStart(2, "0")}</span>
                  <div className="ledger-main">
                    <span className="ledger-name">{entry.programName}</span>
                    <span className="ledger-meta">{formatDate(entry.finishedAt)}</span>
                  </div>
                  <div className="ledger-stats">
                    <span className="ledger-time">{formatDuration(entry.durationMs)}</span>
                    <span className="ledger-count">
                      {entry.completedCount}/{entry.totalCount} moves
                      {entry.skippedCount ? ` · ${entry.skippedCount} skipped` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty">
            <p className="empty-title">No sessions yet</p>
            <p className="empty-text">Finish a workout and it lands here, with time and completion.</p>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Programs &amp; data</h2>
          <span className="section-aside">this device only</span>
        </div>
        <p className="note">
          Maxes, programs and history live in this browser. Export a backup before switching phones,
          and import that file back on the new one.
        </p>

        <div className="template-block">
          <span className="kicker">Write your own</span>
          <p className="note" style={{ marginTop: 4 }}>
            Download the template, open it in Numbers, Excel or Google Sheets, and fill in one row
            per movement. Save it as CSV and import it below. Demos are matched from the names.
          </p>
          <div className="colchips" aria-label="Template columns">
            {["workout", "order", "exercise", "sets", "reps", "percent", "lift", "notes", "superset"].map(
              (column) => (
                <span key={column} className="colchip">
                  {column}
                </span>
              ),
            )}
          </div>
          <a
            className="btn btn-secondary btn-block"
            href="/otto-workout-template.csv"
            download="otto-workout-template.csv"
          >
            <DownloadIcon size={17} />
            Download workout template
          </a>
          <p className="note note-quiet">
            percent is optional. Leave it blank to load the bar by feel, or pair it with squat,
            bench, deadlift or press in the lift column.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 } as CSSProperties}>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => fileInput.current?.click()}
          >
            <UploadIcon size={17} />
            Import workouts
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="text/csv,.csv,application/json,.json"
            className="sr-only"
            onChange={handleImport}
          />
          <button type="button" className="btn btn-secondary btn-block" onClick={exportData}>
            <DownloadIcon size={17} />
            Export backup (JSON)
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => {
              if (window.confirm("Restore the built-in programs? Your imported programs will be removed.")) {
                resetPrograms();
                setImportMessage("Built-in programs restored.");
                setImportError(null);
              }
            }}
          >
            Restore built-in programs
          </button>
        </div>
        {importMessage ? <p className="note note-good">{importMessage}</p> : null}
        {importError ? <p className="note note-warn">{importError}</p> : null}

        <div className="offline-block">
          <span className="kicker">Offline</span>
          {offline.available === false ? (
            <p className="note note-quiet" style={{ marginTop: 4 }}>
              Offline saving turns on in the deployed app. Local development skips the worker so it
              does not fight hot reload.
            </p>
          ) : (
            <>
              <p className="note" style={{ marginTop: 4 }}>
                {offline.savedAt
                  ? `Movement demos saved ${formatDate(new Date(offline.savedAt).getTime())}. The app and every animation open with no signal.`
                  : "The app saves itself the first time it opens on this phone. Save the movement demos too and the animations still play in a gym with no signal."}
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={saveOffline}
                disabled={offline.saving}
              >
                <DownloadIcon size={17} />
                {offline.saving
                  ? `Saving ${offline.done} of ${offline.total || "…"}`
                  : offline.savedAt
                    ? "Update offline demos"
                    : "Save demos for offline"}
              </button>
              {offline.saving ? (
                <span className="offline-bar" aria-hidden="true">
                  <i
                    style={{
                      width: offline.total
                        ? `${Math.round((offline.done / offline.total) * 100)}%`
                        : "6%",
                    }}
                  />
                </span>
              ) : null}
              {offline.error ? <p className="note note-warn">{offline.error}</p> : null}
            </>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">About</h2>
          <span className="section-aside">otto fitness</span>
        </div>
        <p className="note">
          A personal barbell companion: plate math, percentages and 1RM estimates only. Check your
          form before chasing a number.
        </p>
        <div className="actions">
          <a
            className="textaction"
            href="mailto:ottoa98@gmail.com?subject=Otto%20Fitness%20feedback"
          >
            Send feedback
          </a>
          <a className="textaction" href="https://venmo.com/u/Ottoa98" target="_blank" rel="noreferrer">
            Support on Venmo
          </a>
          <button
            type="button"
            className="textaction"
            onClick={() => {
              if (window.confirm("Reset all app data on this device? Maxes, sessions and programs will be cleared.")) {
                resetAll();
              }
            }}
          >
            <TrashIcon size={12} /> Reset all data
          </button>
        </div>
      </section>
    </>
  );
}
