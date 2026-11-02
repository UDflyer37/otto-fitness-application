import { MOVE_ART, moveArtFor, type MoveArt } from "./moveArt";
import type { Program } from "./types";

/**
 * The demo attached to a movement is either a slug from the bundled art set or
 * an image the lifter uploaded, which is stored inline as a data URL. Keeping
 * both in one string means a movement only ever carries one field.
 */
export function isUploadedDemo(demo: string | null | undefined): demo is string {
  return typeof demo === "string" && demo.startsWith("data:image/");
}

export function artBySlug(slug: string | null | undefined): MoveArt | null {
  if (!slug) return null;
  return MOVE_ART.find((entry) => entry.slug === slug) ?? null;
}

/** The bundled slug for a movement name, if the art set covers it. */
export function autoDemo(name: string): string | null {
  return moveArtFor(name)?.slug ?? null;
}

/** What to draw for a movement: an explicit choice first, then a name lookup. */
export type DemoSource =
  | { kind: "art"; art: MoveArt }
  | { kind: "upload"; src: string };

export function resolveDemo(name: string, demo?: string | null): DemoSource | null {
  if (isUploadedDemo(demo)) return { kind: "upload", src: demo };
  const chosen = artBySlug(demo);
  if (chosen) return { kind: "art", art: chosen };
  const matched = moveArtFor(name);
  return matched ? { kind: "art", art: matched } : null;
}

/** A short label for the demo in use, for the builder's confirmation line. */
export function demoLabel(name: string, demo?: string | null): string | null {
  if (isUploadedDemo(demo)) return "Your photo";
  const source = resolveDemo(name, demo);
  if (!source) return null;
  return source.kind === "art" ? source.art.name : "Your photo";
}

/**
 * Runs the lookup across a whole imported set and reports how much of it has
 * footage, so the importer can say so instead of leaving people guessing.
 */
export function stampDemos(programs: Program[]) {
  let total = 0;
  let found = 0;

  const stamped = programs.map((program) => ({
    ...program,
    exercises: program.exercises.map((exercise) => {
      total += 1;
      const demo = exercise.demo ?? autoDemo(exercise.name);
      if (demo) found += 1;
      return { ...exercise, demo };
    }),
  }));

  return { programs: stamped, found, total };
}

/** Search the bundled set for the "choose a demo" list. */
export function searchMoves(query: string, limit = 60): MoveArt[] {
  const text = query.trim().toLowerCase();
  if (!text) return MOVE_ART.slice(0, limit);

  const scored: { art: MoveArt; score: number }[] = [];
  for (const art of MOVE_ART) {
    const labels = [art.name, ...art.names].map((label) => label.toLowerCase());
    let best = 0;
    for (const label of labels) {
      if (label === text) best = Math.max(best, 100);
      else if (label.startsWith(text)) best = Math.max(best, 60);
      else if (label.includes(text)) best = Math.max(best, 40);
    }
    if (best) scored.push({ art, score: best });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.art.name.localeCompare(b.art.name))
    .slice(0, limit)
    .map((entry) => entry.art);
}

/**
 * Shrinks an uploaded image so a handful of them can live in localStorage.
 * Photos straight off a phone are several megabytes; this lands near 40 KB.
 */
export async function imageToDataUrl(file: File, maxWidth = 640): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not read that image.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length < 260_000) return url;
  }
  throw new Error("That image is too large. Try a smaller one.");
}
