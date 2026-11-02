import { NextResponse } from "next/server";
import { guessLift, newExerciseId } from "@/lib/library";
import { parseWorkoutDescription, type DraftProgram } from "@/lib/parseWorkout";
import type { LibraryExercise, Lift } from "@/lib/types";

/**
 * Optional AI pass over a workout description. It reads an OpenAI-compatible
 * endpoint from the environment and falls back to the deterministic parser in
 * `lib/parseWorkout` when no key is configured or the request fails, so the
 * app never depends on it.
 *
 * Set either:
 *   OPENLLM_ENDPOINT + OPENLLM_API_KEY   (OpenAI-compatible gateway)
 *   OPENAI_API_KEY                       (defaults to api.openai.com)
 * and optionally OPENLLM_MODEL.
 */
export const dynamic = "force-dynamic";

type Incoming = {
  text?: unknown;
  library?: unknown;
};

type RawExercise = {
  name?: unknown;
  sets?: unknown;
  reps?: unknown;
  percent?: unknown;
  lift?: unknown;
};

const LIFTS: Lift[] = ["squat", "bench", "deadlift", "press"];
const MAX_TEXT = 1200;

function aiTarget() {
  const key = process.env.OPENLLM_API_KEY;
  const base = process.env.OPENLLM_ENDPOINT;
  if (key && base) {
    return { url: `${base.replace(/\/+$/, "")}/chat/completions`, key };
  }
  if (process.env.OPENAI_API_KEY) {
    return { url: "https://api.openai.com/v1/chat/completions", key: process.env.OPENAI_API_KEY };
  }
  return null;
}

function toText(value: unknown, fallback: string) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 12);
  return fallback;
}

/** Reads the library from the request without trusting its shape. */
function readLibrary(value: unknown): LibraryExercise[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : newExerciseId("library"),
      name: typeof item.name === "string" ? item.name.slice(0, 60) : "",
      sets: typeof item.sets === "string" ? item.sets : "3",
      reps: typeof item.reps === "string" ? item.reps : "8",
      percent: typeof item.percent === "number" ? item.percent : null,
      lift: LIFTS.includes(item.lift as Lift) ? (item.lift as Lift) : null,
    }))
    .filter((item) => item.name);
}

/** Turns the model's reply into the same shape the local parser produces. */
function normalize(raw: unknown, library: LibraryExercise[]): DraftProgram | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as { name?: unknown; exercises?: unknown };
  if (!Array.isArray(candidate.exercises)) return null;

  const exercises = candidate.exercises
    .slice(0, 10)
    .filter((item): item is RawExercise => Boolean(item) && typeof item === "object")
    .map((item) => {
      const rawName = typeof item.name === "string" ? item.name.trim().slice(0, 60) : "";
      const known = library.find((entry) => entry.name.toLowerCase() === rawName.toLowerCase());
      const name = known?.name ?? rawName;
      if (!name) return null;

      const percent =
        typeof item.percent === "number" && item.percent >= 20 && item.percent <= 130
          ? Math.round(item.percent)
          : known?.percent ?? null;
      const lift = LIFTS.includes(item.lift as Lift)
        ? (item.lift as Lift)
        : known?.lift ?? guessLift(name);

      return {
        id: newExerciseId(name),
        name,
        sets: toText(item.sets, known?.sets ?? "3"),
        reps: toText(item.reps, known?.reps ?? "8"),
        percent,
        lift,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (!exercises.length) return null;

  return {
    name: typeof candidate.name === "string" && candidate.name.trim()
      ? candidate.name.trim().slice(0, 48)
      : "Described workout",
    exercises,
  };
}

export async function POST(request: Request) {
  let body: Incoming;
  try {
    body = (await request.json()) as Incoming;
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  if (!text) {
    return NextResponse.json({ error: "Describe the workout first." }, { status: 400 });
  }

  const library = readLibrary(body.library);
  const local = () => NextResponse.json({ program: parseWorkoutDescription(text, library), source: "local" });

  const target = aiTarget();
  if (!target) return local();

  const known = library.slice(0, 80).map((item) => item.name);

  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.key}` },
      body: JSON.stringify({
        model: process.env.OPENLLM_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You program strength-training sessions for one lifter.",
              'Reply with JSON only: {"name": string, "exercises": [{"name": string, "sets": string, "reps": string, "percent": number|null, "lift": "squat"|"bench"|"deadlift"|"press"|null}]}.',
              "Understand intent as well as numbers: \"destroy my legs\" means a leg session, and a named machine or tool should shape the movements.",
              "Use 3x8 as a default when no rep scheme is given. Only set percent for movements driven by a squat, bench, deadlift or overhead press max; otherwise null.",
              "6 movements at most, ordered heaviest first.",
              known.length ? `Prefer these existing exercise names when they fit: ${known.join(", ")}.` : "",
            ]
              .filter(Boolean)
              .join(" "),
          },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) return local();

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return local();

    const parsed = normalize(JSON.parse(content), library);
    if (!parsed) return local();

    return NextResponse.json({ program: parsed, source: "ai" });
  } catch {
    return local();
  }
}
