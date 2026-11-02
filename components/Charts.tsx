"use client";

import { useId, type CSSProperties } from "react";

/** Semicircular gauge for percentages (working max, session completion). */
export function ArcDial({
  value,
  size = 58,
  label,
  tone = "ember",
}: {
  value: number;
  size?: number;
  label?: string;
  tone?: "ember" | "lime";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const path = "M 8 26 A 22 22 0 0 1 52 26";

  return (
    <svg
      className="dial"
      width={size}
      height={size * 0.72}
      viewBox="0 0 60 44"
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
      <path
        d={path}
        fill="none"
        stroke={tone === "lime" ? "var(--lime)" : "var(--ember)"}
        strokeWidth="3"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="100"
        strokeDashoffset={100 - clamped}
        style={{ transition: "stroke-dashoffset 0.6s var(--ease)" }}
      />
      {label ? (
        <text
          x="30"
          y="41"
          textAnchor="middle"
          fill="var(--text-dim)"
          style={{ fontFamily: "var(--font-mono-stack)", fontSize: 8, letterSpacing: "0.04em" }}
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
}

/**
 * The Epley relationship, plotted the way lifters read it: the same weight held
 * for more reps implies a bigger max, so the curve climbs to the right and the
 * set you entered sits on it. The 2-8 rep window is shaded because that is
 * where the estimate is worth trusting.
 */
export function RepsCurve({
  estimate,
  weight,
  reps,
}: {
  estimate: number | null;
  weight: number | null;
  reps: number | null;
}) {
  const gradientId = useId().replace(/:/g, "");

  if (!estimate || !weight || !reps) {
    return (
      <div className="empty" style={{ borderTop: 0 }}>
        <p className="empty-text">
          Enter a weight and reps. The curve shows what that set implies at every other rep count.
        </p>
      </div>
    );
  }

  const W = 320;
  const H = 148;
  const P = { left: 34, right: 12, top: 16, bottom: 22 };
  const innerW = W - P.left - P.right;
  const innerH = H - P.top - P.bottom;

  const points = Array.from({ length: 12 }, (_, index) => {
    const rep = index + 1;
    return { rep, value: Math.round(weight * (1 + rep / 30)) };
  });

  const low = points[0].value;
  const high = points[points.length - 1].value;
  const span = Math.max(1, high - low);

  const x = (rep: number) => P.left + ((rep - 1) / 11) * innerW;
  const y = (value: number) => P.top + (1 - (value - low) / span) * innerH;

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.rep)} ${y(point.value)}`)
    .join(" ");
  const area = `${line} L ${x(12)} ${P.top + innerH} L ${x(1)} ${P.top + innerH} Z`;

  const markerRep = Math.min(12, Math.max(1, Math.round(reps)));
  const currentX = x(markerRep);
  const currentY = y(Math.round(weight * (1 + markerRep / 30)));

  return (
    <div className="chart-wrap">
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Estimated max by rep count: ${weight} lb for ${markerRep} reps implies ${estimate} lb`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ember)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--ember)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* The honest part of the curve. */}
        <rect
          className="chart-band"
          x={x(2)}
          y={P.top}
          width={x(8) - x(2)}
          height={innerH}
        />

        <g className="chart-grid">
          {[0, 1, 2, 3].map((row) => (
            <line
              key={row}
              x1={P.left}
              x2={W - P.right}
              y1={P.top + (row / 3) * innerH}
              y2={P.top + (row / 3) * innerH}
            />
          ))}
        </g>

        <path d={area} fill={`url(#${gradientId})`} />
        <path className="chart-line" d={line} />

        {points.map((point) => (
          <circle
            key={point.rep}
            className="chart-pebble"
            cx={x(point.rep)}
            cy={y(point.value)}
            r={1.9}
          />
        ))}

        <line
          x1={currentX}
          x2={currentX}
          y1={currentY}
          y2={P.top + innerH}
          stroke="var(--ember)"
          strokeOpacity="0.4"
          strokeDasharray="2 3"
        />
        <circle className="chart-dot-halo" cx={currentX} cy={currentY} r={8} />
        <circle className="chart-dot" cx={currentX} cy={currentY} r={3.4} />

        <text className="chart-callout" x={P.left + 4} y={P.top + 10} fill="var(--text)">
          {weight} × {markerRep} → {estimate} lb
        </text>

        {[1, 4, 8, 12].map((rep) => (
          <text key={rep} className="chart-axis" x={x(rep)} y={H - 6} textAnchor="middle">
            {rep} rep{rep === 1 ? "" : "s"}
          </text>
        ))}

        <text className="chart-axis" x={P.left - 6} y={P.top + 4} textAnchor="end">
          {high}
        </text>
        <text className="chart-axis" x={P.left - 6} y={P.top + innerH + 2} textAnchor="end">
          {low}
        </text>
        <text className="chart-axis" x={P.left - 6} y={P.top - 6} textAnchor="end">
          max
        </text>
      </svg>
      <p className="chart-caption">
        Each point is the max that {weight} lb for that many reps implies. Reps to the right is a
        bigger claim. The shaded 2-8 range is the part worth trusting.
      </p>
    </div>
  );
}

/** History durations at a glance. Oldest on the left. */
export function BarStrip({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const recent = values.slice(0, 10).reverse();

  return (
    <div className="bars" aria-hidden="true">
      {recent.map((value, index) => (
        <span key={index} className={`bars-bar ${value ? "" : "is-empty"}`}>
          <span style={{ "--h": `${Math.max(8, (value / max) * 100)}%` } as CSSProperties} />
        </span>
      ))}
    </div>
  );
}
