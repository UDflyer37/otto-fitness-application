"use client";

import { resolveDemo } from "@/lib/demos";

type Variant = "hero" | "strip" | "thumb";

/**
 * Movement demonstration. Each movement ships as two photographs: the start
 * position and the end position. Holding each pose and dissolving between them
 * reads as a controlled rep, which is how exercise demos were drawn long before
 * anything moved on its own.
 *
 * Movements with no footage fall back to a labelled plate mark instead of
 * guessing at the motion with a stick figure.
 */
export function ExerciseDemo({
  name,
  demo,
  variant = "strip",
  animated = true,
  className = "",
  label,
  eager = false,
}: {
  name: string;
  /** Slug chosen for this movement, or an uploaded image data URL. */
  demo?: string | null;
  variant?: Variant;
  animated?: boolean;
  className?: string;
  label?: string;
  eager?: boolean;
}) {
  const source = resolveDemo(name, demo);

  if (!source) {
    return (
      <span className={`demo demo--${variant} demo--fallback ${className}`}>
        <FallbackMark name={name} />
      </span>
    );
  }

  // An uploaded photo is a single still: there is no second pose to draw.
  if (source.kind === "upload") {
    return (
      <span
        className={`demo demo--${variant} demo--still ${className}`}
        role="img"
        aria-label={label ?? `${name} demonstration`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="demo-frame demo-frame--solo" src={source.src} alt="" decoding="async" />
        <span className="demo-edge" aria-hidden="true" />
      </span>
    );
  }

  const art = source.art;

  const sized = (frame: "a" | "b") => ({
    src: `/moves/${art.slug}/${frame}-640.jpg`,
    srcSet: `/moves/${art.slug}/${frame}-160.jpg 160w, /moves/${art.slug}/${frame}-640.jpg 640w`,
  });

  const sizes = variant === "thumb" ? "64px" : "(max-width: 640px) 92vw, 600px";

  // Only the movement you are looking at animates. Thumbnails hold the first
  // frame so a long library does not turn into a wall of moving thumbnails.
  const moving = animated && variant !== "thumb";

  return (
    <span
      className={`demo demo--${variant} ${moving ? "is-moving" : ""} ${className}`}
      role="img"
      aria-label={label ?? `${art.name} demonstration`}
    >
      <img
        className="demo-frame demo-frame--a"
        alt=""
        width={640}
        height={427}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        {...sized("a")}
      />
      <img
        className="demo-frame demo-frame--b"
        alt=""
        width={640}
        height={427}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        {...sized("b")}
      />
      <span className="demo-edge" aria-hidden="true" />
    </span>
  );
}

/** Quiet placeholder for movements with no footage: a plate and the initials. */
function FallbackMark({ name }: { name: string }) {
  const initials = name
    .replace(/[^a-zA-Z ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <span className="demo-fallback" aria-hidden="true">
      <svg viewBox="0 0 120 80" className="demo-fallback-glyph">
        <circle cx="60" cy="40" r="21" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="60" cy="40" r="12" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.55" />
        <circle cx="60" cy="40" r="4" fill="currentColor" />
        <line x1="18" y1="40" x2="36" y2="40" stroke="currentColor" strokeWidth="1.6" />
        <line x1="84" y1="40" x2="102" y2="40" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span className="demo-initials">{initials || "·"}</span>
    </span>
  );
}
