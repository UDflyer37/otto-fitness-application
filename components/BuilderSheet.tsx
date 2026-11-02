"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { defaultLibraryExercise, guessLift, newExerciseId } from "@/lib/library";
import { autoDemo, demoLabel, imageToDataUrl, searchMoves } from "@/lib/demos";
import { parseWorkoutDescription, type DraftExercise, type DraftProgram } from "@/lib/parseWorkout";
import { LIFT_LABEL, slugify } from "@/lib/programs";
import { useApp } from "@/lib/state";
import {
  normalizeSupersetFlags,
  supersetInfo,
  type SupersetInfo,
} from "@/lib/supersets";
import type { LibraryExercise, Lift, Program } from "@/lib/types";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  GripIcon,
  LinkIcon,
  PlusIcon,
  ShuffleIcon,
  TrashIcon,
} from "./Icons";
import { NumericInput, Segmented } from "./ui";
import { ExerciseDemo } from "./ExerciseDemo";

type Tab = "compose" | "describe" | "existing" | "library";

type SpeechAlternative = { transcript?: string };
type SpeechEvent = {
  resultIndex: number;
  results: { length: number; [index: number]: { 0?: SpeechAlternative; isFinal: boolean } };
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

function speechConstructor() {
  const scope = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const LIFTS: (Lift | null)[] = ["squat", "bench", "deadlift", "press", null];

function liftName(lift: Lift | null) {
  return lift ? LIFT_LABEL[lift] : "By feel";
}

/** Turns a saved workout into an editable draft, keeping its supersets. */
function draftFromProgram(program: Program): DraftExercise[] {
  const info = supersetInfo(program.exercises);
  return program.exercises.map((exercise) => ({
    id: newExerciseId(exercise.name),
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    percent: exercise.percent,
    lift: exercise.lift,
    superset: (info.groupOf[exercise.id] ?? 0) > 0,
    demo: exercise.demo ?? autoDemo(exercise.name),
  }));
}

export function BuilderSheet({
  onClose,
  onCreated,
  seedProgramId = null,
}: {
  onClose: () => void;
  onCreated: (programId: string) => void;
  seedProgramId?: string | null;
}) {
  const { data, saveProgram, addLibraryExercise, removeLibraryExercise } = useApp();
  const [tab, setTab] = useState<Tab>("compose");
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  const [copyQuery, setCopyQuery] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<DraftExercise[]>([]);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<LibraryExercise | null>(null);
  const [listening, setListening] = useState(false);
  const [reading, setReading] = useState(false);
  const [speechReady, setSpeechReady] = useState(false);
  const draftSection = useRef<HTMLElement>(null);
  const recognition = useRef<Recognition | null>(null);
  const listeningRef = useRef(false);
  const baseText = useRef("");
  const finalText = useRef("");
  const seeded = useRef(false);

  // Opened from a program with "Duplicate and edit" on it.
  useEffect(() => {
    if (!seedProgramId || seeded.current) return;
    const program = data.programs.find((item) => item.id === seedProgramId);
    if (!program) return;
    seeded.current = true;
    setDraft(draftFromProgram(program));
    setName(`${program.name} copy`);
    setCopiedFrom(program.name);
    setTab("compose");
  }, [seedProgramId, data.programs]);

  useEffect(() => {
    setSpeechReady(Boolean(speechConstructor()));
    return () => {
      listeningRef.current = false;
      recognition.current?.stop();
    };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const filtered = data.library.filter((item) =>
    query.trim() ? item.name.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  const addMovement = (item: LibraryExercise) => {
    setDraft((current) => [
      ...current,
      {
        id: newExerciseId(item.name),
        name: item.name,
        sets: item.sets,
        reps: item.reps,
        percent: item.percent,
        lift: item.lift,
        // The lookup runs as the movement joins the workout, so the demo
        // travels with it instead of being guessed again later.
        demo: item.demo ?? autoDemo(item.name),
        superset: false,
      },
    ]);
  };

  /**
   * The connective tissue between two rows: tapping the link between two
   * movements pairs them, and tapping a joined pair splits them apart again.
   */
  const toggleLink = (index: number) => {
    setDraft((current) => {
      const first = current[index];
      const second = current[index + 1];
      if (!first || !second) return current;

      const info = supersetInfo(current);
      const group = info.groupOf[first.id] ?? 0;
      const joined = group !== 0 && group === (info.groupOf[second.id] ?? 0);

      const next = joined
        ? current.map((item, position) =>
            position > index && (info.groupOf[item.id] ?? 0) === group
              ? { ...item, superset: false }
              : item,
          )
        : current.map((item, position) =>
            position === index || position === index + 1
              ? { ...item, superset: true }
              : item,
          );

      // No legacy pairing here: a split must be able to leave a single
      // movement behind rather than immediately welding it to the next row.
      return normalizeSupersetFlags(next, { pairUp: false });
    });
  };

  const copyProgram = (program: Program) => {
    if (
      draft.length &&
      !window.confirm(
        `Replace the ${draft.length} movement${draft.length === 1 ? "" : "s"} you have so far with a copy of “${program.name}”?`,
      )
    ) {
      return;
    }
    setDraft(draftFromProgram(program));
    setName(`${program.name} copy`);
    setCopiedFrom(program.name);
    setTab("compose");
    setMessage(`Copied ${program.name}. Change what you need, then save it as a new workout.`);
    window.setTimeout(
      () => draftSection.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
      80,
    );
  };

  const patchDraft = (id: string, patch: Partial<DraftExercise>) => {
    setDraft((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  /** Drag a row to a new slot. Groups that lose their partner fall back to normal. */
  const moveDraft = (from: number, to: number) => {
    setDraft((current) => {
      if (from === to || from < 0 || to < 0 || from >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(Math.min(to, next.length), 0, moved);
      return normalizeSupersetFlags(next, { pairUp: false });
    });
  };

  const applyDraft = (parsed: DraftProgram, source: "ai" | "local") => {
    if (!parsed.exercises.length) {
      setMessage("Couldn't find movements in that. Name a body part or say it like “3x10 bench press at 70%”.");
      return;
    }
    setDraft(
      parsed.exercises.map((exercise) => ({
        ...exercise,
        demo: exercise.demo ?? autoDemo(exercise.name),
        superset: Boolean(exercise.superset),
      })),
    );
    if (!name.trim() && parsed.name) setName(parsed.name);
    setMessage(
      source === "ai"
        ? `AI built ${parsed.exercises.length} movements. Check the sets and percentages below.`
        : `Read ${parsed.exercises.length} movements. Check sets, reps and percentages below.`,
    );
    setTab("compose");
    window.setTimeout(
      () => draftSection.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
      80,
    );
  };

  const readDescription = async () => {
    if (!text.trim()) {
      setMessage("Describe the session first. “Destroy my legs, let's hit the smith machine” works.");
      return;
    }

    setReading(true);
    setMessage(null);

    let parsed: DraftProgram | null = null;
    let source: "ai" | "local" = "local";

    try {
      const response = await fetch("/api/describe-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, library: data.library }),
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          program?: DraftProgram;
          source?: "ai" | "local";
        };
        if (payload.program?.exercises?.length) {
          parsed = payload.program;
          source = payload.source === "ai" ? "ai" : "local";
        }
      }
    } catch {
      // No server (or offline): the local parser covers it.
    }

    if (!parsed) parsed = parseWorkoutDescription(text, data.library);

    setReading(false);
    applyDraft(parsed, source);
  };

  const listen = () => {
    if (listeningRef.current) {
      listeningRef.current = false;
      setListening(false);
      recognition.current?.stop();
      return;
    }

    const Ctor = speechConstructor();
    if (!Ctor) {
      setMessage("Voice input isn't available in this browser. Typing works the same.");
      return;
    }

    const instance = new Ctor();
    instance.lang = navigator.language?.startsWith("en") ? navigator.language : "en-US";
    instance.continuous = true;
    instance.interimResults = true;

    baseText.current = text.trim() ? `${text.trim()} ` : "";
    finalText.current = "";

    instance.onresult = (event) => {
      let settled = "";
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const chunk = result[0]?.transcript ?? "";
        if (result.isFinal) settled += chunk;
        else interim += chunk;
      }
      if (settled) finalText.current = `${finalText.current}${settled}`;
      setText(
        `${baseText.current}${finalText.current}${interim}`.replace(/\s+/g, " ").replace(/^\s/, ""),
      );
    };

    instance.onerror = (event) => {
      const error = (event as { error?: string }).error ?? "";
      // A pause is not a failure: onend restarts the stream for these.
      if (error === "no-speech" || error === "aborted" || error === "network") return;
      listeningRef.current = false;
      setListening(false);
      setMessage(
        error === "not-allowed" || error === "service-not-allowed"
          ? "Microphone access is blocked. Allow it in your browser settings, or type it."
          : "Voice input stopped. Tap Speak to pick it back up, or type it.",
      );
    };

    instance.onend = () => {
      if (!listeningRef.current) {
        setListening(false);
        return;
      }
      // Chrome ends its stream after a pause; keep the same session going.
      window.setTimeout(() => {
        if (!listeningRef.current) return;
        try {
          instance.start();
        } catch {
          listeningRef.current = false;
          setListening(false);
        }
      }, 320);
    };

    recognition.current = instance;
    listeningRef.current = true;
    try {
      instance.start();
      setListening(true);
      setMessage(null);
    } catch {
      listeningRef.current = false;
      setMessage("Couldn't start the mic. Try again or type it.");
    }
  };

  const save = () => {
    if (!draft.length) {
      setMessage("Add at least one movement before saving.");
      return;
    }
    const title = name.trim() || "My workout";
    const tags = [
      ...new Set(draft.map((item) => (item.lift ? LIFT_LABEL[item.lift] : "Free weights"))),
    ].slice(0, 3);

    const program: Program = {
      id: `${slugify(title) || "program"}-${Date.now().toString(36)}`,
      name: title,
      tags,
      exercises: draft.map((item, index) => ({
        id: `${slugify(title) || "program"}-${index}`,
        name: item.name,
        sets: item.sets || "3",
        reps: item.reps || "8",
        percent: item.percent,
        lift: item.lift,
        superset: Boolean(item.superset),
        demo: item.demo ?? autoDemo(item.name),
      })),
    };

    saveProgram(program);
    onCreated(program.id);
  };

  return (
    <div className="sheet builder">
      <div className="sheet-glow" aria-hidden="true" />

      <div className="sheet-inner builder-inner">
        <header className="proghead">
          <div className="proghead-top">
            <button type="button" className="backbtn" onClick={onClose} aria-label="Close builder">
              <ChevronLeftIcon size={18} />
            </button>
            <div className="proghead-meta">
              <span className="proghead-kicker">{copiedFrom ? "Copy" : "Build"}</span>
              <span className="proghead-title">{copiedFrom ?? "New workout"}</span>
            </div>
            <span className="builder-count">
              {draft.length} {draft.length === 1 ? "move" : "moves"}
            </span>
          </div>
        </header>

        <div className="builder-body">
          <div className="builder-tabs">
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: "compose", label: "Compose" },
                { value: "describe", label: "Describe" },
                { value: "existing", label: "Start from" },
                { value: "library", label: "Library" },
              ]}
            />
          </div>

          <label className="builder-name">
            <span className="field-label">Workout name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tuesday volume"
              aria-label="Workout name"
              autoComplete="off"
              enterKeyHint="done"
            />
          </label>

          {/* The draft comes first: it is the thing being built. */}
          {draft.length ? (
            <DraftList
              draft={draft}
              sectionRef={draftSection}
              onPatch={patchDraft}
              onMove={moveDraft}
              onToggleLink={toggleLink}
              onRemove={(id) => setDraft((current) => current.filter((entry) => entry.id !== id))}
              onClear={() => {
                setDraft([]);
                setCopiedFrom(null);
              }}
            />
          ) : null}

          {tab === "describe" ? (
            <section className="builder-panel">
              <div className="builder-panel-head">
                <span className="kicker">Say it or type it</span>
                {speechReady ? (
                  <button
                    type="button"
                    className={`mic ${listening ? "is-on" : ""}`}
                    onClick={listen}
                    aria-pressed={listening}
                  >
                    <span className="mic-dot" aria-hidden="true" />
                    {listening ? "Listening" : "Speak"}
                  </button>
                ) : null}
              </div>
              <textarea
                className="describe-field"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={5}
                placeholder={"destroy my legs. let's hit the smith machine\n\nor: 5x5 back squat at 80%, 3x8 barbell row"}
                aria-label="Describe your workout"
              />
              {listening ? (
                <p className="note note-good builder-listening">
                  Listening. Keep talking, the transcript stays live. Tap Stop when you&apos;re done.
                </p>
              ) : null}
              <div className="builder-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={readDescription}
                  disabled={reading}
                >
                  {reading ? "Reading…" : "Turn it into a workout"}
                </button>
              </div>
              <p className="note">
                Reads body parts, equipment and set schemes: “arms”, “smith machine”, “5x5 at 80%”.
                Every movement it suggests stays editable before you save.
              </p>
            </section>
          ) : null}

          {tab === "existing" ? (
            <section className="builder-panel">
              <div className="builder-panel-head">
                <span className="kicker">Copy a workout</span>
                <span className="panel-toggle-note">{data.programs.length} saved</span>
              </div>
              <input
                className="input"
                value={copyQuery}
                onChange={(event) => setCopyQuery(event.target.value)}
                placeholder="Search your workouts"
                aria-label="Search your workouts"
                autoComplete="off"
              />
              <div className="liblist">
                {data.programs
                  .filter((program) =>
                    copyQuery.trim()
                      ? program.name.toLowerCase().includes(copyQuery.trim().toLowerCase())
                      : true,
                  )
                  .slice(0, 40)
                  .map((program) => {
                    const first = program.exercises[0];
                    const groups = supersetInfo(program.exercises).groups.length;
                    return (
                      <button
                        key={program.id}
                        type="button"
                        className="librow"
                        onClick={() => copyProgram(program)}
                      >
                        <span className="librow-thumb" aria-hidden="true">
                          {first ? (
                            <ExerciseDemo name={first.name} demo={first.demo} variant="thumb" />
                          ) : null}
                        </span>
                        <span className="librow-main">
                          <span className="librow-name">{program.name}</span>
                          <span className="librow-meta">
                            {program.exercises.length} moves
                            {groups ? ` · ${groups} superset${groups === 1 ? "" : "s"}` : ""}
                            {program.tags.length ? ` · ${program.tags.slice(0, 2).join(" · ")}` : ""}
                          </span>
                        </span>
                        <span className="librow-add" aria-hidden="true">
                          <CopyIcon size={14} />
                        </span>
                      </button>
                    );
                  })}
              </div>
              <p className="note">
                Picks a saved workout and copies every movement, superset and percentage into a new
                draft. Your original stays untouched.
              </p>
            </section>
          ) : null}

          {tab === "compose" ? (
            <section className="builder-panel">
              <div className="builder-panel-head">
                <button
                  type="button"
                  className="panel-toggle"
                  aria-expanded={libraryOpen}
                  onClick={() => setLibraryOpen((open) => !open)}
                >
                  <ChevronRightIcon
                    size={13}
                    className={`panel-chevron ${libraryOpen || editing ? "is-open" : ""}`}
                  />
                  <span className="kicker">Add from library</span>
                </button>
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => {
                    setLibraryOpen(true);
                    setEditing((current) => (current ? null : defaultLibraryExercise()));
                  }}
                >
                  {editing ? "Close" : "+ New exercise"}
                </button>
              </div>

              {!libraryOpen && !editing ? null : editing ? (
                <ExerciseForm
                  initial={editing}
                  onCancel={() => setEditing(null)}
                  onSave={(item) => {
                    addLibraryExercise(item);
                    addMovement(item);
                    setEditing(null);
                    setMessage(`${item.name} added to your library.`);
                  }}
                />
              ) : null}

              {!editing && libraryOpen ? (
                <>
                  <input
                    className="input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search exercises"
                    aria-label="Search exercises"
                    autoComplete="off"
                  />
                  <div className="liblist">
                    {filtered.slice(0, 40).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="librow"
                        onClick={() => addMovement(item)}
                      >
                        <span className="librow-thumb" aria-hidden="true">
                          <ExerciseDemo name={item.name} demo={item.demo} variant="thumb" />
                        </span>
                        <span className="librow-main">
                          <span className="librow-name">{item.name}</span>
                          <span className="librow-meta">
                            {item.sets} × {item.reps}
                            {item.percent ? ` · ${item.percent}%` : " · by feel"}
                            {item.lift ? ` · ${liftName(item.lift)}` : ""}
                          </span>
                        </span>
                        <span className="librow-add" aria-hidden="true">
                          <PlusIcon size={14} />
                        </span>
                      </button>
                    ))}
                    {!filtered.length ? (
                      <p className="note">
                        Nothing matches “{query}”. Add it with <b>+ New exercise</b>.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {tab === "library" ? (
            <section className="builder-panel">
              <div className="builder-panel-head">
                <span className="kicker">Exercise library · {data.library.length}</span>
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() =>
                    setEditing((current) => (current ? null : defaultLibraryExercise()))
                  }
                >
                  {editing ? "Close" : "+ New exercise"}
                </button>
              </div>

              {editing ? (
                <ExerciseForm
                  initial={editing}
                  onCancel={() => setEditing(null)}
                  onSave={(item) => {
                    addLibraryExercise(item);
                    setEditing(null);
                    setMessage(`${item.name} saved.`);
                  }}
                />
              ) : null}

              {data.library.map((item) => (
                <div key={item.id} className="librow librow--manage">
                  <span className="librow-thumb" aria-hidden="true">
                    <ExerciseDemo name={item.name} demo={item.demo} variant="thumb" />
                  </span>
                  <button
                    type="button"
                    className="librow-main"
                    onClick={() => setEditing(item)}
                    aria-label={`Edit ${item.name}`}
                  >
                    <span className="librow-name">{item.name}</span>
                    <span className="librow-meta">
                      {item.sets} × {item.reps}
                      {item.percent ? ` · ${item.percent}%` : " · by feel"}
                      {item.lift ? ` · ${liftName(item.lift)}` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="librow-del"
                    aria-label={`Remove ${item.name} from library`}
                    onClick={() => removeLibraryExercise(item.id)}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
            </section>
          ) : null}

          {message ? <p className="note note-good builder-message">{message}</p> : null}
        </div>
      </div>

      <footer className="sheet-action">
        <div className="sheet-action-meta">
          <span>{name.trim() || "Untitled workout"}</span>
          <span>
            {draft.length} {draft.length === 1 ? "movement" : "movements"}
          </span>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={save}>
          <CheckIcon size={17} />
          Save workout
        </button>
      </footer>
    </div>
  );
}

function DraftList({
  draft,
  sectionRef,
  onPatch,
  onMove,
  onToggleLink,
  onRemove,
  onClear,
}: {
  draft: DraftExercise[];
  sectionRef: RefObject<HTMLElement | null>;
  onPatch: (id: string, patch: Partial<DraftExercise>) => void;
  onMove: (from: number, to: number) => void;
  onToggleLink: (index: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const info: SupersetInfo = supersetInfo(draft);
  const listRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    index: number;
    pointerId: number;
    startY: number;
    dy: number;
    slot: number;
    dropY: number | null;
    rects: { top: number; height: number }[];
  } | null>(null);

  const beginDrag = (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    const list = listRef.current;
    if (!list || draft.length < 2) return;
    const listTop = list.getBoundingClientRect().top;
    const rects = [...list.querySelectorAll<HTMLElement>(".draft")].map((row) => {
      const box = row.getBoundingClientRect();
      return { top: box.top - listTop, height: box.height };
    });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety; the handlers still work without it.
    }
    setDrag({
      index,
      pointerId: event.pointerId,
      startY: event.clientY,
      dy: 0,
      slot: index,
      dropY: null,
      rects,
    });
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const others = drag.rects.map((_, index) => index).filter((index) => index !== drag.index);
    let slot = others.length;
    for (let step = 0; step < others.length; step += 1) {
      const rect = drag.rects[others[step]];
      if (event.clientY < rect.top + rect.height / 2) {
        slot = step;
        break;
      }
    }
    const last = drag.rects[others[others.length - 1]];
    const dropY =
      slot < others.length ? drag.rects[others[slot]].top : last.top + last.height;
    setDrag({ ...drag, dy: event.clientY - drag.startY, slot, dropY });
  };

  const endDrag = () => {
    if (!drag) return;
    if (drag.slot !== drag.index) onMove(drag.index, drag.slot);
    setDrag(null);
  };

  return (
    <section className="builder-panel builder-panel--draft" ref={sectionRef}>
      <div className="builder-panel-head">
        <span className="kicker">
          This workout · {draft.length}
        </span>
        <button type="button" className="linkbtn" onClick={onClear}>
          Clear
        </button>
      </div>

      {draft.length > 1 ? (
        <p className="note draft-hint">
          Drag a handle to reorder. Tap the link between two movements to run them as a superset.
        </p>
      ) : null}

      <div className={`draftlist ${drag ? "is-sorting" : ""}`} ref={listRef}>
        {draft.map((item, index) => {
          const group = info.groupOf[item.id] ?? 0;
          const slot = info.slotOf[item.id] ?? 0;
          const letter = group
            ? info.groups.find((entry) => entry.index === group)?.letter ?? ""
            : "";
          const next = draft[index + 1];
          const joined =
            Boolean(next) && group !== 0 && group === (info.groupOf[next.id] ?? 0);

          return (
          <Fragment key={item.id}>
          <div
            className={`draft ${group ? "draft--linked" : ""} ${
              drag?.index === index ? "is-dragging" : ""
            }`}
            style={
              drag?.index === index
                ? ({ "--dy": `${drag.dy}px` } as CSSProperties)
                : undefined
            }
          >
            <div className="draft-top">
              <span className={`draft-index ${group ? "is-grouped" : ""}`}>
                {group ? `${letter}${slot}` : String(index + 1).padStart(2, "0")}
              </span>
              <input
                className="draft-name"
                value={item.name}
                onChange={(event) => onPatch(item.id, { name: event.target.value })}
                aria-label={`Exercise ${index + 1} name`}
              />
              {item.suggested ? <span className="draft-flag">suggested</span> : null}
              <button
                type="button"
                className="draft-grip"
                aria-label={`Reorder ${item.name}`}
                onPointerDown={(event) => beginDrag(index, event)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={() => setDrag(null)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    onMove(index, Math.max(0, index - 1));
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    onMove(index, Math.min(draft.length - 1, index + 1));
                  }
                }}
              >
                <GripIcon size={14} />
              </button>
              <button
                type="button"
                className="draft-del"
                aria-label={`Remove ${item.name}`}
                onClick={() => onRemove(item.id)}
              >
                <TrashIcon size={13} />
              </button>
            </div>
            <div className="draft-fields">
              <label className="mini">
                <span>Sets</span>
                <input
                  className="mini-input"
                  inputMode="numeric"
                  value={item.sets}
                  onChange={(event) => onPatch(item.id, { sets: event.target.value })}
                />
              </label>
              <label className="mini">
                <span>Reps</span>
                <input
                  className="mini-input"
                  value={item.reps}
                  onChange={(event) => onPatch(item.id, { reps: event.target.value })}
                />
              </label>
              <label className="mini">
                <span>%</span>
                <NumericInput
                  className="mini-input"
                  value={item.percent}
                  onChange={(value) => onPatch(item.id, { percent: value })}
                                    ariaLabel={`Percent for ${item.name}`}
                  allowDecimal={false}
                />
              </label>
              <select
                className="mini-select"
                value={item.lift ?? "none"}
                aria-label={`Lift for ${item.name}`}
                onChange={(event) =>
                  onPatch(item.id, {
                    lift: event.target.value === "none" ? null : (event.target.value as Lift),
                  })
                }
              >
                {LIFTS.map((lift) => (
                  <option key={lift ?? "none"} value={lift ?? "none"}>
                    {liftName(lift)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {next ? (
            <button
              type="button"
              className={`linker ${joined ? "is-on" : ""}`}
              aria-pressed={joined}
              aria-label={
                joined
                  ? `Split the superset between ${item.name} and ${next.name}`
                  : `Superset ${item.name} with ${next.name}`
              }
              onClick={() => onToggleLink(index)}
            >
              <span className="linker-node" aria-hidden="true">
                <LinkIcon size={11} />
              </span>
              <span className="linker-text">{joined ? "superset" : "link"}</span>
            </button>
          ) : null}
          </Fragment>
          );
        })}
        {drag && drag.dropY !== null && drag.slot !== drag.index ? (
          <span className="draft-drop" style={{ top: drag.dropY }} aria-hidden="true" />
        ) : null}
      </div>
    </section>
  );
}

function ExerciseForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: LibraryExercise;
  onSave: (item: LibraryExercise) => void;
  onCancel: () => void;
}) {
  const [item, setItem] = useState<LibraryExercise>(initial ?? defaultLibraryExercise());
  const patch = (next: Partial<LibraryExercise>) => setItem((current) => ({ ...current, ...next }));

  return (
    <form
      className="exform"
      onSubmit={(event) => {
        event.preventDefault();
        const name = item.name.trim();
        if (!name) return;
        onSave({
          ...item,
          id: initial?.id ?? newExerciseId(name),
          name,
          lift: item.lift ?? guessLift(name),
          sets: item.sets || "3",
          reps: item.reps || "8",
        });
      }}
    >
      <label className="mini mini--wide">
        <span>Name</span>
        <input
          className="mini-input"
          value={item.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="Front squat"
          aria-label="Exercise name"
          autoFocus
        />
      </label>

      <div className="draft-fields">
        <label className="mini">
          <span>Sets</span>
          <input
            className="mini-input"
            inputMode="numeric"
            value={item.sets}
            onChange={(event) => patch({ sets: event.target.value })}
          />
        </label>
        <label className="mini">
          <span>Reps</span>
          <input
            className="mini-input"
            value={item.reps}
            onChange={(event) => patch({ reps: event.target.value })}
          />
        </label>
        <label className="mini">
          <span>%</span>
          <NumericInput
            className="mini-input"
            value={item.percent}
            onChange={(value) => patch({ percent: value })}
                        ariaLabel="Percent of max"
            allowDecimal={false}
          />
        </label>
      </div>

      <div className="liftchips">
        {LIFTS.map((lift) => (
          <button
            key={lift ?? "none"}
            type="button"
            className={`liftchip ${item.lift === lift ? "is-on" : ""}`}
            aria-pressed={item.lift === lift}
            onClick={() => patch({ lift })}
          >
            {liftName(lift)}
          </button>
        ))}
      </div>

      <DemoField name={item.name} value={item.demo ?? null} onChange={(demo) => patch({ demo })} />

      <div className="exform-actions">
        <button type="submit" className="btn btn-secondary">
          {initial?.name ? "Save changes" : "Add exercise"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Picks the movement demo: the name lookup runs on its own, and this is where
 * the lifter overrides it with another movement or a photo of their own setup.
 */
function DemoField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string | null;
  onChange: (demo: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const auto = autoDemo(name);
  const label = demoLabel(name, value);
  const matches = searchMoves(query, 60);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await imageToDataUrl(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="demofield">
      <div className="demofield-top">
        <span className="mini-label">Demo</span>
        <span className="demofield-state">
          {label ? `Using ${label}` : "No demo yet"}
        </span>
      </div>

      <div className="demofield-body">
        <span className="demofield-thumb">
          <ExerciseDemo name={name} demo={value} variant="thumb" />
        </span>
        <div className="demofield-actions">
          <button type="button" className="linkbtn" onClick={() => setOpen((shown) => !shown)}>
            {open ? "Close list" : label ? "Change demo" : "Choose a demo"}
          </button>
          <button
            type="button"
            className="linkbtn"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            {busy ? "Reading photo…" : "Upload a photo"}
          </button>
          {value ? (
            <button type="button" className="linkbtn" onClick={() => onChange(null)}>
              Use the lookup
            </button>
          ) : null}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={upload}
        />
      </div>

      {!value ? (
        <p className="note demofield-note">
          {auto
            ? `Matched “${label}” from the name. Nothing else to do.`
            : "No match for that name. Pick one below or upload a photo of your setup."}
        </p>
      ) : null}
      {error ? <p className="note note-warn">{error}</p> : null}

      {open ? (
        <div className="demopicker">
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the demo set"
            aria-label="Search movement demos"
            autoComplete="off"
          />
          <div className="demopicker-list">
            {matches.map((art) => (
              <button
                key={art.slug}
                type="button"
                className={`demopick ${value === art.slug ? "is-on" : ""}`}
                onClick={() => {
                  onChange(art.slug);
                  setOpen(false);
                }}
              >
                <span className="demopick-thumb">
                  <ExerciseDemo name={art.name} demo={art.slug} variant="thumb" />
                </span>
                <span className="demopick-name">{art.name}</span>
              </button>
            ))}
            {!matches.length ? (
              <p className="note">Nothing matches “{query}”. Upload a photo instead.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BuilderEmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="buildcta" onClick={onOpen}>
      <ShuffleIcon size={16} />
      <span>
        <b>Build a workout</b>: compose from your library or describe it out loud.
      </span>
    </button>
  );
}
