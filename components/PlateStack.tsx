"use client";

import { useMemo } from "react";
import type { PlateLoad } from "@/lib/plates";

/**
 * Face-on plate emblem, used when there is no weight to draw (no maxes set yet).
 * Decorative, so it never implies a load.
 */
export function PlateEmblem({ seed = 0, className = "" }: { seed?: number; className?: string }) {
  // Fixed coordinates: computing these with Math.sin/cos gives last-digit
  // differences between the server and the browser, which breaks hydration.
  const holes = [
    { x: 93, y: 60 },
    { x: 76.5, y: 88.6 },
    { x: 43.5, y: 88.6 },
    { x: 27, y: 60 },
    { x: 43.5, y: 31.4 },
    { x: 76.5, y: 31.4 },
  ];

  return (
    <svg
      className={`plate-emblem ${className}`}
      viewBox="0 0 120 120"
      aria-hidden="true"
      style={{ transform: `rotate(${(seed * 37) % 360}deg)` }}
    >
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" strokeWidth="1" />
      <circle
        cx="60"
        cy="60"
        r="45"
        fill="none"
        stroke="var(--ember)"
        strokeWidth="1.5"
        strokeDasharray="82 20"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="60" cy="60" r="35" fill="none" stroke="var(--line)" strokeWidth="1" />
      <circle cx="60" cy="60" r="15" fill="none" stroke="var(--line-strong)" strokeWidth="1" />
      {holes.map((hole, index) => (
        <circle key={index} cx={hole.x} cy={hole.y} r="2.4" fill="var(--text-faint)" opacity="0.5" />
      ))}
      <circle cx="60" cy="60" r="4" fill="var(--ember)" />
    </svg>
  );
}

/** Visual diameter of each standard plate, relative to a 45. */
const SIZE: Record<number, number> = {
  45: 1,
  35: 0.88,
  25: 0.74,
  10: 0.56,
  5: 0.46,
  2.5: 0.36,
};

const VIEW_W = 240;
const VIEW_H = 132;
const BAR_Y = VIEW_H / 2;
const MAX_PLATES = 9;

/**
 * Side-on barbell loaded with plates, drawn to scale: taller plates are heavier.
 * Heights morph with a transform transition, so changing the load animates.
 */
export function PlateStack({
  loads,
  className = "",
  showBar = true,
}: {
  loads: PlateLoad[];
  className?: string;
  showBar?: boolean;
}) {
  const plates = useMemo(() => {
    const list: number[] = [];
    for (const load of loads) {
      for (let i = 0; i < load.count; i += 1) list.push(load.plate);
    }
    return list.slice(0, MAX_PLATES);
  }, [loads]);

  const slot = 11;
  const totalWidth = plates.length * slot;
  const startX = (VIEW_W - totalWidth) / 2;

  return (
    <svg
      className={`plate-stack ${className}`}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={plates.length ? `Plates per side: ${plates.join(", ")} lb` : "Bar with no plates"}
      preserveAspectRatio="xMidYMid meet"
    >
      {showBar ? (
        <>
          <line className="bar" x1={8} y1={BAR_Y} x2={VIEW_W - 8} y2={BAR_Y} strokeWidth={3} />
          {/* Sleeve collars */}
          <rect x={VIEW_W / 2 - totalWidth / 2 - 5} y={BAR_Y - 7} width={2.5} height={14} fill="rgba(244,239,228,0.35)" />
          <rect x={VIEW_W / 2 + totalWidth / 2 + 2.5} y={BAR_Y - 7} width={2.5} height={14} fill="rgba(244,239,228,0.35)" />
        </>
      ) : null}

      {plates.map((plate, index) => {
        const scale = SIZE[plate] ?? 0.5;
        return (
          <rect
            key={`${plate}-${index}`}
            className="plate-shape"
            x={startX + index * slot}
            y={BAR_Y - 56}
            width={8}
            height={112}
            rx={1.5}
            fill={plate >= 25 ? "var(--ember)" : "var(--text)"}
            style={{
              transform: `scaleY(${scale})`,
              transformOrigin: "center",
              opacity: plate >= 25 ? 0.95 : 0.82,
            }}
          />
        );
      })}
    </svg>
  );
}

